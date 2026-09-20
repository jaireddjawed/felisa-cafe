<?php

declare(strict_types=1);

namespace App\Actions\Checkout;

use App\Actions\Cart\PriceCart;
use App\Actions\Orders\CalculateOrderEta;
use App\Cart\CartSession;
use App\Cart\PricedCart;
use App\Cart\PricedLine;
use App\Enums\OrderStatus;
use App\Models\Modifier;
use App\Models\Order;
use App\Square\Data\CustomerContact;
use App\Square\Data\OrderLine;
use App\Square\SquareGateway;
use App\Square\SquareRejectedException;
use App\Square\SquareUnavailableException;
use Illuminate\Support\Facades\DB;

/**
 * Turns the cart into a pending local order and a Square order, ready to be
 * paid for.
 *
 *     load and price the cart from local products
 *       → re-check every price against Square
 *       → save a local Order snapshot (pending_payment)
 *       → create the Square order from catalog IDs
 *       → return the order
 *
 * Nothing here marks anything paid; see PayOrder and SyncOrderFromSquare.
 *
 * Idempotency has two layers. The customer's key maps to exactly one local
 * order, so a resubmitted form resumes rather than duplicates. The key sent to
 * Square is derived from the local order ID and the request is rebuilt from
 * the saved order, so a retry after a timeout — where the request succeeded at
 * Square but the response was lost — returns the original Square order instead
 * of creating a second one.
 */
class CreateCheckout
{
    public function __construct(
        private readonly SquareGateway $square,
        private readonly PriceCart $priceCart,
        private readonly CalculateOrderEta $eta,
    ) {}

    public function handle(
        CartSession $cart,
        CustomerContact $customer,
        string $idempotencyKey,
        string $notes = '',
        ?int $userId = null,
    ): Order {
        $existing = Order::query()->where('idempotency_key', $idempotencyKey)->first();

        if ($existing !== null) {
            return $this->resume($existing);
        }

        $priced = $this->priceCart->handle($cart);

        if ($priced->isEmpty()) {
            throw CheckoutException::emptyCart();
        }

        if (! $priced->isValid()) {
            throw CheckoutException::invalidCart();
        }

        $this->assertPricesMatchSquare($priced);

        $order = $this->saveLocalOrder($priced, $customer, $idempotencyKey, $notes, $userId);

        return $this->createSquareOrder($order);
    }

    /**
     * Resumes a checkout found by idempotency key. If the earlier attempt
     * never got a Square order — a timeout, or a crash — it is created now
     * from the saved snapshot.
     */
    private function resume(Order $order): Order
    {
        if ($order->square_order_id !== null) {
            return $order;
        }

        return $this->createSquareOrder($order);
    }

    /**
     * Refuses to charge from a stale cache. Every variation and modifier in
     * the cart is re-read from Square, and any difference in price or
     * availability aborts checkout so the customer can review the change.
     */
    private function assertPricesMatchSquare(PricedCart $priced): void
    {
        $variationIds = [];
        $modifierIds = [];

        foreach ($priced->lines as $line) {
            if ($line->variation !== null) {
                $variationIds[] = $line->variation->square_variation_id;
            }
            foreach ($line->modifiers as $modifier) {
                $modifierIds[] = $modifier->square_modifier_id;
            }
        }

        try {
            $live = $this->square->lookupPrices($variationIds, $modifierIds);
        } catch (SquareUnavailableException) {
            // Browsing is unaffected; we simply will not charge blind.
            throw CheckoutException::unavailable();
        }

        foreach ($priced->lines as $line) {
            $variation = $line->variation;

            if ($variation === null) {
                throw CheckoutException::invalidCart();
            }

            $livePrice = $live->variation($variation->square_variation_id);

            if ($livePrice === null || ! $livePrice->available || $livePrice->priceCents !== $variation->price_cents) {
                throw CheckoutException::pricesChanged();
            }

            foreach ($line->modifiers as $modifier) {
                $liveModifier = $live->modifier($modifier->square_modifier_id);

                if ($liveModifier === null || ! $liveModifier->available
                    || $liveModifier->priceCents !== $modifier->price_cents) {
                    throw CheckoutException::pricesChanged();
                }
            }
        }
    }

    private function saveLocalOrder(
        PricedCart $priced,
        CustomerContact $customer,
        string $idempotencyKey,
        string $notes,
        ?int $userId,
    ): Order {
        return DB::transaction(function () use ($priced, $customer, $idempotencyKey, $notes, $userId): Order {
            $order = Order::query()->create([
                'user_id' => $userId,
                'status' => OrderStatus::PendingPayment,
                'customer_name' => $customer->name,
                'customer_email' => $customer->email,
                'customer_phone' => $customer->phone,
                'notes' => $notes,
                'subtotal_cents' => $priced->subtotal->cents,
                'tax_cents' => 0,
                'total_cents' => $priced->subtotal->cents,
                'currency' => $priced->subtotal->currency,
                'idempotency_key' => $idempotencyKey,
            ]);

            foreach ($priced->lines as $line) {
                $order->items()->create($this->itemAttributes($line));
            }

            $order->estimated_ready_at = $this->eta->forOrder($order->load('items'));
            $order->save();

            return $order;
        });
    }

    /**
     * The historical snapshot. Names, options and prices are copied so the
     * order stays correct after the catalog changes.
     *
     * @return array<string, mixed>
     */
    private function itemAttributes(PricedLine $line): array
    {
        return [
            'product_id' => $line->product?->id,
            'product_name' => $line->product->name ?? '',
            'product_slug' => $line->product->slug ?? '',
            'category' => $line->product?->category,
            'square_variation_id' => $line->variation->square_variation_id ?? '',
            'variation_name' => $line->variation->name ?? '',
            'quantity' => $line->quantity,
            'unit_price_cents' => $line->unitPrice->cents,
            'total_cents' => $line->total->cents,
            'currency' => $line->total->currency,
            'modifiers' => array_map(
                fn (Modifier $modifier): array => [
                    'square_modifier_id' => $modifier->square_modifier_id,
                    'name' => $modifier->name,
                    'price_cents' => $modifier->price_cents,
                ],
                $line->modifiers,
            ),
            'note' => $line->note,
        ];
    }

    /**
     * Builds the Square request from the saved order, never from the in-memory
     * cart, so a retry — which can only see the saved order — sends exactly
     * the same request and Square replays the original.
     */
    private function createSquareOrder(Order $order): Order
    {
        $order->loadMissing('items');

        $lines = $order->items
            ->map(fn ($item): OrderLine => new OrderLine(
                squareVariationId: $item->square_variation_id,
                quantity: $item->quantity,
                squareModifierIds: array_column($item->modifiers, 'square_modifier_id'),
                note: $item->note,
            ))
            ->all();

        try {
            $state = $this->square->createOrder(
                idempotencyKey: "felisa-order-{$order->id}",
                referenceId: (string) $order->id,
                lines: array_values($lines),
                customer: new CustomerContact(
                    $order->customer_name,
                    $order->customer_email,
                    $order->customer_phone,
                ),
                note: $order->notes,
                prepMinutes: $this->prepMinutes($order),
            );
        } catch (SquareRejectedException $exception) {
            // Definitive: this order can never be created as it stands.
            $order->update(['status' => OrderStatus::Cancelled]);

            report($exception);

            throw CheckoutException::declined(
                'Our payment provider could not start this order. Please check your details and try again.'
            );
        } catch (SquareUnavailableException $exception) {
            // Ambiguous: leave the order pending with no Square order. A retry
            // with the same key rebuilds an identical request.
            report($exception);

            throw CheckoutException::unavailable();
        }

        $order->square_order_id = $state->squareOrderId;
        $order->square_order_version = $state->version;

        // Square computed the authoritative total, including taxes.
        if ($state->totalCents > 0) {
            $order->total_cents = $state->totalCents;
            $order->tax_cents = $state->taxCents;
            $order->currency = $state->currency;
        }

        $order->save();

        return $order;
    }

    private function prepMinutes(Order $order): int
    {
        $readyAt = $order->estimated_ready_at;

        if ($readyAt === null) {
            return 1;
        }

        return max(1, (int) ceil(now()->diffInSeconds($readyAt, absolute: true) / 60));
    }
}
