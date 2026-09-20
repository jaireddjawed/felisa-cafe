<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Actions\Catalog\SyncSquareCatalog;
use App\Enums\CatalogStatus;
use App\Enums\ProductCategory;
use App\Models\ModifierList;
use App\Models\Product;
use Illuminate\Database\Seeder;

/**
 * The real Felisa menu, so the storefront is browsable before anyone connects
 * Square.
 *
 * These products carry no Square item ID. They are complete enough to render
 * and add to a cart, but checkout still needs Square, because only Square can
 * price and charge an order.
 *
 * The first `square:sync-catalog` matches each of these by name or slug and
 * adopts it, attaching Square's IDs, prices and variations to this
 * hand-written copy rather than creating duplicates alongside it.
 *
 * @see SyncSquareCatalog
 */
class MenuSeeder extends Seeder
{
    public function run(): void
    {
        $listIds = $this->seedModifierLists();

        foreach ($this->products() as $sortOrder => $attributes) {
            $variations = $attributes['variations'];
            $listSlugs = $attributes['modifier_lists'];
            unset($attributes['variations'], $attributes['modifier_lists']);

            $product = Product::query()->updateOrCreate(
                ['slug' => $attributes['slug']],
                [...$attributes, 'status' => CatalogStatus::Active, 'sort_order' => $sortOrder],
            );

            foreach ($variations as $ordinal => $variation) {
                $product->variations()->updateOrCreate(
                    ['square_variation_id' => "seed-{$product->slug}-{$ordinal}"],
                    [...$variation, 'ordinal' => $ordinal, 'sellable' => true],
                );
            }

            // These products have no Square item-level overrides, so each
            // list applies with its own limits ("exactly one milk").
            $attach = [];

            foreach ($listSlugs as $position => $slug) {
                $list = $listIds[$slug];

                $attach[$list->id] = [
                    'position' => $position,
                    'min_selected' => $list->min_selected,
                    'max_selected' => $list->max_selected,
                ];
            }

            $product->modifierLists()->sync($attach);
        }
    }

    /**
     * @return array<string, ModifierList> keyed by the seed's own list ID
     */
    private function seedModifierLists(): array
    {
        $ids = [];

        foreach ($this->modifierLists() as $list) {
            $modifierList = ModifierList::query()->updateOrCreate(
                ['square_modifier_list_id' => $list['id']],
                ['name' => $list['name'], 'min_selected' => $list['min'], 'max_selected' => $list['max']],
            );

            foreach ($list['modifiers'] as $ordinal => $modifier) {
                $modifierList->modifiers()->updateOrCreate(
                    ['square_modifier_id' => $modifier['id']],
                    ['name' => $modifier['name'], 'price_cents' => 0, 'ordinal' => $ordinal],
                );
            }

            $ids[$list['id']] = $modifierList;
        }

        return $ids;
    }

    /**
     * Every milk is free, which is a deliberate part of the menu.
     *
     * @return list<array{id: string, name: string, min: int, max: int, modifiers: list<array{id: string, name: string}>}>
     */
    private function modifierLists(): array
    {
        return [
            [
                'id' => 'seed-milk',
                'name' => 'Milk',
                'min' => 1,
                'max' => 1,
                'modifiers' => [
                    ['id' => 'seed-milk-whole', 'name' => 'Whole Milk'],
                    ['id' => 'seed-milk-oat', 'name' => 'Oat Milk'],
                    ['id' => 'seed-milk-almond', 'name' => 'Almond Milk'],
                    ['id' => 'seed-milk-coconut', 'name' => 'Coconut Milk'],
                    ['id' => 'seed-milk-nonfat', 'name' => 'Non-Fat Milk'],
                ],
            ],
            [
                'id' => 'seed-add-ons',
                'name' => 'Add-Ons',
                'min' => 0,
                'max' => 0,
                'modifiers' => [
                    ['id' => 'seed-add-maple-foam', 'name' => 'Maple Cold Foam'],
                    ['id' => 'seed-add-ube-cream', 'name' => 'Ube Whipped Cream'],
                ],
            ],
        ];
    }

    /**
     * @return list<array{
     *     slug: string,
     *     name: string,
     *     category: ProductCategory,
     *     tagline: string,
     *     description: string,
     *     ingredients: list<string>,
     *     size: string,
     *     pour_top: string,
     *     pour_bottom: string,
     *     badge: string,
     *     variations: list<array{name: string, price_cents: int}>,
     *     modifier_lists: list<string>,
     * }>
     */
    private function products(): array
    {
        return [
            [
                'slug' => 'felisa-latte',
                'name' => 'Felisa Latte',
                'category' => ProductCategory::Signature,
                'tagline' => 'The one we named ourselves after.',
                'description' => 'Housemade ube syrup poured under your choice of espresso or matcha, so it layers violet into gold. Sweet, nutty, a little floral — this is the drink people come back for.',
                'ingredients' => ['espresso or matcha', 'housemade ube syrup', 'choice of milk'],
                'size' => '16oz / matcha 12oz',
                'pour_top' => '#C08A5E',
                'pour_bottom' => '#9B6BD8',
                'badge' => 'Signature',
                'variations' => [['name' => 'Espresso', 'price_cents' => 850], ['name' => 'Matcha', 'price_cents' => 850]],
                'modifier_lists' => ['seed-milk', 'seed-add-ons'],
            ],
            [
                'slug' => 'mabuhay-mocha',
                'name' => 'Mabuhay Mocha',
                'category' => ProductCategory::Signature,
                'tagline' => 'Chocolate sauce we cook in-house.',
                'description' => 'Our housemade chocolate sauce stirred into espresso or matcha and finished with the milk of your choice. Deep, cocoa-forward, never cloying.',
                'ingredients' => ['espresso or matcha', 'housemade chocolate sauce (contains dairy)', 'choice of milk'],
                'size' => '16oz / matcha 12oz',
                'pour_top' => '#6F4530',
                'pour_bottom' => '#C4A084',
                'badge' => 'Signature',
                'variations' => [['name' => 'Espresso', 'price_cents' => 850], ['name' => 'Matcha', 'price_cents' => 850]],
                'modifier_lists' => ['seed-milk', 'seed-add-ons'],
            ],
            [
                'slug' => 'turon-milk-tea',
                'name' => 'Turon Milk Tea',
                'category' => ProductCategory::Signature,
                'tagline' => 'Tastes like the street-corner dessert.',
                'description' => 'Assam black tea shaken with non-dairy creamer and our caramelized banana syrup. Toasty, jammy, and exactly as comforting as the turon it is named for.',
                'ingredients' => ['assam black tea', 'non-dairy creamer', 'housemade caramelized banana syrup'],
                'size' => '16oz',
                'pour_top' => '#C69A6D',
                'pour_bottom' => '#E3C9A8',
                'badge' => 'Signature',
                'variations' => [['name' => 'Regular', 'price_cents' => 850]],
                'modifier_lists' => ['seed-add-ons'],
            ],
            [
                'slug' => 'lubi-chai-latte',
                'name' => 'Lubi Chai Latte',
                'category' => ProductCategory::Signature,
                'tagline' => 'Coconut, spice, blue-sky afternoons.',
                'description' => 'Organic chai concentrate with our housemade coconut syrup and the milk of your choice. Warming spice up front, toasted coconut on the finish.',
                'ingredients' => ['organic chai concentrate', 'housemade coconut syrup', 'choice of milk'],
                'size' => '16oz',
                'pour_top' => '#B08A63',
                'pour_bottom' => '#EFE3D2',
                'badge' => 'Signature',
                'variations' => [['name' => 'Regular', 'price_cents' => 850]],
                'modifier_lists' => ['seed-milk', 'seed-add-ons'],
            ],
            [
                'slug' => 'classic-matcha-latte',
                'name' => 'Classic Matcha Latte',
                'category' => ProductCategory::Matcha,
                'tagline' => 'First-harvest Uji matcha, no detours.',
                'description' => '3g of first-harvest Yutaka Midori matcha whisked with your choice of milk. Fragrant, creamy umami with notes of sweet roasted chestnut — nothing else in the way.',
                'ingredients' => ['3g first-harvest matcha (Uji, Japan)', 'choice of milk'],
                'size' => '12oz',
                'pour_top' => '#5C7A3F',
                'pour_bottom' => '#D9E4C3',
                'badge' => 'Matcha',
                'variations' => [['name' => 'Regular', 'price_cents' => 850]],
                'modifier_lists' => ['seed-milk', 'seed-add-ons'],
            ],
            [
                'slug' => 'matcha-cano',
                'name' => 'Matcha-cano',
                'category' => ProductCategory::Matcha,
                'tagline' => 'Matcha, straight, over water.',
                'description' => 'The matcha-cano treatment: 3g of first-harvest Uji matcha shaken with water instead of milk, so the umami and roasted-chestnut sweetness carry the whole cup.',
                'ingredients' => ['3g first-harvest matcha (Uji, Japan)', 'water'],
                'size' => '12oz',
                'pour_top' => '#3F5C2E',
                'pour_bottom' => '#8FAE6B',
                'badge' => 'Matcha',
                'variations' => [['name' => 'Regular', 'price_cents' => 800]],
                'modifier_lists' => [],
            ],
            [
                'slug' => 'vanilla-matcha-latte',
                'name' => 'Vanilla Matcha Latte',
                'category' => ProductCategory::Matcha,
                'tagline' => 'Matcha with a warm vanilla edge.',
                'description' => 'First-harvest matcha and our housemade vanilla bean syrup, finished with your choice of milk. Rounds out the matcha\'s umami with something sweeter and softer.',
                'ingredients' => ['3g first-harvest matcha (Uji, Japan)', 'housemade vanilla bean syrup', 'choice of milk'],
                'size' => '12oz',
                'pour_top' => '#5C7A3F',
                'pour_bottom' => '#F1E4C3',
                'badge' => 'Matcha',
                'variations' => [['name' => 'Regular', 'price_cents' => 850]],
                'modifier_lists' => ['seed-milk', 'seed-add-ons'],
            ],
            [
                'slug' => 'turon-matcha-latte',
                'name' => 'Turon Matcha Latte',
                'category' => ProductCategory::Matcha,
                'tagline' => 'The turon flavor, matcha base.',
                'description' => 'First-harvest matcha and our caramelized banana syrup, choice of milk. Same toasty, jammy turon flavor as the milk tea version, built on matcha instead of black tea.',
                'ingredients' => ['3g first-harvest matcha (Uji, Japan)', 'housemade caramelized banana syrup', 'choice of milk'],
                'size' => '12oz',
                'pour_top' => '#5C7A3F',
                'pour_bottom' => '#DDBB8A',
                'badge' => 'Matcha',
                'variations' => [['name' => 'Regular', 'price_cents' => 850]],
                'modifier_lists' => ['seed-milk', 'seed-add-ons'],
            ],
            [
                'slug' => 'lubi-matcha-latte',
                'name' => 'Lubi Matcha Latte',
                'category' => ProductCategory::Matcha,
                'tagline' => 'Coconut and matcha, iced.',
                'description' => 'First-harvest matcha with our housemade coconut syrup and choice of milk — coconut milk recommended for the fullest coconut flavor.',
                'ingredients' => ['3g first-harvest matcha (Uji, Japan)', 'housemade coconut syrup', 'choice of milk (coconut milk recommended)'],
                'size' => '12oz',
                'pour_top' => '#5C7A3F',
                'pour_bottom' => '#EFE3D2',
                'badge' => 'Matcha',
                'variations' => [['name' => 'Regular', 'price_cents' => 850]],
                'modifier_lists' => ['seed-milk', 'seed-add-ons'],
            ],
            [
                'slug' => 'ube-syrup-bottle',
                'name' => 'Housemade Ube Syrup',
                'category' => ProductCategory::Pantry,
                'tagline' => 'Take the purple home. 12oz bottle.',
                'description' => 'The same ube syrup we ladle into every Felisa Latte, bottled for your kitchen. Good in coffee, better on pancakes.',
                'ingredients' => ['ube', 'cane sugar', 'coconut', 'vanilla'],
                'size' => '',
                'pour_top' => '#7B4FB5',
                'pour_bottom' => '#B892E4',
                'badge' => '',
                'variations' => [['name' => 'Regular', 'price_cents' => 1600]],
                'modifier_lists' => [],
            ],
            [
                'slug' => 'banana-syrup-bottle',
                'name' => 'Caramelized Banana Syrup',
                'category' => ProductCategory::Pantry,
                'tagline' => 'Turon in a bottle. 12oz.',
                'description' => 'Bananas cooked down with brown sugar until they taste like the inside of a turon. Pour it over ice, tea, or anything.',
                'ingredients' => ['banana', 'brown sugar', 'cinnamon'],
                'size' => '',
                'pour_top' => '#A9743F',
                'pour_bottom' => '#DDBB8A',
                'badge' => '',
                'variations' => [['name' => 'Regular', 'price_cents' => 1600]],
                'modifier_lists' => [],
            ],
            [
                'slug' => 'cat-tote',
                'name' => 'Felisa Cat Tote',
                'category' => ProductCategory::Merch,
                'tagline' => 'Heavyweight canvas, purple cat print.',
                'description' => 'A sturdy cotton tote screen-printed with the Felisa cat. Holds a laptop, a library run, and two iced drinks without complaint.',
                'ingredients' => ['12oz cotton canvas', 'screen-printed', '14in x 16in'],
                'size' => '',
                'pour_top' => '#8E6BC8',
                'pour_bottom' => '#D9C7F0',
                'badge' => '',
                'variations' => [['name' => 'Regular', 'price_cents' => 2200]],
                'modifier_lists' => [],
            ],
            [
                'slug' => 'sticker-pack',
                'name' => 'Doodle Sticker Pack',
                'category' => ProductCategory::Merch,
                'tagline' => 'Six vinyl stickers, all hand-drawn.',
                'description' => 'The cat, the sparkles, the whole lettered logo — six waterproof vinyl stickers drawn by the same hand that draws our menus.',
                'ingredients' => ['6 stickers', 'waterproof vinyl', 'dishwasher safe'],
                'size' => '',
                'pour_top' => '#B48AE6',
                'pour_bottom' => '#EADDF8',
                'badge' => '',
                'variations' => [['name' => 'Regular', 'price_cents' => 800]],
                'modifier_lists' => [],
            ],
        ];
    }
}
