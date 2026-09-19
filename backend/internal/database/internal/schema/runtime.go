package schema

import (
	"errors"
	"fmt"
	"reflect"
	"slices"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

// ---------------------------------------------------------------------------
// Typed columns
// ---------------------------------------------------------------------------

// Column is a typed reference to a collection field, generated for every
// comparable field. Because T is the field's Go type (including generated
// enums and ID types), comparing a column against the wrong kind of value
// is a compile error rather than a silently-empty query.
type Column[T any] struct {
	name string
}

// Name returns the raw field name. Only the persistence layer should need it.
func (c Column[T]) Name() string { return c.name }

func (c Column[T]) Eq(v T) dbx.Expression    { return dbx.HashExp{c.name: dbValue(v)} }
func (c Column[T]) NotEq(v T) dbx.Expression { return dbx.Not(dbx.HashExp{c.name: dbValue(v)}) }
func (c Column[T]) Lt(v T) dbx.Expression    { return c.cmp("<", v) }
func (c Column[T]) Lte(v T) dbx.Expression   { return c.cmp("<=", v) }
func (c Column[T]) Gt(v T) dbx.Expression    { return c.cmp(">", v) }
func (c Column[T]) Gte(v T) dbx.Expression   { return c.cmp(">=", v) }

// In matches any of vs. An empty vs matches nothing (dbx renders "0=1").
func (c Column[T]) In(vs ...T) dbx.Expression {
	args := make([]any, len(vs))
	for i, v := range vs {
		args[i] = dbValue(v)
	}
	return dbx.In(c.name, args...)
}

// IsEmpty matches rows where the field holds its zero value (empty string or NULL),
// e.g. an unset optional relation or date.
func (c Column[T]) IsEmpty() dbx.Expression {
	return dbx.Or(dbx.HashExp{c.name: ""}, dbx.HashExp{c.name: nil})
}

func (c Column[T]) Asc() string  { return c.name + " ASC" }
func (c Column[T]) Desc() string { return c.name + " DESC" }

var paramSeq atomic.Uint64

func (c Column[T]) cmp(op string, v T) dbx.Expression {
	// Unique placeholder names so several comparisons can be AND-ed together.
	p := "p" + strconv.FormatUint(paramSeq.Add(1), 10)
	return dbx.NewExp("[["+c.name+"]] "+op+" {:"+p+"}", dbx.Params{p: dbValue(v)})
}

// dbValue converts typed values to what PocketBase stores in SQLite:
// generated enum/ID types become plain strings, times become PocketBase's
// datetime text format.
func dbValue(v any) any {
	switch x := v.(type) {
	case time.Time:
		if x.IsZero() {
			return ""
		}
		dt, _ := types.ParseDateTime(x)
		return dt.String()
	case nil:
		return nil
	}
	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.String:
		return rv.String()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return rv.Int()
	case reflect.Float32, reflect.Float64:
		return rv.Float()
	case reflect.Bool:
		return rv.Bool()
	}
	return v
}

// ---------------------------------------------------------------------------
// Record accessor helpers used by generated code
// ---------------------------------------------------------------------------

func getInt64(r *core.Record, field string) int64 {
	return int64(r.GetInt(field))
}

func getTime(r *core.Record, field string) time.Time {
	dt := r.GetDateTime(field)
	if dt.IsZero() {
		return time.Time{}
	}
	return dt.Time()
}

func setTime(r *core.Record, field string, v time.Time) {
	if v.IsZero() {
		r.Set(field, "")
		return
	}
	r.Set(field, v.UTC())
}

// getJSON decodes a JSON field into dst. Unset (empty/null) fields decode
// to dst's zero value rather than failing.
func getJSON[T any](r *core.Record, field string) (T, error) {
	var v T
	raw := r.GetString(field)
	if raw == "" || raw == "null" {
		return v, nil
	}
	if err := r.UnmarshalJSONField(field, &v); err != nil {
		return v, fmt.Errorf("%s.%s: decode json: %w", r.Collection().Name, field, err)
	}
	return v, nil
}

// ---------------------------------------------------------------------------
// Schema verification
// ---------------------------------------------------------------------------

// CollectionSpec is the generated description of what the typed layer
// assumes a collection looks like.
type CollectionSpec struct {
	Name   string
	Type   string
	Fields []FieldSpec
}

type FieldSpec struct {
	Name     string
	Type     string
	Multi    bool     // select/relation: MaxSelect > 1
	OnlyInt  bool     // number
	Values   []string // select
	Relation string   // relation: target collection name
}

// Verify checks the live database against every generated CollectionSpec
// and reports all mismatches at once. Run it at startup: an out-of-date
// schema_gen.go (someone edited a collection in the admin UI, or forgot to
// regenerate) then fails loudly before serving a single request, instead of
// surfacing later as silently empty strings from record.GetString.
func Verify(app core.App) error {
	var errs []error
	for _, spec := range Collections {
		errs = append(errs, verifyCollection(app, spec)...)
	}
	if len(errs) > 0 {
		return fmt.Errorf("pocketbase schema does not match generated code (run `go generate ./...` or fix the migration): %w", errors.Join(errs...))
	}
	return nil
}

func verifyCollection(app core.App, spec CollectionSpec) []error {
	c, err := app.FindCollectionByNameOrId(spec.Name)
	if err != nil {
		return []error{fmt.Errorf("collection %q: %w", spec.Name, err)}
	}
	var errs []error
	if c.Type != spec.Type {
		errs = append(errs, fmt.Errorf("collection %q: type %q, expected %q", spec.Name, c.Type, spec.Type))
	}
	for _, fs := range spec.Fields {
		f := c.Fields.GetByName(fs.Name)
		if f == nil {
			errs = append(errs, fmt.Errorf("%s.%s: field missing", spec.Name, fs.Name))
			continue
		}
		if f.Type() != fs.Type {
			errs = append(errs, fmt.Errorf("%s.%s: type %q, expected %q", spec.Name, fs.Name, f.Type(), fs.Type))
			continue
		}
		switch lf := f.(type) {
		case *core.SelectField:
			if lf.IsMultiple() != fs.Multi {
				errs = append(errs, fmt.Errorf("%s.%s: multi=%v, expected %v", spec.Name, fs.Name, lf.IsMultiple(), fs.Multi))
			}
			live, want := slices.Sorted(slices.Values(lf.Values)), slices.Sorted(slices.Values(fs.Values))
			if !slices.Equal(live, want) {
				errs = append(errs, fmt.Errorf("%s.%s: select values %v, expected %v", spec.Name, fs.Name, live, want))
			}
		case *core.NumberField:
			if lf.OnlyInt != fs.OnlyInt {
				errs = append(errs, fmt.Errorf("%s.%s: onlyInt=%v, expected %v", spec.Name, fs.Name, lf.OnlyInt, fs.OnlyInt))
			}
		case *core.RelationField:
			if lf.IsMultiple() != fs.Multi {
				errs = append(errs, fmt.Errorf("%s.%s: multi=%v, expected %v", spec.Name, fs.Name, lf.IsMultiple(), fs.Multi))
			}
			target, err := app.FindCachedCollectionByNameOrId(lf.CollectionId)
			if err != nil || target.Name != fs.Relation {
				errs = append(errs, fmt.Errorf("%s.%s: relation target changed, expected %q", spec.Name, fs.Name, fs.Relation))
			}
		}
	}
	return errs
}
