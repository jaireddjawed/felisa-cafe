<?php

declare(strict_types=1);

use App\Actions\Catalog\SyncResult;
use App\Actions\Catalog\SyncSquareCatalog;
use App\Enums\CatalogStatus;
use App\Enums\ProductCategory;
use App\Models\Modifier;
use App\Models\ModifierList;
use App\Models\Product;
use App\Models\ProductVariation;
use App\Square\SquareUnavailableException;
use Tests\Support\FakeSquare;

function sync(): SyncResult
{
    return app(SyncSquareCatalog::class)->handle();
}

/** The standard one-item catalog used by most of these tests. */
function fakeLatteCatalog(int $priceCents = 850, string $name = 'Felisa Latte'): void
{
    FakeSquare::fakeCatalog(
        FakeSquare::category('CAT_SIG', 'Signature Drinks'),
        FakeSquare::item(
            id: 'ITEM_LATTE',
            name: $name,
            variations: [FakeSquare::variation('VAR_ESPRESSO', 'Espresso', $priceCents, 'ITEM_LATTE')],
            categoryId: 'CAT_SIG',
        ),
    );
}

it('imports products, variations and prices from Square', function (): void {
    fakeLatteCatalog();

    $result = sync();

    expect($result->created)->toBe(1);

    $product = Product::query()->with('variations')->firstOrFail();

    expect($product->name)->toBe('Felisa Latte')
        ->and($product->slug)->toBe('felisa-latte')
        ->and($product->square_item_id)->toBe('ITEM_LATTE')
        ->and($product->status)->toBe(CatalogStatus::Active)
        ->and($product->category)->toBe(ProductCategory::Signature)
        ->and($product->variations)->toHaveCount(1)
        ->and($product->variations->firstOrFail()->price_cents)->toBe(850);
});

it('is idempotent: syncing twice updates rather than duplicates', function (): void {
    fakeLatteCatalog();

    sync();
    $second = sync();

    expect($second->created)->toBe(0)
        ->and($second->updated)->toBe(1)
        ->and(Product::query()->count())->toBe(1)
        ->and(ProductVariation::query()->count())->toBe(1);
});

it('applies price changes from Square on the next sync', function (): void {
    fakeLatteCatalog(850);
    sync();

    fakeLatteCatalog(950);
    sync();

    expect(ProductVariation::query()->firstOrFail()->price_cents)->toBe(950);
});

it('adopts hand-seeded local copy instead of creating a duplicate', function (): void {
    // What MenuSeeder leaves behind: local presentation metadata, no Square ID.
    $seeded = Product::factory()->unlinked()->create([
        'name' => 'Felisa Latte',
        'slug' => 'felisa-latte',
        'tagline' => 'The one we named ourselves after.',
        'pour_top' => '#C08A5E',
    ]);

    fakeLatteCatalog();

    $result = sync();

    expect($result->linked)->toBe(1)
        ->and($result->created)->toBe(0)
        ->and(Product::query()->count())->toBe(1);

    $seeded->refresh();

    expect($seeded->square_item_id)->toBe('ITEM_LATTE')
        ->and($seeded->status)->toBe(CatalogStatus::Active)
        // Locally-owned copy survives the sync.
        ->and($seeded->tagline)->toBe('The one we named ourselves after.')
        ->and($seeded->pour_top)->toBe('#C08A5E');
});

it('never overwrites locally-owned presentation metadata', function (): void {
    fakeLatteCatalog();
    sync();

    $product = Product::query()->firstOrFail();
    $product->update(['tagline' => 'Written by us', 'badge' => 'Signature', 'sort_order' => 3]);

    fakeLatteCatalog();
    sync();

    $product->refresh();

    expect($product->tagline)->toBe('Written by us')
        ->and($product->badge)->toBe('Signature')
        ->and($product->sort_order)->toBe(3);
});

it('does not let an empty Square description erase local copy', function (): void {
    fakeLatteCatalog();
    sync();

    Product::query()->firstOrFail()->update(['description' => 'Our own words.']);

    // Square sends no description at all.
    fakeLatteCatalog();
    sync();

    expect(Product::query()->firstOrFail()->description)->toBe('Our own words.');
});

it('archives items Square no longer offers at our location', function (): void {
    fakeLatteCatalog();
    sync();

    FakeSquare::fakeCatalog(
        FakeSquare::item(
            id: 'ITEM_LATTE',
            name: 'Felisa Latte',
            variations: [FakeSquare::variation('VAR_ESPRESSO', 'Espresso', 850, 'ITEM_LATTE')],
            archived: true,
        ),
    );
    sync();

    expect(Product::query()->firstOrFail()->status)->toBe(CatalogStatus::Archived);
});

it('marks items missing from Square as deleted but keeps their metadata', function (): void {
    fakeLatteCatalog();
    sync();

    // Square stops returning the item entirely.
    FakeSquare::fakeCatalog();
    $result = sync();

    $product = Product::query()->firstOrFail();

    expect($result->deleted)->toBe(1)
        ->and($product->status)->toBe(CatalogStatus::Deleted)
        // Kept, not hard-deleted, so the copy survives if Square brings it back.
        ->and($product->name)->toBe('Felisa Latte');
});

it('brings a deleted product back when Square returns it', function (): void {
    fakeLatteCatalog();
    sync();

    FakeSquare::fakeCatalog();
    sync();

    fakeLatteCatalog();
    sync();

    expect(Product::query()->count())->toBe(1)
        ->and(Product::query()->firstOrFail()->status)->toBe(CatalogStatus::Active);
});

it('removes variations Square dropped', function (): void {
    FakeSquare::fakeCatalog(
        FakeSquare::item('ITEM_LATTE', 'Felisa Latte', [
            FakeSquare::variation('VAR_ESPRESSO', 'Espresso', 850, 'ITEM_LATTE'),
            FakeSquare::variation('VAR_MATCHA', 'Matcha', 850, 'ITEM_LATTE', ordinal: 1),
        ]),
    );
    sync();

    expect(ProductVariation::query()->count())->toBe(2);

    fakeLatteCatalog();
    sync();

    expect(ProductVariation::query()->count())->toBe(1)
        ->and(ProductVariation::query()->firstOrFail()->square_variation_id)
        ->toBe('VAR_ESPRESSO');
});

it('marks variable-priced variations as unsellable online', function (): void {
    FakeSquare::fakeCatalog(
        FakeSquare::item('ITEM_X', 'Ask The Barista', [
            FakeSquare::variation('VAR_ASK', 'Ask', 0, 'ITEM_X', pricingType: 'VARIABLE_PRICING'),
        ]),
    );

    sync();

    expect(ProductVariation::query()->firstOrFail()->sellable)->toBeFalse()
        ->and(Product::query()->with('variations')->firstOrFail()->isPurchasable())->toBeFalse();
});

it('imports modifier lists with their selection limits', function (): void {
    FakeSquare::fakeCatalog(
        FakeSquare::modifierList('ML_MILK', 'Milk', [
            ['id' => 'MOD_OAT', 'name' => 'Oat Milk'],
            ['id' => 'MOD_WHOLE', 'name' => 'Whole Milk'],
        ], minSelected: 1, maxSelected: 1),
        FakeSquare::item(
            id: 'ITEM_LATTE',
            name: 'Felisa Latte',
            variations: [FakeSquare::variation('VAR_ESPRESSO', 'Espresso', 850, 'ITEM_LATTE')],
            modifierListIds: ['ML_MILK'],
        ),
    );

    sync();

    $list = ModifierList::query()->with('modifiers')->firstOrFail();

    expect($list->name)->toBe('Milk')
        ->and($list->min_selected)->toBe(1)
        ->and($list->max_selected)->toBe(1)
        ->and($list->modifiers)->toHaveCount(2);

    $product = Product::query()->with('modifierLists')->firstOrFail();

    expect($product->modifierLists)->toHaveCount(1)
        ->and($product->modifierLists->firstOrFail()->limitsForProduct())->toBe([1, 1]);
});

it('keeps modifier lists in step across repeated syncs', function (): void {
    $catalog = fn (array $modifiers) => FakeSquare::fakeCatalog(
        FakeSquare::modifierList('ML_MILK', 'Milk', $modifiers, minSelected: 1, maxSelected: 1),
        FakeSquare::item(
            id: 'ITEM_LATTE',
            name: 'Felisa Latte',
            variations: [FakeSquare::variation('VAR_ESPRESSO', 'Espresso', 850, 'ITEM_LATTE')],
            modifierListIds: ['ML_MILK'],
        ),
    );

    $catalog([['id' => 'MOD_OAT', 'name' => 'Oat Milk'], ['id' => 'MOD_SOY', 'name' => 'Soy Milk']]);
    sync();

    $catalog([['id' => 'MOD_OAT', 'name' => 'Oat Milk']]);
    sync();

    expect(Modifier::query()->count())->toBe(1)
        ->and(ModifierList::query()->count())->toBe(1);
});

it('records items whose Square category maps to no menu section', function (): void {
    FakeSquare::fakeCatalog(
        FakeSquare::category('CAT_X', 'Seasonal Specials'),
        FakeSquare::item(
            id: 'ITEM_X',
            name: 'Mystery Drink',
            variations: [FakeSquare::variation('VAR_X', 'Regular', 850, 'ITEM_X')],
            categoryId: 'CAT_X',
        ),
    );

    $result = sync();

    expect($result->uncategorized)->toBe(['Mystery Drink'])
        ->and(Product::query()->firstOrFail()->category)->toBeNull();
});

it('gives products with the same name distinct slugs', function (): void {
    FakeSquare::fakeCatalog(
        FakeSquare::item('ITEM_A', 'House Blend', [FakeSquare::variation('VAR_A', 'Regular', 850, 'ITEM_A')]),
        FakeSquare::item('ITEM_B', 'House Blend', [FakeSquare::variation('VAR_B', 'Regular', 950, 'ITEM_B')]),
    );

    sync();

    expect(Product::query()->pluck('slug')->all())->toBe(['house-blend', 'house-blend-2']);
});

it('leaves the catalog untouched when Square is unreachable', function (): void {
    fakeLatteCatalog();
    sync();

    FakeSquare::fake(['/v2/catalog/list*' => Http::response('', 503)]);

    expect(fn () => sync())->toThrow(SquareUnavailableException::class);

    // The previous catalog is still intact and still servable.
    expect(Product::query()->firstOrFail()->status)->toBe(CatalogStatus::Active);
});

it('is exposed as an artisan command', function (): void {
    fakeLatteCatalog();

    $this->artisan('square:sync-catalog')
        ->expectsOutputToContain('created=1')
        ->assertSuccessful();

    expect(Product::query()->count())->toBe(1);
});

it('reports failure from the artisan command rather than throwing', function (): void {
    FakeSquare::fake(['/v2/catalog/list*' => Http::response('', 500)]);

    $this->artisan('square:sync-catalog')->assertFailed();
});
