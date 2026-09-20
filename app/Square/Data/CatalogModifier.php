<?php

declare(strict_types=1);

namespace App\Square\Data;

final readonly class CatalogModifier
{
    public function __construct(
        public string $squareModifierId,
        public string $name,
        public int $priceCents,
        public string $currency,
        public int $ordinal,
        public bool $hiddenOnline,
    ) {}
}
