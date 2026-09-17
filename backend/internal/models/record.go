package models

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// columnTag is a parsed `column:"name[,primary_key]"` struct tag. primary_key
// marks a field (e.g. ID) as read-only from applyToRecord's perspective: it's
// still scanned back out of the record, but never written, since
// record.Set("id", ...) would overwrite the ID core.NewRecord already
// generated for a fresh record with the domain struct's zero-value ID.
type columnTag struct {
	name       string
	primaryKey bool
}

func parseColumnTag(raw string) (columnTag, bool) {
	if raw == "" {
		return columnTag{}, false
	}

	parts := strings.Split(raw, ",")
	tag := columnTag{name: parts[0]}
	for _, opt := range parts[1:] {
		if opt == "primary_key" {
			tag.primaryKey = true
		}
	}
	return tag, true
}

// applyToRecord writes v's `column`-tagged fields onto record via
// record.Set, skipping primary_key fields and any field without a `column`
// tag. v must be a non-nil pointer to a struct.
func applyToRecord(record *core.Record, v any) {
	rv := reflect.ValueOf(v).Elem()
	rt := rv.Type()

	for i := range rt.NumField() {
		tag, ok := parseColumnTag(rt.Field(i).Tag.Get("column"))
		if !ok || tag.primaryKey {
			continue
		}

		field := rv.Field(i)
		if field.Kind() == reflect.String {
			// Covers named string types too (ProductCategory, OrderStatus),
			// so PocketBase always gets a plain string for select fields.
			record.Set(tag.name, field.String())
			continue
		}
		record.Set(tag.name, field.Interface())
	}
}

// scanRecord reads record's columns into v's `column`-tagged fields
// (including primary_key ones), dispatching on each field's kind: strings
// (including named string types) via GetString, float64 via GetFloat, and
// slices via UnmarshalJSONField. Fields without a `column` tag are left
// untouched, so callers can fill those in separately (e.g. Order.Created,
// which comes from GetDateTime). v must be a non-nil pointer to a struct.
func scanRecord(record *core.Record, v any) error {
	rv := reflect.ValueOf(v).Elem()
	rt := rv.Type()

	for i := range rt.NumField() {
		tag, ok := parseColumnTag(rt.Field(i).Tag.Get("column"))
		if !ok {
			continue
		}

		field := rv.Field(i)
		switch field.Kind() {
		case reflect.String:
			field.SetString(record.GetString(tag.name))
		case reflect.Float64:
			field.SetFloat(record.GetFloat(tag.name))
		case reflect.Slice:
			dest := reflect.New(field.Type())
			if err := record.UnmarshalJSONField(tag.name, dest.Interface()); err != nil {
				return fmt.Errorf("unmarshal %q: %w", tag.name, err)
			}
			field.Set(dest.Elem())
		default:
			return fmt.Errorf("scanRecord: unsupported field kind %s for column %q", field.Kind(), tag.name)
		}
	}

	return nil
}
