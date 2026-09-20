<?php

declare(strict_types=1);

use App\Enums\ProductCategory;
use App\Models\Modifier;
use App\Models\ModifierList;
use App\Models\Product;
use Inertia\Testing\AssertableInertia;

it('renders the menu from local products without calling Square', function (): void {
    Product::factory()->withVariation(850)->create(['name' => 'Felisa Latte', 'slug' => 'felisa-latte']);

    $this->get(route('menu'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('menu/index')
            ->has('products', 1)
            ->where('products.0.name', 'Felisa Latte')
            ->where('products.0.fromPrice.formatted', '$8.50')
        );

    // The point of the local cache: browsing never touches Square.
    Http::assertNothingSent();
});

it('hides products Square no longer offers', function (): void {
    Product::factory()->withVariation()->create(['name' => 'On the menu']);
    Product::factory()->archived()->withVariation()->create(['name' => 'Archived']);

    $this->get(route('menu'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('products', 1)
            ->where('products.0.name', 'On the menu')
        );
});

it('shows the lowest sellable price as the from price', function (): void {
    $product = Product::factory()->create();
    $product->variations()->createQuietly([
        'square_variation_id' => 'VAR_MATCHA', 'name' => 'Matcha', 'price_cents' => 900, 'sellable' => true,
    ]);
    $product->variations()->createQuietly([
        'square_variation_id' => 'VAR_ESPRESSO', 'name' => 'Espresso', 'price_cents' => 850, 'sellable' => true,
    ]);

    $this->get(route('menu'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('products.0.fromPrice.cents', 850));
});

it('ignores unsellable variations when pricing a card', function (): void {
    $product = Product::factory()->create();
    $product->variations()->createQuietly([
        'square_variation_id' => 'VAR_CHEAP', 'name' => 'Variable', 'price_cents' => 1, 'sellable' => false,
    ]);
    $product->variations()->createQuietly([
        'square_variation_id' => 'VAR_REAL', 'name' => 'Regular', 'price_cents' => 850, 'sellable' => true,
    ]);

    $this->get(route('menu'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('products.0.fromPrice.cents', 850));
});

it('shows a product with its variations and options', function (): void {
    $product = Product::factory()->withVariation(850, 'Espresso')->create(['slug' => 'felisa-latte']);
    $list = ModifierList::factory()->pickOne()->create(['name' => 'Milk']);
    Modifier::factory()->for($list, 'modifierList')->create(['name' => 'Oat Milk']);
    $product->modifierLists()->attach($list, ['min_selected' => 1, 'max_selected' => 1]);

    $this->get(route('menu.show', 'felisa-latte'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('menu/show')
            ->where('product.slug', 'felisa-latte')
            ->has('product.variations', 1)
            ->where('product.variations.0.name', 'Espresso')
            ->has('product.modifierLists', 1)
            ->where('product.modifierLists.0.minSelected', 1)
            ->where('product.modifierLists.0.modifiers.0.name', 'Oat Milk')
        );
});

it('never offers options Square hides from online ordering', function (): void {
    $product = Product::factory()->withVariation()->create(['slug' => 'felisa-latte']);
    $list = ModifierList::factory()->create(['name' => 'Add-Ons']);
    Modifier::factory()->for($list, 'modifierList')->create(['name' => 'Online option']);
    Modifier::factory()->for($list, 'modifierList')->create([
        'name' => 'Staff only', 'hidden_online' => true,
    ]);
    $product->modifierLists()->attach($list);

    $this->get(route('menu.show', 'felisa-latte'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('product.modifierLists.0.modifiers', 1)
            ->where('product.modifierLists.0.modifiers.0.name', 'Online option')
        );
});

it('404s for a product that is not on the menu', function (): void {
    Product::factory()->archived()->create(['slug' => 'archived-drink']);

    $this->get(route('menu.show', 'archived-drink'))->assertNotFound();
    $this->get(route('menu.show', 'never-existed'))->assertNotFound();
});

it('groups the home page into signatures and things to take home', function (): void {
    Product::factory()->withVariation()->category(ProductCategory::Signature)->create();
    Product::factory()->withVariation()->category(ProductCategory::Pantry)->create();
    Product::factory()->withVariation()->category(ProductCategory::Merch)->create();

    $this->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('home')
            ->has('signatures', 1)
            ->has('takeHome', 2)
        );
});
