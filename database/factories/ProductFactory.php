<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\CatalogStatus;
use App\Enums\ProductCategory;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        // sentence() returns a string, unlike words(), which is array|string.
        $name = rtrim(fake()->unique()->sentence(2), '.');

        return [
            'square_item_id' => 'SQ_ITEM_'.Str::upper(Str::random(12)),
            'square_version' => 1,
            'status' => CatalogStatus::Active,
            'name' => Str::title($name),
            'description' => fake()->sentence(),
            'category' => ProductCategory::Signature,
            'synced_at' => now(),
            'slug' => Str::slug($name),
            'tagline' => fake()->sentence(4),
            'ingredients' => ['espresso', 'housemade ube syrup'],
            'size' => '16oz',
            'pour_top' => '#C08A5E',
            'pour_bottom' => '#9B6BD8',
            'badge' => '',
            'sort_order' => 0,
        ];
    }

    public function archived(): static
    {
        return $this->state(['status' => CatalogStatus::Archived]);
    }

    /** Local metadata that no Square item has been matched to yet. */
    public function unlinked(): static
    {
        return $this->state([
            'status' => CatalogStatus::Unlinked,
            'square_item_id' => null,
            'square_version' => 0,
            'synced_at' => null,
        ]);
    }

    public function category(ProductCategory $category): static
    {
        return $this->state(['category' => $category]);
    }

    /** A product with one fixed-price variation, which is the common case. */
    public function withVariation(int $priceCents = 850, string $name = 'Regular'): static
    {
        return $this->afterCreating(function (Product $product) use ($priceCents, $name): void {
            ProductVariationFactory::new()
                ->for($product)
                ->create(['name' => $name, 'price_cents' => $priceCents]);
        });
    }
}
