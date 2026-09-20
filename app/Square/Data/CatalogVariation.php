<?php

declare(strict_types=1);

namespace App\Square\Data;

final readonly class CatalogVariation
{
    public function __construct(
        public string $squareVariationId,
        public int $squareVersion,
        public string $name,
        public int $priceCents,
        public string $currency,
        /** False for variable-priced, unsellable or sold-out variations. */
        public bool $sellable,
        public int $ordinal,
    ) {}
}
