<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\ProcessedWebhookEvent;
use App\Models\Product;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\Support\FakeSquare;

/**
 * Square delivers webhooks at least once, in no particular order, and
 * sometimes before the browser gets back from the payment. These tests pin
 * down that none of that can corrupt an order.
 */

/** Posts a webhook with a valid Square signature. */
function postWebhook(array $payload): TestResponse
{
    $body = json_encode($payload, JSON_THROW_ON_ERROR);

    return test()->call(
        method: 'POST',
        uri: route('webhooks.square'),
        server: [
            'HTTP_X_SQUARE_HMACSHA256_SIGNATURE' => FakeSquare::signature($body),
            'CONTENT_TYPE' => 'application/json',
        ],
        content: $body,
    );
}

function paymentEvent(string $eventId, string $squareOrderId = 'SQ_ORDER_1'): array
{
    return [
        'event_id' => $eventId,
        'type' => 'payment.updated',
        'data' => [
            'type' => 'payment',
            'id' => 'SQ_PAY_1',
            'object' => ['payment' => ['id' => 'SQ_PAY_1', 'order_id' => $squareOrderId]],
        ],
    ];
}

it('rejects a webhook with a bad signature', function (): void {
    $order = Order::factory()->create(['square_order_id' => 'SQ_ORDER_1']);

    $this->call(
        method: 'POST',
        uri: route('webhooks.square'),
        server: ['HTTP_X_SQUARE_HMACSHA256_SIGNATURE' => 'not-the-real-signature'],
        content: json_encode(paymentEvent('evt_1'), JSON_THROW_ON_ERROR),
    )->assertUnauthorized();

    expect($order->fresh()->status)->toBe(OrderStatus::PendingPayment);
    Http::assertNothingSent();
});

it('rejects a webhook with no signature at all', function (): void {
    $this->withMiddleware()->postJson(route('webhooks.square'), paymentEvent('evt_1'))
        ->assertUnauthorized();
});

it('rejects a signature computed over a different body', function (): void {
    $this->call(
        method: 'POST',
        uri: route('webhooks.square'),
        server: [
            'HTTP_X_SQUARE_HMACSHA256_SIGNATURE' => FakeSquare::signature('{"event_id":"other"}'),
        ],
        content: json_encode(paymentEvent('evt_1'), JSON_THROW_ON_ERROR),
    )->assertUnauthorized();
});

it('marks an order paid from a verified webhook', function (): void {
    $order = Order::factory()->create(['square_order_id' => 'SQ_ORDER_1', 'total_cents' => 918]);

    FakeSquare::fake([
        '/v2/orders/*' => Http::response(FakeSquare::order(
            referenceId: (string) $order->id, totalCents: 918, paid: true, version: 2,
        )),
    ]);

    postWebhook(paymentEvent('evt_1'))->assertNoContent();

    $order->refresh();

    expect($order->status)->toBe(OrderStatus::Paid)
        ->and($order->paid_at)->not->toBeNull()
        ->and($order->square_payment_id)->toBe('SQ_PAY_1');
});

it('never trusts the payload: it re-reads the order from Square', function (): void {
    $order = Order::factory()->create(['square_order_id' => 'SQ_ORDER_1']);

    // The event claims a completed payment; Square says the order is unpaid.
    FakeSquare::fake([
        '/v2/orders/*' => Http::response(FakeSquare::order(
            referenceId: (string) $order->id, paid: false,
        )),
    ]);

    postWebhook([
        'event_id' => 'evt_lying',
        'type' => 'payment.updated',
        'data' => [
            'type' => 'payment',
            'id' => 'SQ_PAY_1',
            'object' => ['payment' => [
                'id' => 'SQ_PAY_1',
                'order_id' => 'SQ_ORDER_1',
                'status' => 'COMPLETED',
                'amount_money' => ['amount' => 918, 'currency' => 'USD'],
            ]],
        ],
    ])->assertNoContent();

    expect($order->fresh()->status)->toBe(OrderStatus::PendingPayment);
});

it('ignores a duplicate delivery of the same event', function (): void {
    $order = Order::factory()->create(['square_order_id' => 'SQ_ORDER_1']);

    FakeSquare::fake([
        '/v2/orders/*' => Http::response(FakeSquare::order(
            referenceId: (string) $order->id, paid: true, version: 2,
        )),
    ]);

    postWebhook(paymentEvent('evt_same'))->assertNoContent();
    postWebhook(paymentEvent('evt_same'))->assertNoContent();

    expect(ProcessedWebhookEvent::query()->count())->toBe(1)
        // The second delivery does no work at all.
        ->and(Http::recorded()->count())->toBe(1)
        ->and($order->fresh()->status)->toBe(OrderStatus::Paid);
});

it('ignores a Square order version older than the one we hold', function (): void {
    $order = Order::factory()->paid()->create([
        'square_order_id' => 'SQ_ORDER_1',
        'square_order_version' => 5,
        'status' => OrderStatus::Ready,
    ]);

    FakeSquare::fake([
        '/v2/orders/*' => Http::response(FakeSquare::order(
            referenceId: (string) $order->id, paid: true, version: 2, fulfillmentState: 'PROPOSED',
        )),
    ]);

    postWebhook(paymentEvent('evt_stale'))->assertNoContent();

    // A late delivery of an older state must not walk the order backwards.
    expect($order->fresh()->status)->toBe(OrderStatus::Ready);
});

it('never un-pays an order', function (): void {
    $order = Order::factory()->paid()->create([
        'square_order_id' => 'SQ_ORDER_1',
        'square_order_version' => 1,
    ]);

    FakeSquare::fake([
        '/v2/orders/*' => Http::response(FakeSquare::order(
            referenceId: (string) $order->id, paid: false, version: 9,
        )),
    ]);

    postWebhook(paymentEvent('evt_unpay'))->assertNoContent();

    expect($order->fresh()->status)->toBe(OrderStatus::Paid);
});

it('follows the fulfillment through to ready and completed', function (string $fulfillment, OrderStatus $expected): void {
    $order = Order::factory()->paid()->create([
        'square_order_id' => 'SQ_ORDER_1',
        'square_order_version' => 1,
    ]);

    FakeSquare::fake([
        '/v2/orders/*' => Http::response(FakeSquare::order(
            referenceId: (string) $order->id, paid: true, version: 2, fulfillmentState: $fulfillment,
        )),
    ]);

    postWebhook(['event_id' => 'evt_'.$fulfillment, 'type' => 'order.fulfillment.updated', 'data' => [
        'type' => 'order',
        'id' => 'SQ_ORDER_1',
        'object' => ['order_fulfillment_updated' => ['order_id' => 'SQ_ORDER_1']],
    ]])->assertNoContent();

    expect($order->fresh()->status)->toBe($expected);
})->with([
    ['RESERVED', OrderStatus::Preparing],
    ['PREPARED', OrderStatus::Ready],
    ['COMPLETED', OrderStatus::Completed],
    ['CANCELED', OrderStatus::Cancelled],
]);

it('acknowledges events for orders that are not ours', function (): void {
    // An in-store POS sale. There are no unlinked local orders, so we should
    // not even ask Square about it.
    postWebhook(paymentEvent('evt_pos', 'SQ_ORDER_IN_STORE'))->assertNoContent();

    Http::assertNothingSent();
    expect(ProcessedWebhookEvent::query()->count())->toBe(1);
});

it('reunites an order whose Square response was lost, using the reference', function (): void {
    // Checkout timed out after Square created the order, so we never stored
    // its Square ID. Square echoes our local ID back as reference_id.
    $order = Order::factory()->unlinked()->create();

    FakeSquare::fake([
        '/v2/orders/*' => Http::response(FakeSquare::order(
            referenceId: (string) $order->id, paid: true, version: 2,
        )),
    ]);

    postWebhook(paymentEvent('evt_lost', 'SQ_ORDER_1'))->assertNoContent();

    $order->refresh();

    expect($order->square_order_id)->toBe('SQ_ORDER_1')
        ->and($order->status)->toBe(OrderStatus::Paid);
});

it('asks Square to redeliver when the order cannot be read', function (): void {
    Order::factory()->create(['square_order_id' => 'SQ_ORDER_1']);

    FakeSquare::fake(['/v2/orders/*' => Http::response('', 503)]);

    postWebhook(paymentEvent('evt_down'))->assertStatus(500);

    // Not recorded as processed, so the redelivery will be handled.
    expect(ProcessedWebhookEvent::query()->count())->toBe(0);
});

it('resyncs the catalog on a catalog webhook', function (): void {
    FakeSquare::fakeCatalog(
        FakeSquare::item('ITEM_NEW', 'New Drink', [
            FakeSquare::variation('VAR_NEW', 'Regular', 850, 'ITEM_NEW'),
        ]),
    );

    postWebhook(['event_id' => 'evt_catalog', 'type' => 'catalog.version.updated', 'data' => [
        'type' => 'catalog_version',
        'id' => 'x',
        'object' => ['catalog_version' => ['updated_at' => '2026-09-19T10:00:00Z']],
    ]])->assertNoContent();

    expect(Product::query()->where('square_item_id', 'ITEM_NEW')->exists())->toBeTrue();
});

it('acknowledges event types it has no use for', function (): void {
    postWebhook([
        'event_id' => 'evt_other',
        'type' => 'customer.created',
        'data' => ['type' => 'customer', 'id' => 'CUST_1', 'object' => ['customer' => ['id' => 'CUST_1']]],
    ])->assertNoContent();

    Http::assertNothingSent();
});

it('discards a malformed event without asking for redelivery', function (): void {
    postWebhook(['not' => 'an event'])->assertNoContent();

    expect(ProcessedWebhookEvent::query()->count())->toBe(0);
});

it('rejects a body that is not JSON', function (): void {
    $this->call(
        method: 'POST',
        uri: route('webhooks.square'),
        server: ['HTTP_X_SQUARE_HMACSHA256_SIGNATURE' => FakeSquare::signature('not json')],
        content: 'not json',
    )->assertBadRequest();
});

it('reports unconfigured webhooks rather than accepting them', function (): void {
    config()->set('square.webhook_signature_key', null);

    postWebhook(paymentEvent('evt_1'))->assertStatus(503);
});
