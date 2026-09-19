package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/models"
)

// proxy is satisfied by every generated record proxy (*schema.XRecord).
type proxy[R any] interface {
	*R
	core.RecordProxy
	CollectionName() string
}

// table is the generic CRUD/query core shared by every repository. It only
// ever hands out typed proxies, and the collection name comes from the
// generated proxy type, so no repository spells a collection name.
type table[R any, P proxy[R]] struct {
	app core.App
}

func (t table[R, P]) name() string {
	return P(new(R)).CollectionName()
}

// New returns an unsaved record of this collection.
func (t table[R, P]) New() (P, error) {
	c, err := t.app.FindCachedCollectionByNameOrId(t.name())
	if err != nil {
		return nil, fmt.Errorf("collection %s: %w", t.name(), err)
	}
	p := P(new(R))
	p.SetProxyRecord(core.NewRecord(c))
	return p, nil
}

func (t table[R, P]) Save(ctx context.Context, p P) error {
	if err := t.app.SaveWithContext(ctx, p.ProxyRecord()); err != nil {
		return fmt.Errorf("save %s: %w", t.name(), err)
	}
	return nil
}

func (t table[R, P]) Delete(ctx context.Context, p P) error {
	if err := t.app.DeleteWithContext(ctx, p.ProxyRecord()); err != nil {
		return fmt.Errorf("delete %s: %w", t.name(), err)
	}
	return nil
}

func (t table[R, P]) Query() *query[R, P] {
	return &query[R, P]{t: t}
}

func (t table[R, P]) FindByID(ctx context.Context, id string) (P, error) {
	if id == "" {
		return nil, models.ErrNotFound
	}
	return t.Query().Where(dbx.HashExp{core.FieldNameId: id}).One(ctx)
}

// query is a small typed builder over PocketBase's RecordQuery. Conditions
// come from the generated schema columns (schema.Products.Slug.Eq(...)).
type query[R any, P proxy[R]] struct {
	t      table[R, P]
	where  []dbx.Expression
	order  []string
	limit  int64
	offset int64
}

func (q *query[R, P]) Where(exprs ...dbx.Expression) *query[R, P] {
	q.where = append(q.where, exprs...)
	return q
}

func (q *query[R, P]) OrderBy(cols ...string) *query[R, P] {
	q.order = append(q.order, cols...)
	return q
}

func (q *query[R, P]) Limit(n int64) *query[R, P] {
	q.limit = n
	return q
}

func (q *query[R, P]) Offset(n int64) *query[R, P] {
	q.offset = n
	return q
}

func (q *query[R, P]) build(ctx context.Context) *dbx.SelectQuery {
	sel := q.t.app.RecordQuery(q.t.name()).WithContext(ctx)
	if len(q.where) > 0 {
		sel = sel.AndWhere(dbx.And(q.where...))
	}
	if len(q.order) > 0 {
		sel = sel.OrderBy(q.order...)
	}
	if q.limit > 0 {
		sel = sel.Limit(q.limit)
	}
	if q.offset > 0 {
		sel = sel.Offset(q.offset)
	}
	return sel
}

func (q *query[R, P]) All(ctx context.Context) ([]P, error) {
	var out []P
	if err := q.build(ctx).All(&out); err != nil {
		return nil, fmt.Errorf("query %s: %w", q.t.name(), err)
	}
	return out, nil
}

// One returns the first match or models.ErrNotFound.
func (q *query[R, P]) One(ctx context.Context) (P, error) {
	p := P(new(R))
	if err := q.build(ctx).Limit(1).One(p); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("query %s: %w", q.t.name(), err)
	}
	return p, nil
}

func (q *query[R, P]) Exists(ctx context.Context) (bool, error) {
	_, err := q.One(ctx)
	switch {
	case err == nil:
		return true, nil
	case errors.Is(err, models.ErrNotFound):
		return false, nil
	}
	return false, err
}

// enumMapping converts between a domain enum and its generated schema
// enum. Declaring it from explicit pairs means a select option removed from
// the schema breaks compilation (its generated constant disappears), and an
// option added to the schema but not mapped here fails the exhaustiveness
// test in enums_test.go.
type enumMapping[D ~string, S ~string] struct {
	toDB   map[D]S
	fromDB map[S]D
}

func newEnumMapping[D ~string, S ~string](pairs map[D]S) enumMapping[D, S] {
	m := enumMapping[D, S]{toDB: pairs, fromDB: make(map[S]D, len(pairs))}
	for d, s := range pairs {
		m.fromDB[s] = d
	}
	return m
}

func (m enumMapping[D, S]) ToDB(d D) (S, error) {
	s, ok := m.toDB[d]
	if !ok {
		var zero S
		return zero, fmt.Errorf("no storage value for %T %q", d, d)
	}
	return s, nil
}

func (m enumMapping[D, S]) FromDB(s S) (D, error) {
	d, ok := m.fromDB[s]
	if !ok {
		var zero D
		return zero, fmt.Errorf("unknown stored %T %q", s, s)
	}
	return d, nil
}

func (m enumMapping[D, S]) AllToDB(ds []D) ([]S, error) {
	out := make([]S, 0, len(ds))
	for _, d := range ds {
		s, err := m.ToDB(d)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, nil
}
