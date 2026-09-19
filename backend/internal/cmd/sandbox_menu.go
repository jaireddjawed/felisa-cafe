package cmd

import "felisa-cafe/backend/internal/providers/payments/square"

// The starter menu written into a Square sandbox by `catalog seed-sandbox`.
// Development data only: in production the menu is managed in the Square
// Dashboard. Names match the locally-seeded products so the first sync
// adopts their presentation metadata (pour colors, taglines, ...).

var sandboxModifierLists = []square.SeedModifierList{
	{
		// Exactly one milk, always free.
		Name: "Milk", Min: 1, Max: 1,
		Modifiers: []square.SeedModifier{
			{Name: "Whole Milk"}, {Name: "Oat Milk"}, {Name: "Almond Milk"}, {Name: "Coconut Milk"}, {Name: "Non-Fat Milk"},
		},
	},
	{
		// Any number of add-ons.
		Name: "Add-Ons", Min: 0, Max: 0,
		Modifiers: []square.SeedModifier{
			{Name: "Maple Cold Foam", Price: 100}, {Name: "Ube Whipped Cream", Price: 100},
		},
	},
}

var (
	espressoOrMatcha = []square.SeedModifier{{Name: "Espresso", Price: 850}, {Name: "Matcha", Price: 850}}
	milkDrink        = []string{"Milk", "Add-Ons"}
)

func regular(price int64) []square.SeedModifier {
	return []square.SeedModifier{{Name: "Regular", Price: price}}
}

var sandboxItems = []square.SeedItem{
	{Name: "Felisa Latte", Category: "Signature", Variations: espressoOrMatcha, ModifierLists: milkDrink,
		Description: "Housemade ube syrup poured under your choice of espresso or matcha, so it layers violet into gold. Sweet, nutty, a little floral — this is the drink people come back for."},
	{Name: "Mabuhay Mocha", Category: "Signature", Variations: espressoOrMatcha, ModifierLists: milkDrink,
		Description: "Our housemade chocolate sauce stirred into espresso or matcha and finished with the milk of your choice. Deep, cocoa-forward, never cloying."},
	{Name: "Turon Milk Tea", Category: "Signature", Variations: regular(850), ModifierLists: []string{"Add-Ons"},
		Description: "Assam black tea shaken with non-dairy creamer and our caramelized banana syrup. Toasty, jammy, and exactly as comforting as the turon it is named for."},
	{Name: "Lubi Chai Latte", Category: "Signature", Variations: regular(850), ModifierLists: milkDrink,
		Description: "Organic chai concentrate with our housemade coconut syrup and the milk of your choice. Warming spice up front, toasted coconut on the finish."},

	{Name: "Classic Matcha Latte", Category: "Matcha", Variations: regular(850), ModifierLists: milkDrink,
		Description: "3g of first-harvest Yutaka Midori matcha whisked with your choice of milk. Fragrant, creamy umami with notes of sweet roasted chestnut — nothing else in the way."},
	{Name: "Matcha-cano", Category: "Matcha", Variations: regular(800),
		Description: "The matcha-cano treatment: 3g of first-harvest Uji matcha shaken with water instead of milk, so the umami and roasted-chestnut sweetness carry the whole cup."},
	{Name: "Vanilla Matcha Latte", Category: "Matcha", Variations: regular(850), ModifierLists: milkDrink,
		Description: "First-harvest matcha and our housemade vanilla bean syrup, finished with your choice of milk. Rounds out the matcha's umami with something sweeter and softer."},
	{Name: "Turon Matcha Latte", Category: "Matcha", Variations: regular(850), ModifierLists: milkDrink,
		Description: "First-harvest matcha and our caramelized banana syrup, choice of milk. Same toasty, jammy turon flavor as the milk tea version, built on matcha instead of black tea."},
	{Name: "Lubi Matcha Latte", Category: "Matcha", Variations: regular(850), ModifierLists: milkDrink,
		Description: "First-harvest matcha with our housemade coconut syrup and choice of milk — coconut milk recommended for the fullest coconut flavor."},

	{Name: "Housemade Ube Syrup", Category: "Pantry", Variations: regular(1600),
		Description: "The same ube syrup we ladle into every Felisa Latte, bottled for your kitchen. Good in coffee, better on pancakes."},
	{Name: "Caramelized Banana Syrup", Category: "Pantry", Variations: regular(1600),
		Description: "Bananas cooked down with brown sugar until they taste like the inside of a turon. Pour it over ice, tea, or anything."},

	{Name: "Felisa Cat Tote", Category: "Merch", Variations: regular(2200),
		Description: "A sturdy cotton tote screen-printed with the Felisa cat. Holds a laptop, a library run, and two iced drinks without complaint."},
	{Name: "Doodle Sticker Pack", Category: "Merch", Variations: regular(800),
		Description: "The cat, the sparkles, the whole lettered logo — six waterproof vinyl stickers drawn by the same hand that draws our menus."},
}

func sandboxItemsInCategory(category string) []square.SeedItem {
	items := make([]square.SeedItem, 0)
	for _, item := range sandboxItems {
		if item.Category == category {
			items = append(items, item)
		}
	}
	return items
}
