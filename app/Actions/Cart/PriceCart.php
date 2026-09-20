<?php

declare(strict_types=1);

namespace App\Actions\Cart;

use App\Cart\CartSession;
use App\Cart\InvalidSelectionException;
use App\Cart\PricedCart;
use App\Cart\PricedLine;
use App\Cart\SelectionValidator;
use App\Models\Product;
use App\Support\Money;
use Illuminate\Support\Collection;

/**
 * Resolves the session cart against the catalog and prices it.
 *
 * This is where "never trust the client" is enforced: the session stores only
 * Square variation IDs, modifier IDs and quantities, and every name and price
 * shown or charged comes from Product records loaded here.
 */
class PriceCart
{
    public function __construct(private readonly SelectionValidator $selection) {}

    public function handle(CartSession $cart): PricedCart
    {
        $lines = $cart->lines();

        if ($lines === []) {
            return PricedCart::empty();
        }

        $products = $this->productsByVariationId(array_column($lines, 'square_variation_id'));

        $priced = [];
        $subtotal = Money::zero();

        foreach ($lines as $line) {
            $pricedLine = $this->priceLine($line, $products->get($line['square_variation_id']));
            $priced[] = $pricedLine;

            if ($pricedLine->isValid()) {
                $subtotal = $subtotal->plus($pricedLine->total);
            }
        }

        return new PricedCart($priced, $subtotal);
    }

    /**
     * @param  array{id: string, square_variation_id: string, modifier_ids: list<string>, quantity: int, note: string}  $line
     */
    private function priceLine(array $line, ?Product $product): PricedLine
    {
        $unavailable = fn (string $problem): PricedLine => new PricedLine(
            lineId: $line['id'],
            product: $product,
            variation: $product?->variation($line['square_variation_id']),
            modifiers: [],
            quantity: $line['quantity'],
            note: $line['note'],
            unitPrice: Money::zero(),
            total: Money::zero(),
            problem: $problem,
        );

        if ($product === null) {
            return $unavailable('This item is no longer available.');
        }

        try {
            $modifiers = $this->selection->resolve($product, $line['square_variation_id'], $line['modifier_ids']);
        } catch (InvalidSelectionException $exception) {
            return $unavailable($exception->getMessage());
        }

        $variation = $product->variation($line['square_variation_id']);

        // resolve() has already established the variation is sellable.
        if ($variation === null) {
            return $unavailable('This item is no longer available.');
        }

        $unitPrice = $variation->price();
        foreach ($modifiers as $modifier) {
            $unitPrice = $unitPrice->plus($modifier->price());
        }

        return new PricedLine(
            lineId: $line['id'],
            product: $product,
            variation: $variation,
            modifiers: $modifiers,
            quantity: $line['quantity'],
            note: $line['note'],
            unitPrice: $unitPrice,
            total: $unitPrice->times($line['quantity']),
        );
    }

    /**
     * Loads every product a cart refers to in one query, keyed by the
     * variation ID the cart stores.
     *
     * @param  list<string>  $squareVariationIds
     * @return Collection<string, Product>
     */
    private function productsByVariationId(array $squareVariationIds): Collection
    {
        $products = Product::query()
            ->with(['variations', 'modifierLists.modifiers'])
            ->whereHas(
                'variations',
                fn ($query) => $query->whereIn('square_variation_id', $squareVariationIds),
            )
            ->get();

        /** @var Collection<string, Product> $byVariation */
        $byVariation = new Collection;

        foreach ($products as $product) {
            foreach ($product->variations as $variation) {
                if (in_array($variation->square_variation_id, $squareVariationIds, true)) {
                    $byVariation->put($variation->square_variation_id, $product);
                }
            }
        }

        return $byVariation;
    }
}
