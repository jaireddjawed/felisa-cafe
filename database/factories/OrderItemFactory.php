<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\ProductCategory;
use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<OrderItem>
 */
class OrderItemFactory extends Factory
{
    protected $model = OrderItem::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'order_id' => OrderFactory::new(),
            'product_id' => null,
            'product_name' => 'Felisa Latte',
            'product_slug' => 'felisa-latte',
            'category' => ProductCategory::Signature,
            'square_variation_id' => 'SQ_VAR_'.Str::upper(Str::random(12)),
            'variation_name' => 'Espresso',
            'quantity' => 1,
            'unit_price_cents' => 850,
            'total_cents' => 850,
            'currency' => 'USD',
            'modifiers' => [],
            'note' => '',
        ];
    }

    public function category(ProductCategory $category): static
    {
        return $this->state(['category' => $category]);
    }

    public function quantity(int $quantity): static
    {
        return $this->state(fn (array $attributes): array => [
            'quantity' => $quantity,
            'total_cents' => $quantity * (int) $attributes['unit_price_cents'],
        ]);
    }
}
