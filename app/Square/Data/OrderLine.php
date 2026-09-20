<?php

declare(strict_types=1);

namespace App\Square\Data;

/**
 * One line of a Square order. Only catalog IDs and a quantity are sent, never
 * prices: Square prices the order itself and applies taxes.
 */
final readonly class OrderLine
{
    /**
     * @param  list<string>  $squareModifierIds
     */
    public function __construct(
        public string $squareVariationId,
        public int $quantity,
        public array $squareModifierIds = [],
        public string $note = '',
    ) {}
}
