<?php

declare(strict_types=1);

namespace App\Actions\Checkout;

use App\Actions\Orders\ApplySquareOrderState;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Square\Data\CustomerContact;
use App\Square\SquareClient;
use App\Square\SquareRejectedException;
use App\Square\SquareUnavailableException;

/**
 * Charges a pending order with a card token produced by Square's Web Payments
 * SDK in the browser. The token is single-use and carries no card data, so
 * card details never reach this application.
 *
 * The amount charged is the order's own stored total plus the tip, never a
 * number sent by the browser.
 *
 * Success is not assumed from Square returning 200: the order is re-read from
 * Square afterwards, and only that read can mark it paid.
 */
class PayOrder
{
    /** A tip may not exceed the order total, or $100, whichever is larger. */
    private const TIP_FLOOR_CENTS = 10_000;

    public function __construct(
        private readonly SquareClient $square,
        private readonly ApplySquareOrderState $applyState,
    ) {}

    public function handle(Order $order, string $sourceId, string $idempotencyKey, int $tipCents = 0): Order
    {
        // Already settled: a double submit must not charge twice.
        if ($order->status !== OrderStatus::PendingPayment) {
            return $order;
        }

        if ($order->square_order_id === null) {
            throw CheckoutException::unavailable();
        }

        $tipCents = $this->validateTip($order, $tipCents);

        try {
            $result = $this->square->createPayment(
                idempotencyKey: $idempotencyKey,
                squareOrderId: $order->square_order_id,
                referenceId: (string) $order->id,
                amountCents: $order->total_cents,
                tipCents: $tipCents,
                sourceId: $sourceId,
                customer: new CustomerContact(
                    $order->customer_name,
                    $order->customer_email,
                    $order->customer_phone,
                ),
            );
        } catch (SquareRejectedException $exception) {
            report($exception);

            throw CheckoutException::declined(
                'That card was declined. Please check the details or try another card.'
            );
        } catch (SquareUnavailableException $exception) {
            report($exception);

            throw CheckoutException::unavailable();
        }

        $order->square_payment_id = $result->paymentId;
        $order->tip_cents = $tipCents;
        $order->save();

        return $this->applyState->handle($order, $result->order);
    }

    private function validateTip(Order $order, int $tipCents): int
    {
        $maximum = max(self::TIP_FLOOR_CENTS, $order->total_cents);

        if ($tipCents < 0 || $tipCents > $maximum) {
            throw CheckoutException::declined('That tip amount is not valid.');
        }

        return $tipCents;
    }
}
