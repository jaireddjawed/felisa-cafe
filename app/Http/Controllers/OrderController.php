<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Orders\SyncOrderFromSquare;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    /** A signed-in customer's order history, newest first. */
    public function index(Request $request): Response
    {
        $orders = Order::query()
            ->where('user_id', $request->user()?->id)
            ->with('items')
            ->latest()
            ->limit((int) config('felisa.orders.history_limit', 50))
            ->get();

        return Inertia::render('orders/index', [
            'orders' => $orders->map(fn (Order $order): array => $this->payload($order))->all(),
        ]);
    }

    /**
     * One order's status. Unsettled orders are refreshed from Square first,
     * so a customer who lands here before the webhook arrives still sees
     * their payment confirmed.
     */
    public function show(Order $order, SyncOrderFromSquare $sync): Response
    {
        // 404 rather than 403: someone guessing order IDs must not be able to
        // learn which ones exist.
        abort_unless(Gate::allows('view', $order), 404);

        $order = $sync->refresh($order);

        return Inertia::render('orders/show', [
            'order' => $this->payload($order->load('items')),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Order $order): array
    {
        return [
            'id' => $order->id,
            'reference' => $order->reference(),
            'status' => $order->status->value,
            'statusLabel' => $order->status->label(),
            'isPaid' => $order->status->isPaid(),
            'placedAt' => $order->created_at?->toIso8601String(),
            'estimatedReadyAt' => $order->estimated_ready_at?->toIso8601String(),
            'customerName' => $order->customer_name,
            'subtotal' => $order->subtotal()->toArray(),
            'tax' => $order->tax()->toArray(),
            'tip' => $order->tip()->toArray(),
            'total' => $order->total()->toArray(),
            'items' => $order->items
                ->map(fn ($item): array => [
                    'id' => $item->id,
                    'productName' => $item->product_name,
                    'productSlug' => $item->product_slug,
                    'options' => $item->optionsSummary(),
                    'quantity' => $item->quantity,
                    'note' => $item->note,
                    'unitPrice' => $item->unitPrice()->toArray(),
                    'total' => $item->total()->toArray(),
                ])
                ->all(),
        ];
    }
}
