<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ProductCategory;
use App\Support\Money;
use Database\Factories\OrderItemFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A line of an order, snapshotted at purchase time. Names and prices are
 * copied here on purpose: an old order must never be reconstructed from
 * current Product rows.
 *
 * @property int $id
 * @property int $order_id
 * @property int|null $product_id
 * @property string $product_name
 * @property string $product_slug
 * @property ProductCategory|null $category
 * @property string $square_variation_id
 * @property string $variation_name
 * @property int $quantity
 * @property int $unit_price_cents
 * @property int $total_cents
 * @property string $currency
 * @property list<array{square_modifier_id: string, name: string, price_cents: int}> $modifiers
 * @property string $note
 * @property-read Order $order
 * @property-read Product|null $product
 */
class OrderItem extends Model
{
    /** @use HasFactory<OrderItemFactory> */
    use HasFactory;

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'category' => ProductCategory::class,
            'quantity' => 'integer',
            'unit_price_cents' => 'integer',
            'total_cents' => 'integer',
            'modifiers' => 'array',
        ];
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unitPrice(): Money
    {
        return new Money($this->unit_price_cents, $this->currency);
    }

    public function total(): Money
    {
        return new Money($this->total_cents, $this->currency);
    }

    /** The options chosen for this line, e.g. "Espresso · Oat Milk". */
    public function optionsSummary(): string
    {
        $parts = array_filter([
            $this->variation_name,
            ...array_column($this->modifiers, 'name'),
        ]);

        return implode(' · ', $parts);
    }
}
