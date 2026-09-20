<?php

declare(strict_types=1);

namespace App\Cart;

use App\Support\Money;

/**
 * The cart as the server sees it: every line resolved against the catalog and
 * priced from Product records. This is the only cart shape React ever sees,
 * and the browser can do nothing but display it.
 */
final readonly class PricedCart
{
    /**
     * @param  list<PricedLine>  $lines
     */
    public function __construct(
        public array $lines,
        public Money $subtotal,
    ) {}

    public static function empty(): self
    {
        return new self([], Money::zero());
    }

    public function isEmpty(): bool
    {
        return $this->lines === [];
    }

    public function itemCount(): int
    {
        return array_sum(array_map(fn (PricedLine $line): int => $line->quantity, $this->lines));
    }

    /** False when any line can no longer be bought as it stands. */
    public function isValid(): bool
    {
        foreach ($this->lines as $line) {
            if (! $line->isValid()) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'lines' => array_map(fn (PricedLine $line): array => $line->toArray(), $this->lines),
            'subtotal' => $this->subtotal->toArray(),
            'itemCount' => $this->itemCount(),
            'valid' => $this->isValid(),
        ];
    }
}
