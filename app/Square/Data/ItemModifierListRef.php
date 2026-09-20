<?php

declare(strict_types=1);

namespace App\Square\Data;

/**
 * A modifier list attached to one item, with that item's selection overrides.
 * Null limits mean "use the list's own limits".
 */
final readonly class ItemModifierListRef
{
    public function __construct(
        public string $squareModifierListId,
        public ?int $minSelected = null,
        public ?int $maxSelected = null,
    ) {}
}
