<?php

declare(strict_types=1);

namespace App\Actions\Orders;

use App\Cart\PricedCart;
use App\Models\Order;
use Carbon\CarbonImmutable;

/**
 * Estimates when an order will be ready for pickup.
 *
 * The model is deliberately simple and explainable. Every paid, not-yet-ready
 * order is work in the queue:
 *
 *     base_prep + per_item × (made-to-order items)
 *
 * Made-to-order items are drinks: pantry goods and merch are handed over off
 * the shelf and add no work, so an order with no drinks is ready after the
 * buffer alone. `capacity` baristas work the queue in parallel, each order
 * going to whichever barista frees up first. The new order is scheduled the
 * same way behind the queue, the buffer is added for hand-off, and the result
 * is rounded up to the next minute.
 *
 * Known simplifications, on purpose: an order already being prepared still
 * counts as a full unit of work, walk-in POS orders are not in this queue,
 * and opening hours are not modelled. It is presented to customers as an
 * estimate.
 */
class CalculateOrderEta
{
    /** When this cart would be ready if it were ordered and paid for now. */
    public function forCart(PricedCart $cart): CarbonImmutable
    {
        $preparationUnits = 0;

        foreach ($cart->lines as $line) {
            if ($line->isValid() && ($line->product?->category?->requiresPreparation() ?? false)) {
                $preparationUnits += $line->quantity;
            }
        }

        return $this->schedule($preparationUnits, $this->queuedWork());
    }

    /**
     * The same estimate for an order that already exists. The order is left
     * out of the queue it is being scheduled against, so re-estimating an
     * order at the moment it is paid for does not make it wait for itself.
     */
    public function forOrder(Order $order): CarbonImmutable
    {
        return $this->schedule(
            $order->preparationUnits(),
            $this->queuedWork(excludingOrderId: $order->id),
        );
    }

    /**
     * Places `preparationUnits` of new work behind the existing queue.
     *
     * @param  list<int>  $queuedWork  seconds of work per queued order, in order
     */
    private function schedule(int $preparationUnits, array $queuedWork): CarbonImmutable
    {
        $capacity = max(1, $this->config('capacity', 2));
        $now = CarbonImmutable::now();

        // Seconds from now at which each barista next becomes free. There is
        // always at least one barista, so this list is never empty.
        $freeAt = array_fill(0, $capacity, 0);

        foreach ($queuedWork as $seconds) {
            $this->assignToFirstFree($freeAt, $seconds);
        }

        $readyInSeconds = 0;
        $work = $this->workFor($preparationUnits);

        if ($work > 0) {
            $readyInSeconds = $this->assignToFirstFree($freeAt, $work);
        }

        $readyAt = $now->addSeconds($readyInSeconds + $this->config('buffer_seconds', 120));

        return $readyAt->second === 0 && $readyAt->micro === 0
            ? $readyAt
            : $readyAt->addMinute()->startOfMinute();
    }

    /**
     * Gives the work to whichever barista frees up first, and returns when
     * that piece of work finishes.
     *
     * @param  non-empty-list<int>  $freeAt
     *
     * @param-out non-empty-list<int> $freeAt
     */
    private function assignToFirstFree(array &$freeAt, int $seconds): int
    {
        $earliest = min($freeAt);
        $index = (int) array_search($earliest, $freeAt, true);
        $finishesAt = $earliest + $seconds;

        $updated = $freeAt;
        $updated[$index] = $finishesAt;
        $freeAt = array_values($updated);

        return $finishesAt;
    }

    /** Seconds of barista work an order with this many drinks represents. */
    private function workFor(int $preparationUnits): int
    {
        if ($preparationUnits === 0) {
            return 0;
        }

        return $this->config('base_prep_seconds', 120)
            + $preparationUnits * $this->config('per_item_seconds', 90);
    }

    /**
     * The work already in the queue, oldest payment first.
     *
     * @return list<int>
     */
    private function queuedWork(?int $excludingOrderId = null): array
    {
        $orders = Order::query()
            ->inQueue()
            ->when($excludingOrderId !== null, fn ($query) => $query->whereKeyNot($excludingOrderId))
            ->with('items')
            ->get();

        $work = [];

        foreach ($orders as $order) {
            $seconds = $this->workFor($order->preparationUnits());

            if ($seconds > 0) {
                $work[] = $seconds;
            }
        }

        return $work;
    }

    private function config(string $key, int $default): int
    {
        $value = config("felisa.eta.{$key}", $default);

        return is_int($value) ? $value : $default;
    }
}
