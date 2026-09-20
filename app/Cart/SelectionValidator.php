<?php

declare(strict_types=1);

namespace App\Cart;

use App\Models\Modifier;
use App\Models\ModifierList;
use App\Models\Product;

/**
 * Decides whether a chosen variation and set of modifiers may be sold, and
 * resolves the modifiers. This is the server-side answer to "can the customer
 * actually order this?", and it is applied both when adding to the cart and
 * again when the cart is priced, because the catalog changes underneath carts.
 */
class SelectionValidator
{
    /**
     * @param  list<string>  $squareModifierIds
     * @return list<Modifier>
     *
     * @throws InvalidSelectionException
     */
    public function resolve(Product $product, string $squareVariationId, array $squareModifierIds): array
    {
        $this->assertVariationIsSellable($product, $squareVariationId);

        $chosen = $this->collectChosen($squareModifierIds, $product);

        $resolved = [];

        foreach ($product->modifierLists as $list) {
            $selectedFromList = [];

            foreach ($list->modifiers as $modifier) {
                if (! isset($chosen[$modifier->square_modifier_id]) || $modifier->hidden_online) {
                    continue;
                }

                $selectedFromList[] = $modifier;
                unset($chosen[$modifier->square_modifier_id]);
            }

            $this->assertWithinLimits($list, count($selectedFromList));

            $resolved = [...$resolved, ...$selectedFromList];
        }

        if ($chosen !== []) {
            throw new InvalidSelectionException("That option isn't offered for {$product->name}.");
        }

        return $resolved;
    }

    private function assertVariationIsSellable(Product $product, string $squareVariationId): void
    {
        if (! $product->isPurchasable()) {
            throw new InvalidSelectionException("{$product->name} isn't available right now.");
        }

        $variation = $product->variation($squareVariationId);

        if ($variation === null || ! $variation->sellable) {
            throw new InvalidSelectionException("That option of {$product->name} isn't available.");
        }
    }

    /**
     * @param  list<string>  $squareModifierIds
     * @return array<string, true>
     */
    private function collectChosen(array $squareModifierIds, Product $product): array
    {
        $chosen = [];

        foreach ($squareModifierIds as $id) {
            if (isset($chosen[$id])) {
                throw new InvalidSelectionException("Please choose each option for {$product->name} only once.");
            }

            $chosen[$id] = true;
        }

        return $chosen;
    }

    private function assertWithinLimits(ModifierList $list, int $selected): void
    {
        [$minimum, $maximum] = $list->limitsForProduct();
        $name = mb_strtolower($list->name);

        if ($selected < $minimum) {
            throw new InvalidSelectionException("Please choose at least {$minimum} {$name}.");
        }

        if ($maximum > 0 && $selected > $maximum) {
            throw new InvalidSelectionException("Please choose at most {$maximum} {$name}.");
        }
    }
}
