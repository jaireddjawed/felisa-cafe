<?php

declare(strict_types=1);

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Square\Data\OrderState;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Folds Square's view of an order into the local record.
 *
 * This is the only place an order becomes paid, and it is safe to call any
 * number of times, in any order:
 *
 *  - a read older than what we already hold is discarded by version;
 *  - Square never un-pays an order, so a projection that regresses to
 *    "pending" is ignored;
 *  - timestamps are only ever set once.
 *
 * That is what makes duplicate webhooks, out-of-order webhooks and a
 * concurrent page refresh all converge on the same result.
 */
class ApplySquareOrderState
{
    public function __construct(private readonly CalculateOrderEta $eta) {}

    public function handle(Order $order, OrderState $state): Order
    {
        return DB::transaction(function () use ($order, $state): Order {
            // Re-read inside the transaction: a webhook may have landed while
            // this request was talking to Square.
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);

            if ($state->version < $order->square_order_version) {
                return $order;
            }

            $wasPaid = $order->status->isPaid();

            $order->square_order_id = $state->squareOrderId;
            $order->square_order_version = $state->version;

            if ($state->paymentId !== null) {
                $order->square_payment_id = $state->paymentId;
            }

            if ($state->totalCents > 0) {
                $order->total_cents = $state->totalCents;
                $order->tax_cents = $state->taxCents;
                $order->currency = $state->currency;
            }

            $status = $state->toOrderStatus();

            // Guard against a projection that would un-pay a paid order.
            if ($wasPaid && $status === OrderStatus::PendingPayment) {
                $status = $order->status;
            }

            $order->status = $status;

            if ($status->isPaid() && $order->paid_at === null) {
                $order->paid_at = now();
            }

            if ($status === OrderStatus::Completed && $order->completed_at === null) {
                $order->completed_at = $state->pickedUpAt ?? $state->closedAt ?? CarbonImmutable::now();
            }

            // Just became paid: the estimate given at checkout assumed the
            // queue at that moment, so re-estimate against the queue now.
            if (! $wasPaid && $status->inQueue()) {
                $order->estimated_ready_at = $this->eta->forOrder($order->load('items'));
            }

            $order->last_synced_at = now();
            $order->save();

            return $order;
        });
    }
}
