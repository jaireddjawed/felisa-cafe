<?php

declare(strict_types=1);

namespace App\Actions\Orders;

use App\Models\Order;
use App\Square\SquareException;
use App\Square\SquareGateway;

/**
 * Re-reads an order from Square and folds the result into the local record.
 *
 * Every route to "this order is paid" goes through here: the webhook, the
 * customer opening the order page, and the reconcile command. Nothing trusts a
 * webhook payload's contents — we always ask Square directly, which makes the
 * result the same whether events arrive twice, out of order, or not at all.
 */
class SyncOrderFromSquare
{
    public function __construct(
        private readonly SquareGateway $square,
        private readonly ApplySquareOrderState $applyState,
    ) {}

    /**
     * Syncs by Square order ID, as a webhook identifies it.
     *
     * Returns null when the order is not ours: most webhook traffic is for
     * in-store POS sales, which we acknowledge and ignore.
     *
     * @throws SquareException when Square cannot be reached
     */
    public function bySquareOrderId(string $squareOrderId): ?Order
    {
        $order = Order::query()->where('square_order_id', $squareOrderId)->first();

        if ($order === null && ! $this->couldBeAnUnlinkedOrder()) {
            return null;
        }

        $state = $this->square->getOrder($squareOrderId);

        // A checkout whose Square response was lost never stored its Square
        // order ID. Square echoes our local ID back as the reference, which
        // is how the two are reunited.
        $order ??= Order::query()
            ->whereKey($state->referenceId)
            ->whereNull('square_order_id')
            ->first();

        if ($order === null) {
            return null;
        }

        return $this->applyState->handle($order, $state);
    }

    /**
     * Refreshes a known order, unless it was just refreshed or is finished.
     * Used when a customer opens their order page, so someone arriving before
     * the webhook still sees their payment confirmed.
     */
    public function refresh(Order $order): Order
    {
        if ($order->square_order_id === null || $order->status->isTerminal()) {
            return $order;
        }

        $refreshAfter = (int) config('felisa.orders.refresh_after_seconds', 10);

        if ($order->last_synced_at !== null && $order->last_synced_at->diffInSeconds(now()) < $refreshAfter) {
            return $order;
        }

        try {
            return $this->applyState->handle($order, $this->square->getOrder($order->square_order_id));
        } catch (SquareException $exception) {
            // Showing a slightly stale order beats showing an error page.
            report($exception);

            return $order;
        }
    }

    /**
     * Whether any recent checkout could still be missing its Square order ID.
     * When none is, a webhook for an unknown order is certainly an in-store
     * sale and needs no API call at all.
     */
    private function couldBeAnUnlinkedOrder(): bool
    {
        $window = (int) config('felisa.orders.reconcile_window_hours', 48);

        return Order::query()
            ->whereNull('square_order_id')
            ->where('created_at', '>=', now()->subHours($window))
            ->exists();
    }
}
