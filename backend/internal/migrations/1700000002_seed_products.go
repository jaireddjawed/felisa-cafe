package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/migrations"
)

// seedProducts mirrors the PRODUCTS array in lib/menu.ts so the scaffold
// serves real menu data out of the box instead of an empty collection.
var seedProducts = []struct {
	slug        string
	name        string
	category    string
	price       float64
	tagline     string
	description string
	ingredients []string
	size        string
	bases       []string
	pourTop     string
	pourBottom  string
	badge       string
}{
	{
		slug: "felisa-latte", name: "Felisa Latte", category: "signature", price: 8.5,
		tagline:     "The one we named ourselves after.",
		description: "Housemade ube syrup poured under your choice of espresso or matcha, so it layers violet into gold. Sweet, nutty, a little floral — this is the drink people come back for.",
		ingredients: []string{"espresso or matcha", "housemade ube syrup", "choice of milk"},
		size:        "16oz / matcha 12oz",
		bases:       []string{"Espresso", "Matcha"},
		pourTop:     "#C08A5E", pourBottom: "#9B6BD8", badge: "Signature",
	},
	{
		slug: "mabuhay-mocha", name: "Mabuhay Mocha", category: "signature", price: 8.5,
		tagline:     "Chocolate sauce we cook in-house.",
		description: "Our housemade chocolate sauce stirred into espresso or matcha and finished with the milk of your choice. Deep, cocoa-forward, never cloying.",
		ingredients: []string{"espresso or matcha", "housemade chocolate sauce (contains dairy)", "choice of milk"},
		size:        "16oz / matcha 12oz",
		bases:       []string{"Espresso", "Matcha"},
		pourTop:     "#6F4530", pourBottom: "#C4A084", badge: "Signature",
	},
	{
		slug: "turon-milk-tea", name: "Turon Milk Tea", category: "signature", price: 8.5,
		tagline:     "Tastes like the street-corner dessert.",
		description: "Assam black tea shaken with non-dairy creamer and our caramelized banana syrup. Toasty, jammy, and exactly as comforting as the turon it is named for.",
		ingredients: []string{"assam black tea", "non-dairy creamer", "housemade caramelized banana syrup"},
		size:        "16oz",
		pourTop:     "#C69A6D", pourBottom: "#E3C9A8", badge: "Signature",
	},
	{
		slug: "lubi-chai-latte", name: "Lubi Chai Latte", category: "signature", price: 8.5,
		tagline:     "Coconut, spice, blue-sky afternoons.",
		description: "Organic chai concentrate with our housemade coconut syrup and the milk of your choice. Warming spice up front, toasted coconut on the finish.",
		ingredients: []string{"organic chai concentrate", "housemade coconut syrup", "choice of milk"},
		size:        "16oz",
		pourTop:     "#B08A63", pourBottom: "#EFE3D2", badge: "Signature",
	},
	{
		slug: "ube-syrup-bottle", name: "Housemade Ube Syrup", category: "pantry", price: 16,
		tagline:     "Take the purple home. 12oz bottle.",
		description: "The same ube syrup we ladle into every Felisa Latte, bottled for your kitchen. Good in coffee, better on pancakes.",
		ingredients: []string{"ube", "cane sugar", "coconut", "vanilla"},
		pourTop:     "#7B4FB5", pourBottom: "#B892E4",
	},
	{
		slug: "banana-syrup-bottle", name: "Caramelized Banana Syrup", category: "pantry", price: 16,
		tagline:     "Turon in a bottle. 12oz.",
		description: "Bananas cooked down with brown sugar until they taste like the inside of a turon. Pour it over ice, tea, or anything.",
		ingredients: []string{"banana", "brown sugar", "cinnamon"},
		pourTop:     "#A9743F", pourBottom: "#DDBB8A",
	},
	{
		slug: "cat-tote", name: "Felisa Cat Tote", category: "merch", price: 22,
		tagline:     "Heavyweight canvas, purple cat print.",
		description: "A sturdy cotton tote screen-printed with the Felisa cat. Holds a laptop, a library run, and two iced drinks without complaint.",
		ingredients: []string{"12oz cotton canvas", "screen-printed", "14in x 16in"},
		pourTop:     "#8E6BC8", pourBottom: "#D9C7F0",
	},
	{
		slug: "sticker-pack", name: "Doodle Sticker Pack", category: "merch", price: 8,
		tagline:     "Six vinyl stickers, all hand-drawn.",
		description: "The cat, the sparkles, the whole lettered logo — six waterproof vinyl stickers drawn by the same hand that draws our menus.",
		ingredients: []string{"6 stickers", "waterproof vinyl", "dishwasher safe"},
		pourTop:     "#B48AE6", pourBottom: "#EADDF8",
	},
}

func init() {
	migrations.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("products")
		if err != nil {
			return err
		}

		for _, sp := range seedProducts {
			record := core.NewRecord(collection)
			record.Set("slug", sp.slug)
			record.Set("name", sp.name)
			record.Set("category", sp.category)
			record.Set("price", sp.price)
			record.Set("tagline", sp.tagline)
			record.Set("description", sp.description)
			record.Set("ingredients", sp.ingredients)
			record.Set("size", sp.size)
			record.Set("bases", sp.bases)
			record.Set("pour_top", sp.pourTop)
			record.Set("pour_bottom", sp.pourBottom)
			record.Set("badge", sp.badge)

			if err := app.Save(record); err != nil {
				return err
			}
		}

		return nil
	}, func(app core.App) error {
		for _, sp := range seedProducts {
			record, err := app.FindFirstRecordByFilter("products", "slug = {:slug}", map[string]any{"slug": sp.slug})
			if err != nil {
				continue
			}
			if err := app.Delete(record); err != nil {
				return err
			}
		}
		return nil
	})
}
