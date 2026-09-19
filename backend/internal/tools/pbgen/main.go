// Command pbgen generates the typed PocketBase persistence layer
// (internal/database/internal/schema/schema_gen.go) from the migrations in
// internal/migrations.
//
// The migrations are the single source of truth for the schema: pbgen boots
// a throwaway PocketBase app in a temporary directory, applies every system
// and app migration, then reads the resulting collections. No running server
// or existing pb_data is needed, so generation is reproducible from a clean
// checkout. Invoked via go:generate in the schema package:
//
//	go generate ./...
//
// Flags:
//
//	-config  pbgen.json: which collections to generate, Go types for JSON fields
//	-out     output file
//	-check   don't write; exit non-zero if -out is stale (for CI)
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"go/format"
	"log"
	"os"
	"slices"
	"strings"
	"unicode"

	"github.com/pocketbase/pocketbase/core"

	_ "felisa-cafe/backend/internal/migrations"
)

type config struct {
	Package     string              `json:"package"`
	Collections []string            `json:"collections"`
	JSONTypes   map[string]string   `json:"jsonTypes"`
	SkipFields  map[string][]string `json:"skipFields"`
}

func main() {
	configPath := flag.String("config", "pbgen.json", "generator config")
	outPath := flag.String("out", "schema_gen.go", "output file")
	check := flag.Bool("check", false, "exit 1 if the output file is out of date")
	flag.Parse()

	if err := run(*configPath, *outPath, *check); err != nil {
		log.Fatal("pbgen: ", err)
	}
}

func run(configPath, outPath string, check bool) error {
	cfg, err := loadConfig(configPath)
	if err != nil {
		return err
	}

	app, cleanup, err := migratedApp()
	if err != nil {
		return err
	}
	defer cleanup()

	src, err := generate(app, cfg)
	if err != nil {
		return err
	}

	if check {
		existing, _ := os.ReadFile(outPath)
		if !bytes.Equal(existing, src) {
			return fmt.Errorf("%s is out of date: run `go generate ./...`", outPath)
		}
		return nil
	}
	return os.WriteFile(outPath, src, 0o644)
}

func loadConfig(path string) (config, error) {
	var cfg config
	raw, err := os.ReadFile(path)
	if err != nil {
		return cfg, err
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return cfg, fmt.Errorf("%s: %w", path, err)
	}
	return cfg, nil
}

// migratedApp boots an empty PocketBase app in a temp dir and applies every
// registered migration.
func migratedApp() (core.App, func(), error) {
	dir, err := os.MkdirTemp("", "pbgen-*")
	if err != nil {
		return nil, nil, err
	}
	app := core.NewBaseApp(core.BaseAppConfig{DataDir: dir})
	cleanup := func() {
		_ = app.ClearBootstrap()
		_ = os.RemoveAll(dir)
	}
	if err := app.Bootstrap(); err != nil {
		cleanup()
		return nil, nil, fmt.Errorf("bootstrap: %w", err)
	}
	if err := app.RunAllMigrations(); err != nil {
		cleanup()
		return nil, nil, fmt.Errorf("migrations: %w", err)
	}
	return app, cleanup, nil
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

type genCollection struct {
	Name     string // raw collection name
	Type     string // base/auth/view
	GoName   string // Products
	Fields   []genField
	HasTimes bool
}

type genField struct {
	Name     string // raw field name
	Type     string // PocketBase field type
	GoName   string
	GoType   string // Go type returned by the getter
	Getter   string // expression body using r
	Setter   string // statement body using r and v; "" = read-only
	Column   bool   // generate a typed Column
	Fallible bool   // getter returns (T, error)
	Multi    bool
	OnlyInt  bool
	Values   []string
	Relation string
	Enum     *genEnum
}

type genEnum struct {
	GoName string
	Values []string
}

func generate(app core.App, cfg config) ([]byte, error) {
	names := map[string]bool{}
	for _, n := range cfg.Collections {
		names[n] = true
	}

	var cols []genCollection
	usedJSON := map[string]bool{}
	for _, name := range cfg.Collections {
		c, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			return nil, fmt.Errorf("collection %q from config not found after migrations: %w", name, err)
		}
		gc, err := buildCollection(app, c, cfg, names, usedJSON)
		if err != nil {
			return nil, err
		}
		cols = append(cols, gc)
	}
	for key := range cfg.JSONTypes {
		if !usedJSON[key] {
			return nil, fmt.Errorf("jsonTypes entry %q matches no json field", key)
		}
	}

	var b strings.Builder
	render(&b, cfg.Package, cols)
	src, err := format.Source([]byte(b.String()))
	if err != nil {
		return nil, fmt.Errorf("format generated code: %w\n%s", err, b.String())
	}
	return src, nil
}

func buildCollection(app core.App, c *core.Collection, cfg config, generated map[string]bool, usedJSON map[string]bool) (genCollection, error) {
	gc := genCollection{Name: c.Name, Type: c.Type, GoName: goName(c.Name)}
	skip := cfg.SkipFields[c.Name]

	for _, f := range c.Fields {
		name := f.GetName()
		if name == core.FieldNameId || f.GetHidden() || f.Type() == core.FieldTypePassword || slices.Contains(skip, name) {
			continue
		}
		gf := genField{Name: name, Type: f.Type(), GoName: goName(name)}
		q := fmt.Sprintf("%q", name)

		switch lf := f.(type) {
		case *core.TextField, *core.EmailField, *core.URLField, *core.EditorField:
			gf.GoType, gf.Column = "string", true
			gf.Getter = "r.GetString(" + q + ")"
			gf.Setter = "r.Set(" + q + ", v)"
		case *core.NumberField:
			gf.OnlyInt, gf.Column = lf.OnlyInt, true
			if lf.OnlyInt {
				gf.GoType = "int64"
				gf.Getter = "getInt64(r.Record, " + q + ")"
			} else {
				gf.GoType = "float64"
				gf.Getter = "r.GetFloat(" + q + ")"
			}
			gf.Setter = "r.Set(" + q + ", v)"
		case *core.BoolField:
			gf.GoType, gf.Column = "bool", true
			gf.Getter = "r.GetBool(" + q + ")"
			gf.Setter = "r.Set(" + q + ", v)"
		case *core.DateField:
			gf.GoType, gf.Column = "time.Time", true
			gf.Getter = "getTime(r.Record, " + q + ")"
			gf.Setter = "setTime(r.Record, " + q + ", v)"
			gc.HasTimes = true
		case *core.AutodateField:
			gf.GoType, gf.Column = "time.Time", true
			gf.Getter = "getTime(r.Record, " + q + ")"
			gc.HasTimes = true
		case *core.SelectField:
			enum := &genEnum{GoName: gc.GoName + gf.GoName, Values: lf.Values}
			gf.Enum, gf.Values, gf.Multi = enum, lf.Values, lf.IsMultiple()
			if gf.Multi {
				gf.GoType = "[]" + enum.GoName
				gf.Getter = "stringsTo[" + enum.GoName + "](r.GetStringSlice(" + q + "))"
				gf.Setter = "r.Set(" + q + ", stringsFrom(v))"
			} else {
				gf.GoType, gf.Column = enum.GoName, true
				gf.Getter = enum.GoName + "(r.GetString(" + q + "))"
				gf.Setter = "r.Set(" + q + ", string(v))"
			}
		case *core.RelationField:
			target, err := app.FindCollectionByNameOrId(lf.CollectionId)
			if err != nil {
				return gc, fmt.Errorf("%s.%s: relation target: %w", c.Name, name, err)
			}
			gf.Relation, gf.Multi = target.Name, lf.IsMultiple()
			idType := "string"
			if generated[target.Name] {
				idType = goName(target.Name) + "ID"
			}
			if gf.Multi {
				gf.GoType = "[]" + idType
				gf.Getter = "stringsTo[" + idType + "](r.GetStringSlice(" + q + "))"
				gf.Setter = "r.Set(" + q + ", stringsFrom(v))"
			} else {
				gf.GoType, gf.Column = idType, true
				gf.Getter = idType + "(r.GetString(" + q + "))"
				gf.Setter = "r.Set(" + q + ", string(v))"
			}
		case *core.JSONField:
			key := c.Name + "." + name
			goType, ok := cfg.JSONTypes[key]
			if !ok {
				return gc, fmt.Errorf("%s: json field has no Go type; add it to jsonTypes in pbgen.json", key)
			}
			usedJSON[key] = true
			gf.GoType, gf.Fallible = goType, true
			gf.Getter = "getJSON[" + goType + "](r.Record, " + q + ")"
			gf.Setter = "r.Set(" + q + ", v)"
		default:
			return gc, fmt.Errorf("%s.%s: unsupported field type %q; add support to pbgen or list it in skipFields", c.Name, name, f.Type())
		}
		gc.Fields = append(gc.Fields, gf)
	}
	return gc, nil
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

func render(b *strings.Builder, pkg string, cols []genCollection) {
	p := func(format string, args ...any) { fmt.Fprintf(b, format, args...) }

	needTime := slices.ContainsFunc(cols, func(c genCollection) bool { return c.HasTimes })
	needMulti := slices.ContainsFunc(cols, func(c genCollection) bool {
		return slices.ContainsFunc(c.Fields, func(f genField) bool { return f.Multi })
	})

	p("// Code generated by internal/tools/pbgen from internal/migrations. DO NOT EDIT.\n")
	p("// Regenerate with `go generate ./...` after changing a migration.\n\n")
	p("package %s\n\nimport (\n", pkg)
	if needTime {
		p("\t\"time\"\n\n")
	}
	p("\t\"github.com/pocketbase/pocketbase/core\"\n)\n\n")

	p("// Collections lists every collection the typed layer depends on; see Verify.\n")
	p("var Collections = []CollectionSpec{\n")
	for _, c := range cols {
		p("\t%sSpec,\n", c.GoName)
	}
	p("}\n\n")

	for _, c := range cols {
		rec := c.GoName + "Record"
		id := c.GoName + "ID"

		p("// ---------------------------------------------------------------------------\n")
		p("// %s\n", c.Name)
		p("// ---------------------------------------------------------------------------\n\n")
		p("const %sCollection = %q\n\n", c.GoName, c.Name)
		p("// %s is the ID of a %q record.\n", id, c.Name)
		p("type %s string\n\n", id)
		p("// %s is a typed proxy for a %q record.\n", rec, c.Name)
		p("type %s struct {\n\tcore.BaseRecordProxy\n}\n\n", rec)
		p("var _ core.RecordProxy = (*%s)(nil)\n\n", rec)
		p("func (*%s) CollectionName() string { return %sCollection }\n\n", rec, c.GoName)
		p("func (r *%s) ID() %s { return %s(r.Id) }\n\n", rec, id, id)

		for _, f := range c.Fields {
			if f.Fallible {
				p("func (r *%s) %s() (%s, error) { return %s }\n\n", rec, f.GoName, f.GoType, f.Getter)
			} else {
				p("func (r *%s) %s() %s { return %s }\n\n", rec, f.GoName, f.GoType, f.Getter)
			}
			if f.Setter != "" {
				p("func (r *%s) Set%s(v %s) { %s }\n\n", rec, f.GoName, f.GoType, f.Setter)
			}
		}

		for _, f := range c.Fields {
			if f.Enum == nil {
				continue
			}
			e := f.Enum
			p("// %s mirrors the options of %s.%s.\n", e.GoName, c.Name, f.Name)
			p("type %s string\n\nconst (\n", e.GoName)
			for _, v := range e.Values {
				p("\t%s%s %s = %q\n", e.GoName, goName(v), e.GoName, v)
			}
			p(")\n\n")
			p("// %sValues lists every option of %s.%s.\n", e.GoName, c.Name, f.Name)
			p("var %sValues = []%s{", e.GoName, e.GoName)
			for i, v := range e.Values {
				if i > 0 {
					p(", ")
				}
				p("%s%s", e.GoName, goName(v))
			}
			p("}\n\n")
		}

		p("// %s holds typed column references for building %q queries.\n", c.GoName, c.Name)
		p("var %s = struct {\n\tID Column[%s]\n", c.GoName, id)
		for _, f := range c.Fields {
			if f.Column {
				p("\t%s Column[%s]\n", f.GoName, f.GoType)
			}
		}
		p("}{\n\tID: Column[%s]{name: \"id\"},\n", id)
		for _, f := range c.Fields {
			if f.Column {
				p("\t%s: Column[%s]{name: %q},\n", f.GoName, f.GoType, f.Name)
			}
		}
		p("}\n\n")

		p("var %sSpec = CollectionSpec{\n\tName: %q,\n\tType: %q,\n\tFields: []FieldSpec{\n", c.GoName, c.Name, c.Type)
		for _, f := range c.Fields {
			p("\t\t{Name: %q, Type: %q", f.Name, f.Type)
			if f.Multi {
				p(", Multi: true")
			}
			if f.OnlyInt {
				p(", OnlyInt: true")
			}
			if len(f.Values) > 0 {
				p(", Values: %#v", f.Values)
			}
			if f.Relation != "" {
				p(", Relation: %q", f.Relation)
			}
			p("},\n")
		}
		p("\t},\n}\n\n")
	}

	if needMulti {
		p("func stringsTo[T ~string](vs []string) []T {\n\tout := make([]T, len(vs))\n\tfor i, v := range vs {\n\t\tout[i] = T(v)\n\t}\n\treturn out\n}\n\n")
		p("func stringsFrom[T ~string](vs []T) []string {\n\tout := make([]string, len(vs))\n\tfor i, v := range vs {\n\t\tout[i] = string(v)\n\t}\n\treturn out\n}\n")
	}
}

var initialisms = map[string]string{"id": "ID", "url": "URL", "api": "API", "eta": "ETA"}

// goName converts snake_case / camelCase schema names to exported Go names.
func goName(s string) string {
	var out strings.Builder
	for part := range strings.FieldsFuncSeq(s, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	}) {
		if up, ok := initialisms[strings.ToLower(part)]; ok {
			out.WriteString(up)
			continue
		}
		r := []rune(part)
		r[0] = unicode.ToUpper(r[0])
		out.WriteString(string(r))
	}
	if out.Len() == 0 || unicode.IsDigit([]rune(out.String())[0]) {
		return "X" + out.String()
	}
	return out.String()
}
