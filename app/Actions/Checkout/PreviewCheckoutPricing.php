<?php

declare(strict_types=1);

namespace App\Actions\Checkout;

use App\Cart\PricedCart;
use App\Square\Data\OrderLine;
use App\Square\SquareException;
use App\Square\SquareGateway;
use App\Support\Money;

/**
 * Asks Square for a tax/total preview without creating an order.
 *
 * The final checkout still creates a real Square order and trusts that result;
 * this preview exists only so the checkout page can show customers the tax
 * they should expect before payment.
 */
class PreviewCheckoutPricing
{
    /**
     * @return array<string, mixed>|null
     */
    public function handle(PricedCart $cart, SquareGateway $square): ?array
    {
        if ($cart->isEmpty() || ! $cart->isValid() || ! $square->isConfigured()) {
            return null;
        }

        try {
            $preview = $square->calculateOrder(
                idempotencyKey: $this->idempotencyKey($cart),
                lines: $this->lines($cart),
            );
        } catch (SquareException) {
            return null;
        }

        return [
            'tax' => (new Money($preview->taxCents, $preview->currency))->toArray(),
            'total' => (new Money($preview->totalCents, $preview->currency))->toArray(),
        ];
    }

    /**
     * @return list<OrderLine>
     */
    private function lines(PricedCart $cart): array
    {
        return array_map(
            fn ($line): OrderLine => new OrderLine(
                squareVariationId: $line->variation->square_variation_id,
                quantity: $line->quantity,
                squareModifierIds: array_map(
                    fn ($modifier): string => $modifier->square_modifier_id,
                    $line->modifiers,
                ),
                note: $line->note,
            ),
            $cart->lines,
        );
    }

    private function idempotencyKey(PricedCart $cart): string
    {
        return 'checkout-preview-'.hash(
            'sha256',
            json_encode($cart->toArray(), JSON_THROW_ON_ERROR),
        );
    }
}
