<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use Tests\Support\FakeSquare;

/**
 * Who can see an order, and what an order looks like once it exists.
 *
 * Unauthorized access answers 404 rather than 403 throughout, so nobody can
 * discover which order IDs are real by probing them.
 */
it('shows a customer their own order', function (): void {
    $user = User::factory()->create();
    $order = Order::factory()->paid()->for($user)->create();
    OrderItem::factory()->for($order)->create(['product_name' => 'Felisa Latte']);

    FakeSquare::fake(['/v2/orders/*' => Http::response(FakeSquare::order(
        referenceId: (string) $order->id, paid: true, version: 2,
    ))]);

    $this->actingAs($user)
        ->get(route('orders.show', $order))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('orders/show')
            ->where('order.id', $order->id)
            ->where('order.items.0.productName', 'Felisa Latte')
        );
});

it('hides an order from a different customer', function (): void {
    $order = Order::factory()->paid()->for(User::factory())->create();

    $this->actingAs(User::factory()->create())
        ->get(route('orders.show', $order))
        ->assertNotFound();
});

it('hides an account order from guests', function (): void {
    $order = Order::factory()->paid()->for(User::factory())->create();

    $this->get(route('orders.show', $order))->assertNotFound();
});

it('hides a guest order from everyone but the session that placed it', function (): void {
    $order = Order::factory()->paid()->create(['user_id' => null]);

    $this->get(route('orders.show', $order))->assertNotFound();

    $this->actingAs(User::factory()->create())
        ->get(route('orders.show', $order))
        ->assertNotFound();
});

it('shows a guest the order their own session placed', function (): void {
    $order = Order::factory()->paid()->create(['user_id' => null]);
    OrderItem::factory()->for($order)->create();

    FakeSquare::fake(['/v2/orders/*' => Http::response(FakeSquare::order(
        referenceId: (string) $order->id, paid: true, version: 2,
    ))]);

    $this->withSession(['guest_order_ids' => [$order->id]])
        ->get(route('orders.show', $order))
        ->assertOk();
});

it('refreshes an unsettled order from Square when it is opened', function (): void {
    $order = Order::factory()->create([
        'square_order_id' => 'SQ_ORDER_1',
        'status' => OrderStatus::PendingPayment,
        'total_cents' => 918,
    ]);
    OrderItem::factory()->for($order)->create();

    // The webhook has not arrived yet, but Square already has the payment.
    FakeSquare::fake(['/v2/orders/*' => Http::response(FakeSquare::order(
        referenceId: (string) $order->id, totalCents: 918, paid: true, version: 2,
    ))]);

    $this->withSession(['guest_order_ids' => [$order->id]])
        ->get(route('orders.show', $order))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('order.status', 'paid')
            ->where('order.isPaid', true)
        );

    expect($order->fresh()->status)->toBe(OrderStatus::Paid);
});

it('does not refresh an order that is already finished', function (): void {
    $order = Order::factory()->create([
        'square_order_id' => 'SQ_ORDER_1',
        'status' => OrderStatus::Completed,
        'last_synced_at' => now()->subHour(),
    ]);
    OrderItem::factory()->for($order)->create();

    $this->withSession(['guest_order_ids' => [$order->id]])
        ->get(route('orders.show', $order))
        ->assertOk();

    Http::assertNothingSent();
});

it('does not hammer Square when an order page is reloaded', function (): void {
    $order = Order::factory()->create([
        'square_order_id' => 'SQ_ORDER_1',
        'status' => OrderStatus::PendingPayment,
        'last_synced_at' => now(),
    ]);
    OrderItem::factory()->for($order)->create();

    $this->withSession(['guest_order_ids' => [$order->id]])
        ->get(route('orders.show', $order))
        ->assertOk();

    Http::assertNothingSent();
});

it('still shows the order when Square is unreachable', function (): void {
    $order = Order::factory()->paid()->create([
        'square_order_id' => 'SQ_ORDER_1',
        'last_synced_at' => now()->subHour(),
    ]);
    OrderItem::factory()->for($order)->create();

    FakeSquare::fake(['/v2/orders/*' => Http::response('', 503)]);

    $this->withSession(['guest_order_ids' => [$order->id]])
        ->get(route('orders.show', $order))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->where('order.status', 'paid'));
});

it('lists a customer their order history, newest first', function (): void {
    $user = User::factory()->create();

    $older = Order::factory()->paid()->for($user)->create(['created_at' => now()->subDay()]);
    $newer = Order::factory()->paid()->for($user)->create(['created_at' => now()]);
    OrderItem::factory()->for($older)->create();
    OrderItem::factory()->for($newer)->create();

    $this->actingAs($user)
        ->get(route('orders'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('orders/index')
            ->has('orders', 2)
            ->where('orders.0.id', $newer->id)
            ->where('orders.1.id', $older->id)
        );
});

it('never shows one customer another customer orders', function (): void {
    $user = User::factory()->create();
    Order::factory()->paid()->for($user)->create();
    Order::factory()->paid()->for(User::factory())->create();
    Order::factory()->paid()->create(['user_id' => null]);

    $this->actingAs($user)
        ->get(route('orders'))
        ->assertInertia(fn (AssertableInertia $page) => $page->has('orders', 1));
});

it('requires an account to see order history', function (): void {
    $this->get(route('orders'))->assertRedirect(route('login'));
});

it('shows historical prices, not current ones', function (): void {
    $user = User::factory()->create();
    $order = Order::factory()->paid()->for($user)->create([
        'subtotal_cents' => 850,
        'total_cents' => 918,
        'tax_cents' => 68,
    ]);
    OrderItem::factory()->for($order)->create([
        'product_name' => 'Felisa Latte',
        'unit_price_cents' => 850,
        'total_cents' => 850,
    ]);

    $this->actingAs($user)
        ->get(route('orders'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('orders.0.total.formatted', '$9.18')
            ->where('orders.0.items.0.total.formatted', '$8.50')
        );
});

it('describes each line with the options chosen at the time', function (): void {
    $user = User::factory()->create();
    $order = Order::factory()->paid()->for($user)->create();
    OrderItem::factory()->for($order)->create([
        'variation_name' => 'Espresso',
        'modifiers' => [
            ['square_modifier_id' => 'MOD_OAT', 'name' => 'Oat Milk', 'price_cents' => 0],
        ],
    ]);

    $this->actingAs($user)
        ->get(route('orders'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('orders.0.items.0.options', 'Espresso · Oat Milk')
        );
});

it('404s for an order that does not exist', function (): void {
    $this->get(route('orders.show', 123456))->assertNotFound();
});

it('reconciles unsettled orders that missed their webhook', function (): void {
    $order = Order::factory()->create([
        'square_order_id' => 'SQ_ORDER_1',
        'status' => OrderStatus::PendingPayment,
    ]);
    OrderItem::factory()->for($order)->create();

    FakeSquare::fake(['/v2/orders/*' => Http::response(FakeSquare::order(
        referenceId: (string) $order->id, paid: true, version: 2,
    ))]);

    $this->artisan('square:reconcile-orders')
        ->expectsOutputToContain('Reconciled 1')
        ->assertSuccessful();

    expect($order->fresh()->status)->toBe(OrderStatus::Paid);
});

it('leaves settled orders alone when reconciling', function (): void {
    Order::factory()->create([
        'square_order_id' => 'SQ_ORDER_1',
        'status' => OrderStatus::Completed,
    ]);

    $this->artisan('square:reconcile-orders')->assertSuccessful();

    Http::assertNothingSent();
});
