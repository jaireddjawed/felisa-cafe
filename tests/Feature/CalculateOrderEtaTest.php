<?php

declare(strict_types=1);

use App\Actions\Orders\CalculateOrderEta;
use App\Enums\OrderStatus;
use App\Enums\ProductCategory;
use App\Models\Order;
use App\Models\OrderItem;
use Carbon\CarbonImmutable;

/**
 * The pickup estimate. This is the one algorithm in the application, so it is
 * tested directly and thoroughly rather than through a page.
 *
 * Defaults used throughout: 120s base prep, 90s per drink, 120s buffer,
 * 2 baristas.
 */
beforeEach(function (): void {
    CarbonImmutable::setTestNow('2026-09-19 10:00:00');

    config()->set('felisa.eta', [
        'base_prep_seconds' => 120,
        'per_item_seconds' => 90,
        'buffer_seconds' => 120,
        'capacity' => 2,
    ]);
});

afterEach(function (): void {
    CarbonImmutable::setTestNow();
});

/** Builds an unsaved order with `$drinks` made-to-order items. */
function orderWithDrinks(int $drinks, OrderStatus $status = OrderStatus::Paid): Order
{
    $order = Order::factory()->status($status)->create();

    if ($drinks > 0) {
        OrderItem::factory()
            ->for($order)
            ->category(ProductCategory::Signature)
            ->quantity($drinks)
            ->create();
    }

    return $order->load('items');
}

it('adds base prep, per-item time and the buffer for a single drink', function (): void {
    $order = orderWithDrinks(1);

    // 120 base + 90 per drink + 120 buffer = 5m30s, rounded up to 6 minutes.
    expect(app(CalculateOrderEta::class)->forOrder($order)->toDateTimeString())
        ->toBe('2026-09-19 10:06:00');
});

it('charges per-item time for each drink in the order', function (): void {
    $order = orderWithDrinks(3);

    // 120 + 3×90 = 390s, +120 buffer = 8m30s → 9 minutes.
    expect(app(CalculateOrderEta::class)->forOrder($order)->toDateTimeString())
        ->toBe('2026-09-19 10:09:00');
});

it('is ready after just the buffer when nothing needs preparing', function (): void {
    $order = Order::factory()->status(OrderStatus::Paid)->create();
    OrderItem::factory()->for($order)->category(ProductCategory::Merch)->create();

    // Merch is handed over off the shelf: buffer only.
    expect(app(CalculateOrderEta::class)->forOrder($order->load('items'))->toDateTimeString())
        ->toBe('2026-09-19 10:02:00');
});

it('schedules a new order behind the orders already in the queue', function (): void {
    // Three one-drink orders, each 210s of work, across 2 baristas:
    // barista A takes #1 (done 210s) and #3 (done 420s), barista B takes #2.
    orderWithDrinks(1);
    orderWithDrinks(1);
    orderWithDrinks(1);

    $mine = orderWithDrinks(1);

    // The next free barista is B at 210s; mine finishes at 420s, +120 buffer
    // = 9 minutes exactly.
    expect(app(CalculateOrderEta::class)->forOrder($mine)->toDateTimeString())
        ->toBe('2026-09-19 10:09:00');
});

it('works the queue with more baristas in parallel', function (): void {
    config()->set('felisa.eta.capacity', 4);

    orderWithDrinks(1);
    orderWithDrinks(1);
    orderWithDrinks(1);

    $mine = orderWithDrinks(1);

    // A fourth barista is free immediately, so the queue adds no delay.
    expect(app(CalculateOrderEta::class)->forOrder($mine)->toDateTimeString())
        ->toBe('2026-09-19 10:06:00');
});

it('does not make an order wait behind itself', function (): void {
    $order = orderWithDrinks(1);

    // Re-estimating at the moment of payment must give the same answer as an
    // empty queue, not schedule the order behind its own work.
    expect(app(CalculateOrderEta::class)->forOrder($order)->toDateTimeString())
        ->toBe('2026-09-19 10:06:00');
});

it('ignores orders that are not in the preparation queue', function (): void {
    orderWithDrinks(2, OrderStatus::PendingPayment);
    orderWithDrinks(2, OrderStatus::Completed);
    orderWithDrinks(2, OrderStatus::Cancelled);
    orderWithDrinks(2, OrderStatus::Ready);

    $mine = orderWithDrinks(1);

    // None of the above occupies a barista, so the queue is empty.
    expect(app(CalculateOrderEta::class)->forOrder($mine)->toDateTimeString())
        ->toBe('2026-09-19 10:06:00');
});

it('counts an order being prepared as work still in the queue', function (): void {
    orderWithDrinks(1, OrderStatus::Preparing);
    orderWithDrinks(1, OrderStatus::Preparing);

    $mine = orderWithDrinks(1);

    // Both baristas are busy until 210s; mine then runs to 420s, +120 = 9m.
    expect(app(CalculateOrderEta::class)->forOrder($mine)->toDateTimeString())
        ->toBe('2026-09-19 10:09:00');
});

it('honours configured preparation assumptions', function (): void {
    config()->set('felisa.eta', [
        'base_prep_seconds' => 60,
        'per_item_seconds' => 30,
        'buffer_seconds' => 0,
        'capacity' => 1,
    ]);

    $order = orderWithDrinks(2);

    // 60 + 2×30 = 120s, no buffer.
    expect(app(CalculateOrderEta::class)->forOrder($order)->toDateTimeString())
        ->toBe('2026-09-19 10:02:00');
});

it('always rounds up to the next whole minute', function (): void {
    config()->set('felisa.eta.buffer_seconds', 1);

    $order = orderWithDrinks(1);

    // 210s + 1s = 3m31s, which the customer is told is 4 minutes.
    expect(app(CalculateOrderEta::class)->forOrder($order)->toDateTimeString())
        ->toBe('2026-09-19 10:04:00');
});
