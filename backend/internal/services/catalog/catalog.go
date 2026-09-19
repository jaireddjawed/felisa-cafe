// Package catalog serves the storefront menu from the PocketBase cache and
// keeps that cache in step with Square, the source of truth.
//
//	Square Catalog --(Sync)--> PocketBase products cache --> storefront
//
// Browsing never calls Square, so the menu stays up when Square is slow or
// down. Checkout re-verifies prices with Square separately.
package catalog

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"felisa-cafe/backend/internal/database"
	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
)

type Service struct {
	store  *database.Store
	square payments.Catalog // nil when Square is not configured
	log    *slog.Logger
	now    func() time.Time

	syncMu  sync.Mutex // one sync at a time
	pending sync.Mutex // guards queued
	queued  bool
}

func New(store *database.Store, square payments.Catalog, log *slog.Logger) *Service {
	return &Service{store: store, square: square, log: log, now: time.Now}
}

// List returns the active menu, optionally filtered to categories.
func (s *Service) List(ctx context.Context, categories ...models.ProductCategory) ([]models.Product, error) {
	return s.store.Products.ListByCategories(ctx, categories...)
}

// Get returns an active product by slug, or models.ErrNotFound.
func (s *Service) Get(ctx context.Context, slug string) (models.Product, error) {
	return s.store.Products.FindActiveBySlug(ctx, slug)
}

type SyncResult struct {
	Created, Updated, Linked, Deleted int
	ModifierLists                     int
	// Uncategorized lists items whose Square categories map to no menu
	// section (they are cached, but hidden from category listings).
	Uncategorized []string
}

func (r SyncResult) String() string {
	return fmt.Sprintf("created=%d updated=%d linked=%d deleted=%d modifier_lists=%d uncategorized=%d",
		r.Created, r.Updated, r.Linked, r.Deleted, r.ModifierLists, len(r.Uncategorized))
}

// Sync performs a full reconciliation of the cache against Square. It is
// idempotent: products are matched by Square item ID (and, the first time,
// by slug to adopt pre-existing local metadata), so repeated runs never
// duplicate anything. Items missing from Square are marked deleted, not
// removed, so their local metadata survives if they come back.
func (s *Service) Sync(ctx context.Context) (SyncResult, error) {
	if s.square == nil {
		return SyncResult{}, fmt.Errorf("%w: set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID", payments.ErrNotConfigured)
	}
	s.syncMu.Lock()
	defer s.syncMu.Unlock()

	snap, err := s.square.FetchCatalog(ctx)
	if err != nil {
		return SyncResult{}, fmt.Errorf("fetch catalog: %w", err)
	}

	var res SyncResult
	err = s.store.RunInTx(ctx, func(tx *database.Store) error {
		var err error
		res, err = s.apply(ctx, tx, snap)
		return err
	})
	if err != nil {
		return SyncResult{}, fmt.Errorf("apply catalog: %w", err)
	}
	return res, nil
}

func (s *Service) apply(ctx context.Context, tx *database.Store, snap *payments.CatalogSnapshot) (SyncResult, error) {
	res := SyncResult{ModifierLists: len(snap.ModifierLists)}
	now := s.now().UTC()

	if err := tx.Products.ReplaceModifierLists(ctx, snap.ModifierLists); err != nil {
		return res, err
	}
	lists := make(map[models.SquareModifierListID]models.ModifierList, len(snap.ModifierLists))
	for _, ml := range snap.ModifierLists {
		lists[ml.SquareID] = ml
	}

	existing, err := tx.Products.ListAll(ctx)
	if err != nil {
		return res, err
	}
	bySquareID := map[models.SquareItemID]*models.Product{}
	bySlug := map[string]*models.Product{}
	unlinkedByName := map[string]*models.Product{}
	for i := range existing {
		p := &existing[i]
		bySlug[p.Slug] = p
		if p.SquareItemID != "" {
			bySquareID[p.SquareItemID] = p
		} else {
			unlinkedByName[strings.ToLower(p.Name)] = p
		}
	}
	// adopt finds a product that has local metadata but no Square item yet.
	adopt := func(name string) *models.Product {
		if p := unlinkedByName[strings.ToLower(name)]; p != nil && p.SquareItemID == "" {
			return p
		}
		if p := bySlug[slugify(name)]; p != nil && p.SquareItemID == "" {
			return p
		}
		return nil
	}

	seen := map[models.SquareItemID]bool{}
	for _, item := range snap.Items {
		seen[item.ID] = true
		p, ok := bySquareID[item.ID]
		switch {
		case ok:
			res.Updated++
		case adopt(item.Name) != nil:
			// Adopt a locally-seeded product that carries presentation metadata.
			p = adopt(item.Name)
			res.Linked++
		default:
			p = &models.Product{Slug: uniqueSlug(slugify(item.Name), bySlug)}
			bySlug[p.Slug] = p
			res.Created++
		}

		applyItem(p, item, lists, now)
		if p.Category == "" {
			res.Uncategorized = append(res.Uncategorized, item.Name)
		}
		if err := tx.Products.Save(ctx, p); err != nil {
			return res, err
		}
	}

	for i := range existing {
		p := &existing[i]
		if p.SquareItemID == "" || seen[p.SquareItemID] || p.Status == models.CatalogDeleted {
			continue
		}
		p.Status = models.CatalogDeleted
		p.Variations = nil
		p.SyncedAt = now
		res.Deleted++
		if err := tx.Products.Save(ctx, p); err != nil {
			return res, err
		}
	}
	return res, nil
}

// applyItem overwrites the Square-owned fields of p. Locally-owned
// presentation fields (tagline, pour colors, ...) are left untouched.
func applyItem(p *models.Product, item payments.CatalogItem, lists map[models.SquareModifierListID]models.ModifierList, now time.Time) {
	p.SquareItemID = item.ID
	p.SquareVersion = item.Version
	p.Name = item.Name
	if item.Description != "" {
		// An empty Square description doesn't erase locally-written copy.
		p.Description = item.Description
	}
	if cat, ok := categoryFor(item.CategoryNames); ok {
		p.Category = cat
	}
	p.Status = models.CatalogActive
	if !item.Available {
		p.Status = models.CatalogArchived
	}
	p.Variations = item.Variations
	p.ModifierLists = nil
	for _, ref := range item.ModifierLists {
		ml, ok := lists[ref.ListID]
		if !ok {
			continue
		}
		pml := models.ProductModifierList{List: ml, MinSelected: ml.MinSelected, MaxSelected: ml.MaxSelected}
		if ref.MinSelected != nil && ref.MaxSelected != nil {
			pml.MinSelected, pml.MaxSelected = *ref.MinSelected, *ref.MaxSelected
		}
		p.ModifierLists = append(p.ModifierLists, pml)
	}
	p.SyncedAt = now
}

// categoryFor maps Square category names ("Signature Drinks", "Matcha
// Series", ...) onto menu sections by keyword. If Square has no matching
// category, the product keeps whatever category was set locally.
func categoryFor(names []string) (models.ProductCategory, bool) {
	for _, name := range names {
		lower := strings.ToLower(name)
		for _, c := range models.ProductCategories {
			if strings.Contains(lower, string(c)) {
				return c, true
			}
		}
	}
	return "", false
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(name string) string {
	s := strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(name), "-"), "-")
	if s == "" {
		return "item"
	}
	return s
}

func uniqueSlug(base string, taken map[string]*models.Product) string {
	if taken[base] == nil {
		return base
	}
	for i := 2; ; i++ {
		if s := base + "-" + strconv.Itoa(i); taken[s] == nil {
			return s
		}
	}
}

// TriggerSync runs a sync in the background, e.g. on a catalog webhook.
// Triggers arriving while a sync runs are coalesced into one follow-up.
func (s *Service) TriggerSync() {
	if s.square == nil {
		return
	}
	s.pending.Lock()
	if s.queued {
		s.pending.Unlock()
		return
	}
	s.queued = true
	s.pending.Unlock()

	go func() {
		// Taking syncMu first means a trigger during a running sync waits
		// and then syncs again, picking up whatever changed meanwhile.
		s.syncMu.Lock()
		s.pending.Lock()
		s.queued = false
		s.pending.Unlock()
		s.syncMu.Unlock()

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		res, err := s.Sync(ctx)
		if err != nil && !errors.Is(err, context.Canceled) {
			s.log.Error("background catalog sync failed", "error", err)
			return
		}
		s.log.Info("catalog synced", "result", res.String())
	}()
}
