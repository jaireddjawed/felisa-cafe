<?php

declare(strict_types=1);

namespace App\Actions\Cart;

use App\Cart\CartFullException;
use App\Cart\CartSession;
use App\Cart\InvalidSelectionException;
use App\Cart\SelectionValidator;
use App\Models\Product;

/**
 * Validates a selection against the catalog before it is allowed into the
 * cart, so customers get told immediately when a combination can't be made,
 * rather than at checkout.
 *
 * The cart is re-validated when it is priced anyway, because the catalog
 * changes while carts sit around.
 */
class AddItemToCart
{
    public function __construct(private readonly SelectionValidator $selection) {}

    /**
     * @param  list<string>  $squareModifierIds
     *
     * @throws InvalidSelectionException
     * @throws CartFullException
     */
    public function handle(
        CartSession $cart,
        string $squareVariationId,
        array $squareModifierIds,
        int $quantity,
        string $note = '',
    ): void {
        $product = Product::query()
            ->with(['variations', 'modifierLists.modifiers'])
            ->whereHas(
                'variations',
                fn ($query) => $query->where('square_variation_id', $squareVariationId),
            )
            ->first();

        if ($product === null) {
            throw new InvalidSelectionException("We couldn't find that item on the menu.");
        }

        $this->selection->resolve($product, $squareVariationId, $squareModifierIds);

        $cart->add($squareVariationId, $squareModifierIds, $quantity, trim($note));
    }
}
