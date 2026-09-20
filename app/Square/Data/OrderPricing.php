<?php

declare(strict_types=1);

namespace App\Square\Data;

/** The priced result of asking Square to calculate an order preview. */
final readonly class OrderPricing
{
    public function __construct(
        public int $totalCents,
        public int $taxCents,
        public string $currency,
    ) {}
}
