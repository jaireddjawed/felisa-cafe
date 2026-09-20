<?php

declare(strict_types=1);

use App\Enums\ProductCategory;
use App\Models\Modifier;
use App\Models\ModifierList;
use App\Models\Product;
use App\Models\ProductVariation;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakeSquare;

function outgoingCatalogPush(): array
{
    $record = collect(Http::recorded())
        ->first(fn (array $record): bool => str_contains((string) $record[0]->url(), '/v2/catalog/batch-upsert'));

    expect($record)->not->toBeNull();

    /** @var Request $request */
    $request = $record[0];

    return $request->data();
}

it('pushes unlinked local products into Square catalog objects', function (): void {
    $product = Product::factory()->unlinked()->create([
        'name' => 'Felisa Latte',
        'slug' => 'felisa-latte',
        'description' => 'Housemade ube syrup.',
        'category' => ProductCategory::Signature,
        'sort_order' => 1,
    ]);

    ProductVariation::factory()->for($product)->create([
        'square_variation_id' => 'seed-felisa-latte-espresso',
        'name' => 'Espresso',
        'price_cents' => 850,
        'ordinal' => 0,
    ]);

    $milk = ModifierList::factory()->pickOne()->create([
        'square_modifier_list_id' => 'seed-milk',
        'name' => 'Milk',
    ]);

    Modifier::factory()->for($milk)->create([
        'square_modifier_id' => 'seed-milk-oat',
        'name' => 'Oat Milk',
        'price_cents' => 0,
    ]);

    $product->modifierLists()->attach($milk, [
        'min_selected' => 1,
        'max_selected' => 1,
        'position' => 0,
    ]);

    FakeSquare::fake([
        '/v2/catalog/batch-upsert' => Http::response(['objects' => []]),
    ]);

    $this->artisan('square:push-catalog', ['--no-sync' => true])
        ->expectsOutputToContain('products=1')
        ->assertSuccessful();

    $payload = outgoingCatalogPush();
    $objects = collect($payload['batches'][0]['objects']);

    expect($payload['idempotency_key'])->toStartWith('catalog-push-')
        ->and($objects)->toHaveCount(3);

    $category = $objects->firstWhere('type', 'CATEGORY');
    $list = $objects->firstWhere('type', 'MODIFIER_LIST');
    $item = $objects->firstWhere('type', 'ITEM');

    expect($category['id'])->toBe('#category-signature')
        ->and($category['present_at_all_locations'])->toBeTrue()
        ->and($category)->not->toHaveKey('present_at_location_ids')
        ->and($category['category_data']['name'])->toBe('Signature')
        ->and($list['id'])->toBe('#modifier-list-seed-milk')
        ->and($list['modifier_list_data']['selection_type'])->toBe('SINGLE')
        ->and($list['modifier_list_data']['modifiers'][0]['id'])->toBe('#modifier-seed-milk-oat')
        ->and($item['id'])->toBe('#item-felisa-latte')
        ->and($item['item_data']['name'])->toBe('Felisa Latte')
        ->and($item['item_data']['categories'][0]['id'])->toBe('#category-signature')
        ->and($item['item_data']['modifier_list_info'][0]['modifier_list_id'])->toBe('#modifier-list-seed-milk')
        ->and($item['item_data']['variations'][0]['id'])->toBe('#variation-seed-felisa-latte-espresso')
        ->and($item['item_data']['variations'][0]['item_variation_data']['price_money']['amount'])->toBe(850);
});

it('skips products already linked to Square', function (): void {
    Product::factory()->withVariation()->create(['square_item_id' => 'ITEM_ALREADY_THERE']);

    FakeSquare::fake([
        '/v2/catalog/batch-upsert' => Http::response(['objects' => []]),
    ]);

    $this->artisan('square:push-catalog', ['--no-sync' => true])
        ->expectsOutput('No unlinked local products to push.')
        ->assertSuccessful();

    expect(Http::recorded())->toHaveCount(0);
});

it('can push and then sync back Square IDs', function (): void {
    Product::factory()->unlinked()->withVariation(850, 'Regular')->create([
        'name' => 'Felisa Latte',
        'slug' => 'felisa-latte',
        'category' => ProductCategory::Signature,
    ]);

    FakeSquare::fake([
        '/v2/catalog/batch-upsert' => Http::response(['objects' => []]),
        '/v2/catalog/list*' => Http::response(['objects' => [
            FakeSquare::category('CAT_SIG', 'Signature Drinks'),
            FakeSquare::item(
                id: 'ITEM_LATTE',
                name: 'Felisa Latte',
                variations: [FakeSquare::variation('VAR_REGULAR', 'Regular', 850, 'ITEM_LATTE')],
                categoryId: 'CAT_SIG',
            ),
        ]]),
    ]);

    $this->artisan('square:push-catalog')
        ->expectsOutputToContain('Catalog pushed:')
        ->expectsOutputToContain('Catalog synced:')
        ->assertSuccessful();

    expect(Product::query()->firstOrFail()->square_item_id)->toBe('ITEM_LATTE')
        ->and(ProductVariation::query()->firstOrFail()->square_variation_id)->toBe('VAR_REGULAR');
});
