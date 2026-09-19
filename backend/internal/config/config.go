// Package config loads settings from the environment. Secrets are only
// ever read from the environment, never from source or the database.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments/square"
	"felisa-cafe/backend/internal/services/eta"
)

type Config struct {
	// Square is nil when SQUARE_ACCESS_TOKEN is unset: the menu is then
	// served from the cache, and checkout/sync report "not configured".
	Square *square.Config

	// PublicSiteURL is the storefront origin (Square redirects buyers to
	// {PublicSiteURL}/orders/{id} after payment).
	PublicSiteURL string

	ETA eta.Config

	// Cron expressions; empty disables the job.
	CatalogSyncCron    string
	OrderReconcileCron string
}

// Load reads the environment. It fails on malformed values and on
// production deployments missing anything checkout safety depends on.
func Load() (Config, error) {
	var errs []error
	cfg := Config{
		PublicSiteURL:      strings.TrimRight(env("PUBLIC_SITE_URL", "http://localhost:3000"), "/"),
		CatalogSyncCron:    env("CATALOG_SYNC_CRON", "*/30 * * * *"),
		OrderReconcileCron: env("ORDER_RECONCILE_CRON", "*/5 * * * *"),
	}
	if u, err := url.Parse(cfg.PublicSiteURL); err != nil || u.Scheme == "" || u.Host == "" {
		errs = append(errs, fmt.Errorf("PUBLIC_SITE_URL must be an absolute URL, got %q", cfg.PublicSiteURL))
	}

	def := eta.DefaultConfig()
	cfg.ETA = eta.Config{
		BasePrep: duration("ETA_BASE_PREP", def.BasePrep, &errs),
		PerItem:  duration("ETA_PER_ITEM", def.PerItem, &errs),
		Buffer:   duration("ETA_BUFFER", def.Buffer, &errs),
		Capacity: integer("ETA_CAPACITY", def.Capacity, &errs),
	}

	if token := os.Getenv("SQUARE_ACCESS_TOKEN"); token != "" {
		sc := &square.Config{
			AccessToken:         token,
			ApplicationID:       os.Getenv("SQUARE_APPLICATION_ID"),
			Environment:         env("SQUARE_ENVIRONMENT", "sandbox"),
			LocationID:          os.Getenv("SQUARE_LOCATION_ID"),
			Currency:            models.Currency(env("SQUARE_CURRENCY", "USD")),
			WebhookSignatureKey: os.Getenv("SQUARE_WEBHOOK_SIGNATURE_KEY"),
			WebhookURL:          os.Getenv("SQUARE_WEBHOOK_URL"),
			Timeout:             duration("SQUARE_TIMEOUT", 15*time.Second, &errs),
			AllowTipping:        boolean("SQUARE_ALLOW_TIPPING", false, &errs),
		}
		if sc.LocationID == "" {
			errs = append(errs, errors.New("SQUARE_LOCATION_ID is required when SQUARE_ACCESS_TOKEN is set"))
		}
		if sc.Environment != "sandbox" && sc.Environment != "production" {
			errs = append(errs, fmt.Errorf("SQUARE_ENVIRONMENT must be sandbox or production, got %q", sc.Environment))
		}
		if sc.Environment == "production" {
			// Without webhooks, payment confirmation relies on polling alone.
			if sc.WebhookSignatureKey == "" || sc.WebhookURL == "" {
				errs = append(errs, errors.New("SQUARE_WEBHOOK_SIGNATURE_KEY and SQUARE_WEBHOOK_URL are required in production"))
			}
			if !strings.HasPrefix(cfg.PublicSiteURL, "https://") {
				errs = append(errs, errors.New("PUBLIC_SITE_URL must be https in production"))
			}
		}
		cfg.Square = sc
	}

	return cfg, errors.Join(errs...)
}

func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return strings.TrimSpace(v)
	}
	return fallback
}

func duration(key string, fallback time.Duration, errs *[]error) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil || d < 0 {
		*errs = append(*errs, fmt.Errorf("%s: invalid duration %q", key, v))
		return fallback
	}
	return d
}

func integer(key string, fallback int, errs *[]error) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		*errs = append(*errs, fmt.Errorf("%s: invalid positive integer %q", key, v))
		return fallback
	}
	return n
}

func boolean(key string, fallback bool, errs *[]error) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		*errs = append(*errs, fmt.Errorf("%s: invalid boolean %q", key, v))
		return fallback
	}
	return b
}
