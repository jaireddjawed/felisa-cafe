<?php

declare(strict_types=1);

namespace App\Square\Data;

final readonly class LivePrice
{
    public function __construct(
        public int $priceCents,
        public string $currency,
        /** Whether Square will currently sell this at our location. */
        public bool $available,
    ) {}
}
