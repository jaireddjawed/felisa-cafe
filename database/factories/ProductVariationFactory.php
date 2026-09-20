<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\ProductVariation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ProductVariation>
 */
class ProductVariationFactory extends Factory
{
    protected $model = ProductVariation::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'product_id' => ProductFactory::new(),
            'square_variation_id' => 'SQ_VAR_'.Str::upper(Str::random(12)),
            'square_version' => 1,
            'name' => 'Regular',
            'price_cents' => 850,
            'currency' => 'USD',
            'sellable' => true,
            'ordinal' => 0,
        ];
    }

    /** Variable-priced or sold-out in Square: can never be charged for online. */
    public function unsellable(): static
    {
        return $this->state(['sellable' => false]);
    }
}
