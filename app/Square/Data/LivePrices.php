<?php

declare(strict_types=1);

namespace App\Square\Data;

/**
 * Prices and availability read straight from Square, used to check the local
 * catalog cache immediately before charging a customer.
 */
final readonly class LivePrices
{
    /**
     * @param  array<string, LivePrice>  $variations  keyed by Square variation ID
     * @param  array<string, LivePrice>  $modifiers  keyed by Square modifier ID
     */
    public function __construct(
        public array $variations,
        public array $modifiers,
    ) {}

    public function variation(string $squareVariationId): ?LivePrice
    {
        return $this->variations[$squareVariationId] ?? null;
    }

    public function modifier(string $squareModifierId): ?LivePrice
    {
        return $this->modifiers[$squareModifierId] ?? null;
    }
}
