<?php

declare(strict_types=1);

namespace App\Cart;

use App\Models\Modifier;
use App\Models\Product;
use App\Models\ProductVariation;
use App\Support\Money;

/**
 * One cart line resolved against the catalog. A line with a `problem` can no
 * longer be bought as it stands: it is shown to the customer with the reason
 * and excluded from the subtotal, and it blocks checkout.
 */
final readonly class PricedLine
{
    /**
     * @param  list<Modifier>  $modifiers
     */
    public function __construct(
        public string $lineId,
        public ?Product $product,
        public ?ProductVariation $variation,
        public array $modifiers,
        public int $quantity,
        public string $note,
        public Money $unitPrice,
        public Money $total,
        public ?string $problem = null,
    ) {}

    public function isValid(): bool
    {
        return $this->problem === null;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->lineId,
            'productName' => $this->product->name ?? 'Unavailable item',
            'productSlug' => $this->product->slug ?? '',
            'variationName' => $this->variation->name ?? '',
            'modifiers' => array_map(
                fn (Modifier $modifier): array => [
                    'id' => $modifier->square_modifier_id,
                    'name' => $modifier->name,
                    'price' => $modifier->price()->toArray(),
                ],
                $this->modifiers,
            ),
            'quantity' => $this->quantity,
            'note' => $this->note,
            'unitPrice' => $this->unitPrice->toArray(),
            'total' => $this->total->toArray(),
            'problem' => $this->problem,
        ];
    }
}
