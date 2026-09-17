package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/migrations"

	"felisa-cafe/backend/internal/models"
)

// seedProducts mirrors the PRODUCTS array in lib/menu.ts so the scaffold
// serves real menu data out of the box instead of an empty collection.
var seedProducts = []models.Product{
	{
		Slug: "felisa-latte", Name: "Felisa Latte", Category: "signature", Price: 8.5,
		Tagline:     "The one we named ourselves after.",
		Description: "Housemade ube syrup poured under your choice of espresso or matcha, so it layers violet into gold. Sweet, nutty, a little floral — this is the drink people come back for.",
		Ingredients: []string{"espresso or matcha", "housemade ube syrup", "choice of milk"},
		Size:        "16oz / matcha 12oz",
		Bases:       []string{"Espresso", "Matcha"},
		PourTop:     "#C08A5E", PourBottom: "#9B6BD8", Badge: "Signature",
	},
	{
		Slug: "mabuhay-mocha", Name: "Mabuhay Mocha", Category: "signature", Price: 8.5,
		Tagline:     "Chocolate sauce we cook in-house.",
		Description: "Our housemade chocolate sauce stirred into espresso or matcha and finished with the milk of your choice. Deep, cocoa-forward, never cloying.",
		Ingredients: []string{"espresso or matcha", "housemade chocolate sauce (contains dairy)", "choice of milk"},
		Size:        "16oz / matcha 12oz",
		Bases:       []string{"Espresso", "Matcha"},
		PourTop:     "#6F4530", PourBottom: "#C4A084", Badge: "Signature",
	},
	{
		Slug: "turon-milk-tea", Name: "Turon Milk Tea", Category: "signature", Price: 8.5,
		Tagline:     "Tastes like the street-corner dessert.",
		Description: "Assam black tea shaken with non-dairy creamer and our caramelized banana syrup. Toasty, jammy, and exactly as comforting as the turon it is named for.",
		Ingredients: []string{"assam black tea", "non-dairy creamer", "housemade caramelized banana syrup"},
		Size:        "16oz",
		PourTop:     "#C69A6D", PourBottom: "#E3C9A8", Badge: "Signature",
	},
	{
		Slug: "lubi-chai-latte", Name: "Lubi Chai Latte", Category: "signature", Price: 8.5,
		Tagline:     "Coconut, spice, blue-sky afternoons.",
		Description: "Organic chai concentrate with our housemade coconut syrup and the milk of your choice. Warming spice up front, toasted coconut on the finish.",
		Ingredients: []string{"organic chai concentrate", "housemade coconut syrup", "choice of milk"},
		Size:        "16oz",
		PourTop:     "#B08A63", PourBottom: "#EFE3D2", Badge: "Signature",
	},
	{
		Slug: "ube-syrup-bottle", Name: "Housemade Ube Syrup", Category: "pantry", Price: 16,
		Tagline:     "Take the purple home. 12oz bottle.",
		Description: "The same ube syrup we ladle into every Felisa Latte, bottled for your kitchen. Good in coffee, better on pancakes.",
		Ingredients: []string{"ube", "cane sugar", "coconut", "vanilla"},
		PourTop:     "#7B4FB5", PourBottom: "#B892E4",
	},
	{
		Slug: "banana-syrup-bottle", Name: "Caramelized Banana Syrup", Category: "pantry", Price: 16,
		Tagline:     "Turon in a bottle. 12oz.",
		Description: "Bananas cooked down with brown sugar until they taste like the inside of a turon. Pour it over ice, tea, or anything.",
		Ingredients: []string{"banana", "brown sugar", "cinnamon"},
		PourTop:     "#A9743F", PourBottom: "#DDBB8A",
	},
	{
		Slug: "cat-tote", Name: "Felisa Cat Tote", Category: "merch", Price: 22,
		Tagline:     "Heavyweight canvas, purple cat print.",
		Description: "A sturdy cotton tote screen-printed with the Felisa cat. Holds a laptop, a library run, and two iced drinks without complaint.",
		Ingredients: []string{"12oz cotton canvas", "screen-printed", "14in x 16in"},
		PourTop:     "#8E6BC8", PourBottom: "#D9C7F0",
	},
	{
		Slug: "sticker-pack", Name: "Doodle Sticker Pack", Category: "merch", Price: 8,
		Tagline:     "Six vinyl stickers, all hand-drawn.",
		Description: "The cat, the sparkles, the whole lettered logo — six waterproof vinyl stickers drawn by the same hand that draws our menus.",
		Ingredients: []string{"6 stickers", "waterproof vinyl", "dishwasher safe"},
		PourTop:     "#B48AE6", PourBottom: "#EADDF8",
	},
}

func init() {
	migrations.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("products")
		if err != nil {
			return err
		}

		for _, p := range seedProducts {
			record := core.NewRecord(collection)
			p.ApplyToRecord(record)

			if err := app.Save(record); err != nil {
				return err
			}
		}

		return nil
	}, func(app core.App) error {
		for _, p := range seedProducts {
			record, err := app.FindFirstRecordByFilter("products", "slug = {:slug}", map[string]any{"slug": p.Slug})
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
