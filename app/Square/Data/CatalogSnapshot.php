<?php

declare(strict_types=1);

namespace App\Square\Data;

/**
 * Everything Square currently offers. Square's list endpoint never returns
 * deleted objects, so anything missing from a snapshot has been deleted.
 */
final readonly class CatalogSnapshot
{
    /**
     * @param  list<CatalogItem>  $items
     * @param  list<CatalogModifierList>  $modifierLists
     */
    public function __construct(
        public array $items,
        public array $modifierLists,
    ) {}
}
