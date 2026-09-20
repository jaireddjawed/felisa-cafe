<?php

declare(strict_types=1);

namespace App\Square\Data;

final readonly class CatalogItem
{
    /**
     * @param  list<string>  $categoryNames
     * @param  list<CatalogVariation>  $variations
     * @param  list<ItemModifierListRef>  $modifierListRefs
     */
    public function __construct(
        public string $squareItemId,
        public int $squareVersion,
        public string $name,
        public string $description,
        public array $categoryNames,
        /** False when archived in Square, or not offered at our location. */
        public bool $available,
        public array $variations,
        public array $modifierListRefs,
    ) {}
}
