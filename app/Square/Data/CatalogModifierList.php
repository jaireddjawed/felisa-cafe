<?php

declare(strict_types=1);

namespace App\Square\Data;

final readonly class CatalogModifierList
{
    /**
     * @param  list<CatalogModifier>  $modifiers
     */
    public function __construct(
        public string $squareModifierListId,
        public string $name,
        /** Normalized: 0 means no minimum / no maximum. */
        public int $minSelected,
        public int $maxSelected,
        public array $modifiers,
    ) {}
}
