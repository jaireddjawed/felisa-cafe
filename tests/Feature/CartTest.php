<?php

declare(strict_types=1);

use App\Enums\CatalogStatus;
use App\Models\Modifier;
use App\Models\ModifierList;
use App\Models\Product;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

/**
 * The cart is the boundary where client input meets the catalog. These tests
 * exist mostly to prove that nothing the browser sends is trusted.
 */

/** A latte at $8.50 with a "pick exactly one milk" list, milks free. */
function latteWithMilk(): Product
{
    $product = Product::factory()->withVariation(850, 'Espresso')->create([
        'name' => 'Felisa Latte',
        'slug' => 'felisa-latte',
    ]);

    $milk = ModifierList::factory()->pickOne()->create(['name' => 'Milk']);
    Modifier::factory()->for($milk, 'modifierList')->create([
        'square_modifier_id' => 'MOD_OAT', 'name' => 'Oat Milk', 'price_cents' => 0,
    ]);
    Modifier::factory()->for($milk, 'modifierList')->create([
        'square_modifier_id' => 'MOD_WHOLE', 'name' => 'Whole Milk', 'price_cents' => 0,
    ]);

    $product->modifierLists()->attach($milk, ['min_selected' => 1, 'max_selected' => 1]);

    return $product->load('variations');
}

function variationId(Product $product): string
{
    return $product->variations->firstOrFail()->square_variation_id;
}

it('adds an item and prices it from local products', function (): void {
    $product = latteWithMilk();

    $this->post(route('cart.store'), [
        'variation_id' => variationId($product),
        'modifier_ids' => ['MOD_OAT'],
        'quantity' => 2,
    ])->assertRedirect();

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('cart.itemCount', 2)
            ->where('cart.subtotal.cents', 1700)
            ->where('cart.lines.0.productName', 'Felisa Latte')
            ->where('cart.lines.0.variationName', 'Espresso')
            ->where('cart.lines.0.modifiers.0.name', 'Oat Milk')
            ->where('cart.valid', true)
        );
});

it('ignores any price the browser tries to send', function (): void {
    $product = latteWithMilk();

    $this->post(route('cart.store'), [
        'variation_id' => variationId($product),
        'modifier_ids' => ['MOD_OAT'],
        'quantity' => 1,
        // None of these are fields the server reads.
        'price_cents' => 1,
        'unit_price_cents' => 1,
        'total_cents' => 1,
        'product_name' => 'Free Latte',
    ])->assertRedirect();

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('cart.subtotal.cents', 850)
            ->where('cart.lines.0.productName', 'Felisa Latte')
        );
});

it('merges an identical selection into one line', function (): void {
    $product = latteWithMilk();
    $payload = [
        'variation_id' => variationId($product),
        'modifier_ids' => ['MOD_OAT'],
        'quantity' => 1,
    ];

    $this->post(route('cart.store'), $payload);
    $this->post(route('cart.store'), $payload);

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('cart.lines', 1)
            ->where('cart.lines.0.quantity', 2)
        );
});

it('keeps different options as separate lines', function (): void {
    $product = latteWithMilk();

    $this->post(route('cart.store'), [
        'variation_id' => variationId($product), 'modifier_ids' => ['MOD_OAT'], 'quantity' => 1,
    ]);
    $this->post(route('cart.store'), [
        'variation_id' => variationId($product), 'modifier_ids' => ['MOD_WHOLE'], 'quantity' => 1,
    ]);

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page->has('cart.lines', 2));
});

it('refuses an item that is not on the menu', function (): void {
    $this->post(route('cart.store'), [
        'variation_id' => 'VAR_DOES_NOT_EXIST',
        'quantity' => 1,
    ])->assertSessionHasErrors('cart');

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page->has('cart.lines', 0));
});

it('refuses a product Square has archived', function (): void {
    $product = Product::factory()->archived()->withVariation(850)->create();

    $this->post(route('cart.store'), [
        'variation_id' => variationId($product->load('variations')),
        'quantity' => 1,
    ])->assertSessionHasErrors('cart');
});

it('refuses a variation Square will not sell online', function (): void {
    $product = Product::factory()->create();
    $product->variations()->createQuietly([
        'square_variation_id' => 'VAR_VARIABLE', 'name' => 'Ask', 'price_cents' => 0, 'sellable' => false,
    ]);
    $product->variations()->createQuietly([
        'square_variation_id' => 'VAR_OK', 'name' => 'Regular', 'price_cents' => 850, 'sellable' => true,
    ]);

    $this->post(route('cart.store'), [
        'variation_id' => 'VAR_VARIABLE',
        'quantity' => 1,
    ])->assertSessionHasErrors('cart');
});

it('enforces the minimum number of options a product requires', function (): void {
    $product = latteWithMilk();

    // The Milk list requires exactly one, and none was chosen.
    $this->post(route('cart.store'), [
        'variation_id' => variationId($product),
        'modifier_ids' => [],
        'quantity' => 1,
    ])->assertSessionHasErrors('cart');
});

it('enforces the maximum number of options a product allows', function (): void {
    $product = latteWithMilk();

    $this->post(route('cart.store'), [
        'variation_id' => variationId($product),
        'modifier_ids' => ['MOD_OAT', 'MOD_WHOLE'],
        'quantity' => 1,
    ])->assertSessionHasErrors('cart');
});

it('refuses an option that belongs to another product', function (): void {
    $product = latteWithMilk();

    $otherList = ModifierList::factory()->create(['name' => 'Syrups']);
    Modifier::factory()->for($otherList, 'modifierList')->create(['square_modifier_id' => 'MOD_ELSEWHERE']);

    $this->post(route('cart.store'), [
        'variation_id' => variationId($product),
        'modifier_ids' => ['MOD_OAT', 'MOD_ELSEWHERE'],
        'quantity' => 1,
    ])->assertSessionHasErrors('cart');
});

it('refuses an option Square hides from online ordering', function (): void {
    $product = Product::factory()->withVariation(850)->create();
    $list = ModifierList::factory()->create(['name' => 'Add-Ons']);
    Modifier::factory()->for($list, 'modifierList')->create([
        'square_modifier_id' => 'MOD_STAFF', 'hidden_online' => true,
    ]);
    $product->modifierLists()->attach($list);

    $this->post(route('cart.store'), [
        'variation_id' => variationId($product->load('variations')),
        'modifier_ids' => ['MOD_STAFF'],
        'quantity' => 1,
    ])->assertSessionHasErrors('cart');
});

it('adds the price of paid options to the line', function (): void {
    $product = Product::factory()->withVariation(850)->create();
    $list = ModifierList::factory()->create(['name' => 'Add-Ons']);
    Modifier::factory()->for($list, 'modifierList')->create([
        'square_modifier_id' => 'MOD_FOAM', 'name' => 'Maple Cold Foam', 'price_cents' => 75,
    ]);
    $product->modifierLists()->attach($list);

    $this->post(route('cart.store'), [
        'variation_id' => variationId($product->load('variations')),
        'modifier_ids' => ['MOD_FOAM'],
        'quantity' => 2,
    ]);

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('cart.lines.0.unitPrice.cents', 925)
            ->where('cart.subtotal.cents', 1850)
        );
});

it('rejects quantities outside the allowed range', function (): void {
    $product = latteWithMilk();

    foreach ([0, -1, 999] as $quantity) {
        $this->post(route('cart.store'), [
            'variation_id' => variationId($product),
            'modifier_ids' => ['MOD_OAT'],
            'quantity' => $quantity,
        ])->assertSessionHasErrors('quantity');
    }
});

it('changes a line quantity', function (): void {
    $product = latteWithMilk();
    $this->post(route('cart.store'), [
        'variation_id' => variationId($product), 'modifier_ids' => ['MOD_OAT'], 'quantity' => 1,
    ]);

    $lineId = session('cart')[0]['id'];

    $this->patch(route('cart.update', $lineId), ['quantity' => 3])->assertRedirect();

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('cart.lines.0.quantity', 3)
            ->where('cart.subtotal.cents', 2550)
        );
});

it('removes a line when its quantity reaches zero', function (): void {
    $product = latteWithMilk();
    $this->post(route('cart.store'), [
        'variation_id' => variationId($product), 'modifier_ids' => ['MOD_OAT'], 'quantity' => 1,
    ]);

    $lineId = session('cart')[0]['id'];

    $this->patch(route('cart.update', $lineId), ['quantity' => 0])->assertRedirect();

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page->has('cart.lines', 0));
});

it('removes a line outright', function (): void {
    $product = latteWithMilk();
    $this->post(route('cart.store'), [
        'variation_id' => variationId($product), 'modifier_ids' => ['MOD_OAT'], 'quantity' => 1,
    ]);

    $lineId = session('cart')[0]['id'];

    $this->delete(route('cart.destroy', $lineId))->assertRedirect();

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page->has('cart.lines', 0));
});

it('flags a line whose product disappears from the catalog', function (): void {
    $product = latteWithMilk();
    $this->post(route('cart.store'), [
        'variation_id' => variationId($product), 'modifier_ids' => ['MOD_OAT'], 'quantity' => 1,
    ]);

    $product->delete();

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('cart.valid', false)
            ->where('cart.lines.0.problem', 'This item is no longer available.')
            // An unbuyable line never counts towards the subtotal.
            ->where('cart.subtotal.cents', 0)
        );
});

it('flags a line whose product is archived after it was added', function (): void {
    $product = latteWithMilk();
    $this->post(route('cart.store'), [
        'variation_id' => variationId($product), 'modifier_ids' => ['MOD_OAT'], 'quantity' => 1,
    ]);

    $product->update(['status' => CatalogStatus::Archived]);

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('cart.valid', false)
            ->where('cart.subtotal.cents', 0)
        );
});

it('reprices a line when Square changes the price', function (): void {
    $product = latteWithMilk();
    $this->post(route('cart.store'), [
        'variation_id' => variationId($product), 'modifier_ids' => ['MOD_OAT'], 'quantity' => 1,
    ]);

    // A catalog sync raises the price while the cart is sitting there.
    $product->variations()->firstOrFail()->update(['price_cents' => 950]);

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('cart.subtotal.cents', 950));
});

it('keeps the cart when a guest signs in', function (): void {
    $product = latteWithMilk();
    $user = User::factory()->create();

    $this->post(route('cart.store'), [
        'variation_id' => variationId($product), 'modifier_ids' => ['MOD_OAT'], 'quantity' => 2,
    ]);

    $this->actingAs($user)
        ->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('cart.itemCount', 2));
});

it('shares the cart with every page, for the header badge', function (): void {
    $product = latteWithMilk();
    $this->post(route('cart.store'), [
        'variation_id' => variationId($product), 'modifier_ids' => ['MOD_OAT'], 'quantity' => 2,
    ]);

    $this->get(route('menu'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('cart.itemCount', 2));
});

it('drops tampered session lines instead of pricing them', function (): void {
    latteWithMilk();

    $this->withSession(['cart' => [
        ['id' => 'x', 'square_variation_id' => 'VAR', 'quantity' => 'lots', 'modifier_ids' => [], 'note' => ''],
        'not even an array',
    ]])->get(route('cart'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->has('cart.lines', 0));
});
