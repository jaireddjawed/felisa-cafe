<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Money;
use Database\Factories\ProductVariationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A sellable variant of a product ("Espresso" vs "Matcha"). Its Square ID is
 * what goes on a Square order line, and what the cart stores.
 *
 * @property string $id
 * @property string $product_id
 * @property string $square_variation_id
 * @property int $square_version
 * @property string $name
 * @property int $price_cents
 * @property string $currency
 * @property bool $sellable
 * @property int $ordinal
 * @property-read Product $product
 */
class ProductVariation extends Model
{
    /** @use HasFactory<ProductVariationFactory> */
    use HasFactory, HasUuids;

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'price_cents' => 'integer',
            'square_version' => 'integer',
            'sellable' => 'boolean',
            'ordinal' => 'integer',
        ];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function price(): Money
    {
        return new Money($this->price_cents, $this->currency);
    }
}
