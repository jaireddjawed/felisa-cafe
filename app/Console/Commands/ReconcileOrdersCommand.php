<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\Orders\SyncOrderFromSquare;
use App\Models\Order;
use App\Square\SquareException;
use Illuminate\Console\Command;

/**
 * Re-reads recent unsettled orders from Square. This is the safety net for
 * webhooks that were never delivered, because of a misconfigured subscription
 * or downtime at either end.
 */
class ReconcileOrdersCommand extends Command
{
    protected $signature = 'square:reconcile-orders';

    protected $description = 'Re-read recent unsettled orders from Square (recovers missed webhooks)';

    public function handle(SyncOrderFromSquare $sync): int
    {
        $window = (int) config('felisa.orders.reconcile_window_hours', 48);

        $orders = Order::query()
            ->unsettled()
            ->where('created_at', '>=', now()->subHours($window))
            ->limit(200)
            ->get();

        $reconciled = 0;

        foreach ($orders as $order) {
            if ($order->square_order_id === null) {
                continue;
            }

            try {
                $sync->bySquareOrderId($order->square_order_id);
                $reconciled++;
            } catch (SquareException $exception) {
                $this->warn("Order {$order->id}: {$exception->getMessage()}");
            }
        }

        $this->info("Reconciled {$reconciled} of {$orders->count()} unsettled orders.");

        return self::SUCCESS;
    }
}
