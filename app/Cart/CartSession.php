<?php

declare(strict_types=1);

namespace App\Cart;

use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Str;

/**
 * The cart lives in the session, for guests and signed-in customers alike.
 * That is the whole storage model: no carts table, and nothing to merge when
 * a guest signs in, because Laravel keeps the session data across login.
 *
 * A stored line holds identifiers and a quantity only. Names and prices are
 * resolved from the catalog every time the cart is read, so nothing the
 * browser sends is ever trusted as a price.
 *
 * @phpstan-type CartLine array{
 *     id: string,
 *     square_variation_id: string,
 *     modifier_ids: list<string>,
 *     quantity: int,
 *     note: string,
 * }
 */
class CartSession
{
    private const KEY = 'cart';

    public function __construct(private readonly Session $session) {}

    /**
     * @return list<CartLine>
     */
    public function lines(): array
    {
        $lines = $this->session->get(self::KEY, []);

        if (! is_array($lines)) {
            return [];
        }

        return array_values(array_filter(array_map($this->normalizeLine(...), $lines)));
    }

    /**
     * Adds a selection, merging into an identical existing line rather than
     * stacking duplicates.
     *
     * @param  list<string>  $modifierIds
     */
    public function add(string $squareVariationId, array $modifierIds, int $quantity, string $note): void
    {
        sort($modifierIds);
        $lines = $this->lines();
        $maxQuantity = $this->maxLineQuantity();

        foreach ($lines as $index => $line) {
            $isSameSelection = $line['square_variation_id'] === $squareVariationId
                && $line['modifier_ids'] === $modifierIds
                && $line['note'] === $note;

            if ($isSameSelection) {
                $lines[$index]['quantity'] = min($line['quantity'] + $quantity, $maxQuantity);
                $this->put($lines);

                return;
            }
        }

        if (count($lines) >= $this->maxLines()) {
            throw new CartFullException('Your cart is full.');
        }

        $lines[] = [
            'id' => (string) Str::uuid(),
            'square_variation_id' => $squareVariationId,
            'modifier_ids' => $modifierIds,
            'quantity' => min($quantity, $maxQuantity),
            'note' => $note,
        ];

        $this->put($lines);
    }

    /** Sets a line's quantity. Zero or less removes it. */
    public function setQuantity(string $lineId, int $quantity): void
    {
        $lines = $this->lines();

        foreach ($lines as $index => $line) {
            if ($line['id'] !== $lineId) {
                continue;
            }

            if ($quantity <= 0) {
                unset($lines[$index]);
            } else {
                $lines[$index]['quantity'] = min($quantity, $this->maxLineQuantity());
            }

            $this->put(array_values($lines));

            return;
        }
    }

    public function remove(string $lineId): void
    {
        $this->setQuantity($lineId, 0);
    }

    public function clear(): void
    {
        $this->session->forget(self::KEY);
    }

    public function isEmpty(): bool
    {
        return $this->lines() === [];
    }

    /**
     * Drops anything that is not a well-formed line, so a tampered or stale
     * session can never reach the pricing code.
     *
     * @return CartLine|null
     */
    private function normalizeLine(mixed $line): ?array
    {
        if (! is_array($line)) {
            return null;
        }

        $id = $line['id'] ?? null;
        $variationId = $line['square_variation_id'] ?? null;
        $quantity = $line['quantity'] ?? null;

        if (! is_string($id) || ! is_string($variationId) || ! is_int($quantity) || $quantity < 1) {
            return null;
        }

        $modifierIds = $line['modifier_ids'] ?? [];
        $note = $line['note'] ?? '';

        return [
            'id' => $id,
            'square_variation_id' => $variationId,
            'modifier_ids' => is_array($modifierIds)
                ? array_values(array_filter($modifierIds, is_string(...)))
                : [],
            'quantity' => min($quantity, $this->maxLineQuantity()),
            'note' => is_string($note) ? $note : '',
        ];
    }

    /**
     * @param  list<CartLine>  $lines
     */
    private function put(array $lines): void
    {
        $this->session->put(self::KEY, $lines);
    }

    private function maxLines(): int
    {
        return (int) config('felisa.cart.max_lines', 30);
    }

    private function maxLineQuantity(): int
    {
        return (int) config('felisa.cart.max_line_quantity', 20);
    }
}
