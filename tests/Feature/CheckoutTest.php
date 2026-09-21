<?php

declare(strict_types=1);

use App\Enums\CatalogStatus;
use App\Enums\OrderStatus;
use App\Enums\ProductCategory;
use App\Models\Modifier;
use App\Models\ModifierList;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Notifications\OrderReceipt;
use App\Square\IdempotencyKey;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia;
use Tests\Support\FakeSquare;

/**
 * Checkout: cart → validated and re-priced → Square order → Square payment.
 *
 * The rules being protected here are that prices always come from the server,
 * that "paid" only ever comes from Square, and that a retry can never create a
 * second order or a second charge.
 */

/** An $8.50 latte with free milk options, already in the session cart. */
function checkoutReadyCart(): Product
{
    $product = Product::factory()->withVariation(850, 'Espresso')->create([
        'name' => 'Felisa Latte',
        'slug' => 'felisa-latte',
    ]);

    $milk = ModifierList::factory()->pickOne()->create(['name' => 'Milk']);
    Modifier::factory()->for($milk, 'modifierList')->create([
        'square_modifier_id' => 'MOD_OAT', 'name' => 'Oat Milk', 'price_cents' => 0,
    ]);
    $product->modifierLists()->attach($milk, ['min_selected' => 1, 'max_selected' => 1]);

    test()->post(route('cart.store'), [
        'variation_id' => $product->load('variations')->variations->firstOrFail()->square_variation_id,
        'modifier_ids' => ['MOD_OAT'],
        'quantity' => 1,
    ]);

    return $product;
}

/** Square accepts the order and the payment; tax takes the total to $9.18. */
function fakeSuccessfulSquare(int $totalCents = 918, int $taxCents = 68): void
{
    FakeSquare::fake([
        '/v2/catalog/batch-retrieve' => Http::response(
            FakeSquare::livePrices(variationPrices: ['*' => 850], modifierPrices: ['MOD_OAT' => 0])
        ),
        '/v2/orders/calculate' => Http::response(FakeSquare::order(totalCents: $totalCents, taxCents: $taxCents)),
        '/v2/orders' => Http::response(FakeSquare::order(totalCents: $totalCents, taxCents: $taxCents)),
        '/v2/payments' => Http::response(FakeSquare::payment()),
        '/v2/orders/*' => Http::response(FakeSquare::order(
            totalCents: $totalCents, taxCents: $taxCents, paid: true, version: 2,
        )),
    ]);
}

/**
 * The live-price check looks up the cart's real variation ID, so build the
 * fake from the product that is actually in the cart.
 */
function fakeSquareFor(Product $product, int $priceCents = 850, int $totalCents = 918, int $taxCents = 68): void
{
    $variationId = $product->load('variations')->variations->firstOrFail()->square_variation_id;

    FakeSquare::fake([
        '/v2/catalog/batch-retrieve' => Http::response(FakeSquare::livePrices(
            variationPrices: [$variationId => $priceCents],
            modifierPrices: ['MOD_OAT' => 0],
        )),
        '/v2/orders/calculate' => Http::response(FakeSquare::order(totalCents: $totalCents, taxCents: $taxCents)),
        '/v2/orders' => Http::response(FakeSquare::order(totalCents: $totalCents, taxCents: $taxCents)),
        '/v2/payments' => Http::response(FakeSquare::payment()),
        '/v2/orders/*' => Http::response(FakeSquare::order(
            totalCents: $totalCents, taxCents: $taxCents, paid: true, version: 2,
        )),
    ]);
}

function checkoutPayload(array $overrides = []): array
{
    return [
        'name' => 'Jaired',
        'email' => 'jaired@example.com',
        'source_id' => 'cnon:card-nonce-ok',
        'idempotency_key' => 'checkout-key-0000000001',
        ...$overrides,
    ];
}

it('lets a guest check out without an account', function (): void {
    Notification::fake();

    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $response = $this->post(route('checkout.store'), checkoutPayload());

    $order = Order::query()->with('items')->firstOrFail();

    $response->assertRedirect(route('orders.show', $order));

    expect($order->user_id)->toBeNull()
        ->and($order->status)->toBe(OrderStatus::Paid)
        ->and($order->customer_email)->toBe('jaired@example.com')
        ->and($order->square_order_id)->toBe('SQ_ORDER_1')
        ->and($order->square_payment_id)->toBe('SQ_PAY_1')
        ->and($order->receipt_sent_at)->not->toBeNull()
        ->and($order->items)->toHaveCount(1);

    Notification::assertSentOnDemand(OrderReceipt::class);
});

it('attaches the order to a signed-in customer', function (): void {
    $user = User::factory()->create();
    $this->actingAs($user);

    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload());

    expect(Order::query()->firstOrFail()->user_id)->toBe($user->id);
});

it("takes a signed-in customer's name and email from their account", function (): void {
    $user = User::factory()->create(['name' => 'Jaired', 'email' => 'account@example.com']);
    $this->actingAs($user);

    $product = checkoutReadyCart();
    fakeSquareFor($product);

    // The form no longer asks a signed-in customer for either.
    $payload = checkoutPayload();
    unset($payload['name'], $payload['email']);

    $this->post(route('checkout.store'), $payload)->assertSessionHasNoErrors();

    $order = Order::query()->firstOrFail();

    expect($order->customer_name)->toBe('Jaired')
        ->and($order->customer_email)->toBe('account@example.com')
        ->and($order->status)->toBe(OrderStatus::Paid);
});

it('sends the receipt to the confirmed address while the new one is unconfirmed', function (): void {
    Notification::fake();

    $user = User::factory()->unverified()->create([
        'email' => 'new@example.com',
        'last_confirmed_email' => 'old@example.com',
    ]);
    $this->actingAs($user);

    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload())->assertSessionHasNoErrors();

    $order = Order::query()->firstOrFail();

    expect($order->customer_email)->toBe('old@example.com')
        ->and($order->receipt_sent_at)->not->toBeNull();

    Notification::assertSentOnDemand(
        OrderReceipt::class,
        fn ($notification, array $channels, $notifiable): bool => array_key_exists('old@example.com', $notifiable->routes['mail']),
    );
});

it('sends the receipt to the new address once it is confirmed', function (): void {
    Notification::fake();

    $user = User::factory()->create([
        'email' => 'new@example.com',
        'last_confirmed_email' => 'old@example.com',
    ]);
    $this->actingAs($user);

    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload())->assertSessionHasNoErrors();

    expect(Order::query()->firstOrFail()->customer_email)->toBe('new@example.com');
});

it('tells the checkout page where the receipt will go', function (): void {
    $user = User::factory()->unverified()->create([
        'email' => 'new@example.com',
        'last_confirmed_email' => 'old@example.com',
    ]);

    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->actingAs($user)
        ->get(route('checkout'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('receiptEmail', 'old@example.com')
            ->where('emailConfirmed', false)
        );

    $this->post(route('logout'));

    $this->get(route('checkout'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('receiptEmail', null)
            ->where('emailConfirmed', true)
        );
});

it('ignores a different name and email sent for a signed-in customer', function (): void {
    $this->actingAs(User::factory()->create(['name' => 'Jaired', 'email' => 'account@example.com']));

    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload([
        'name' => 'Someone Else',
        'email' => 'someone.else@example.com',
    ]));

    $order = Order::query()->firstOrFail();

    // The account is the source of truth, so a tampered form cannot redirect
    // the receipt or rename the pickup.
    expect($order->customer_name)->toBe('Jaired')
        ->and($order->customer_email)->toBe('account@example.com');
});

it('prices the order from local products, not from the browser', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload([
        'subtotal_cents' => 1,
        'total_cents' => 1,
        'tax_cents' => 0,
    ]));

    $order = Order::query()->firstOrFail();

    expect($order->subtotal_cents)->toBe(850)
        // Square's own total wins for tax.
        ->and($order->total_cents)->toBe(918)
        ->and($order->tax_cents)->toBe(68);
});

it('snapshots names and prices onto the order', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload());

    $item = Order::query()->firstOrFail()->items()->firstOrFail();

    expect($item->product_name)->toBe('Felisa Latte')
        ->and($item->variation_name)->toBe('Espresso')
        ->and($item->unit_price_cents)->toBe(850)
        ->and($item->modifiers)->toBe([
            ['square_modifier_id' => 'MOD_OAT', 'name' => 'Oat Milk', 'price_cents' => 0],
        ]);

    // The snapshot has to outlive the catalog.
    $product->delete();

    expect($item->fresh()->product_name)->toBe('Felisa Latte')
        ->and($item->fresh()->unit_price_cents)->toBe(850);
});

it('empties the cart once the order exists', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload());

    $this->get(route('cart'))
        ->assertInertia(fn (AssertableInertia $page) => $page->has('cart.lines', 0));
});

it('sends Square only catalog IDs and quantities', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);
    $variationId = $product->variations->firstOrFail()->square_variation_id;

    $this->post(route('checkout.store'), checkoutPayload());

    Http::assertSent(function ($request) use ($variationId): bool {
        if (! str_ends_with($request->url(), '/v2/orders')) {
            return false;
        }

        $lineItem = $request->data()['order']['line_items'][0];

        // Square prices the order itself; we never send an amount.
        return $lineItem['catalog_object_id'] === $variationId
            && $lineItem['quantity'] === '1'
            && ! isset($lineItem['base_price_money']);
    });
});

it('refuses to check out an empty cart', function (): void {
    fakeSuccessfulSquare();

    $this->post(route('checkout.store'), checkoutPayload())
        ->assertSessionHasErrors('checkout');

    expect(Order::query()->count())->toBe(0);
});

it('requires a name and email', function (): void {
    checkoutReadyCart();

    $this->post(route('checkout.store'), checkoutPayload(['name' => '', 'email' => '']))
        ->assertSessionHasErrors(['name', 'email']);

    expect(Order::query()->count())->toBe(0);
});

it('requires a card token', function (): void {
    checkoutReadyCart();

    $this->post(route('checkout.store'), checkoutPayload(['source_id' => '']))
        ->assertSessionHasErrors('source_id');
});

it('refuses to charge when Square disagrees with our cached price', function (): void {
    $product = checkoutReadyCart();

    // Square now says the latte is $9.50, our cache still says $8.50.
    fakeSquareFor($product, priceCents: 950);

    $this->post(route('checkout.store'), checkoutPayload())
        ->assertSessionHasErrors('checkout');

    expect(Order::query()->count())->toBe(0);
    Http::assertNotSent(fn ($request): bool => str_contains($request->url(), '/v2/payments'));
});

it('refuses to charge when Square cannot be reached to verify prices', function (): void {
    checkoutReadyCart();

    FakeSquare::fake(['/v2/catalog/batch-retrieve' => Http::response('', 503)]);

    $this->post(route('checkout.store'), checkoutPayload())
        ->assertSessionHasErrors('checkout');

    expect(Order::query()->count())->toBe(0);
});

it('refuses to check out a cart containing an unavailable item', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $product->update(['status' => CatalogStatus::Archived]);

    $this->post(route('checkout.store'), checkoutPayload())
        ->assertSessionHasErrors('checkout');

    expect(Order::query()->count())->toBe(0);
});

it('keeps the order pending when Square rejects the card', function (): void {
    $product = checkoutReadyCart();
    $variationId = $product->load('variations')->variations->firstOrFail()->square_variation_id;

    FakeSquare::fake([
        '/v2/catalog/batch-retrieve' => Http::response(FakeSquare::livePrices(
            variationPrices: [$variationId => 850], modifierPrices: ['MOD_OAT' => 0],
        )),
        '/v2/orders' => Http::response(FakeSquare::order()),
        '/v2/payments' => Http::response([
            'errors' => [['code' => 'CARD_DECLINED', 'detail' => 'Card declined.']],
        ], 402),
    ]);

    $this->post(route('checkout.store'), checkoutPayload())
        ->assertSessionHasErrors('checkout');

    $order = Order::query()->firstOrFail();

    expect($order->status)->toBe(OrderStatus::PendingPayment)
        ->and($order->paid_at)->toBeNull();
});

it('resumes the same order when a declined checkout is retried', function (): void {
    $product = checkoutReadyCart();
    $variationId = $product->load('variations')->variations->firstOrFail()->square_variation_id;

    FakeSquare::fake([
        '/v2/catalog/batch-retrieve' => Http::response(FakeSquare::livePrices(
            variationPrices: [$variationId => 850], modifierPrices: ['MOD_OAT' => 0],
        )),
        '/v2/orders' => Http::response(FakeSquare::order()),
        '/v2/payments' => Http::response(['errors' => [['code' => 'CARD_DECLINED']]], 402),
    ]);

    $this->post(route('checkout.store'), checkoutPayload());

    expect(Order::query()->count())->toBe(1);

    // The customer tries another card, reusing the same idempotency key.
    fakeSquareFor($product);
    $this->post(route('checkout.store'), checkoutPayload());

    expect(Order::query()->count())->toBe(1)
        ->and(Order::query()->firstOrFail()->status)->toBe(OrderStatus::Paid);
});

it('never creates a second order for a resubmitted form', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload());
    $this->post(route('checkout.store'), checkoutPayload());

    expect(Order::query()->count())->toBe(1);
});

it('never charges twice for a resubmitted form', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload());
    $this->post(route('checkout.store'), checkoutPayload());

    // The second attempt finds the order already paid and stops there.
    Http::assertSentCount(4);
});

it('derives the Square order key from the checkout key, so a retry replays it', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload());

    // Not from the local order ID: two environments sharing one Square account
    // each hand out "order 4", and Square would replay the first one's paid
    // order for the second. The browser's random key is unique to a checkout.
    $expected = IdempotencyKey::make('felisa-order', 'checkout-key-0000000001');

    Http::assertSent(fn ($request): bool => str_ends_with($request->url(), '/v2/orders')
        && $request->data()['idempotency_key'] === $expected);
});

it('sends Square the same order key when the same checkout is retried', function (): void {
    $product = checkoutReadyCart();
    $variationId = $product->load('variations')->variations->firstOrFail()->square_variation_id;

    // The first attempt reaches Square but its response is lost.
    FakeSquare::fake([
        '/v2/catalog/batch-retrieve' => Http::response(FakeSquare::livePrices(
            variationPrices: [$variationId => 850], modifierPrices: ['MOD_OAT' => 0],
        )),
        '/v2/orders' => Http::response('', 503),
    ]);
    $this->post(route('checkout.store'), checkoutPayload());

    fakeSquareFor($product);
    $this->post(route('checkout.store'), checkoutPayload());

    $keys = Http::recorded(fn ($request): bool => str_ends_with($request->url(), '/v2/orders'))
        ->map(fn (array $pair): string => $pair[0]->data()['idempotency_key'])
        ->unique();

    expect($keys)->toHaveCount(1);
});

/** Square accepts the order and refuses the payment with this error. */
function fakeSquareRefusingPayment(Product $product, int $status, string $code, string $detail = ''): void
{
    $variationId = $product->load('variations')->variations->firstOrFail()->square_variation_id;

    FakeSquare::fake([
        '/v2/catalog/batch-retrieve' => Http::response(FakeSquare::livePrices(
            variationPrices: [$variationId => 850], modifierPrices: ['MOD_OAT' => 0],
        )),
        '/v2/orders' => Http::response(FakeSquare::order()),
        '/v2/payments' => Http::response(['errors' => [['code' => $code, 'detail' => $detail]]], $status),
    ]);
}

/**
 * The idempotency keys sent to Square's payments endpoint, in order.
 *
 * @return list<string>
 */
function paymentKeysSent(): array
{
    return Http::recorded(fn ($request): bool => str_ends_with($request->url(), '/v2/payments'))
        ->map(fn (array $pair): string => $pair[0]->data()['idempotency_key'])
        ->values()
        ->all();
}

it('sends the same payment key when the identical charge is retried', function (): void {
    $product = checkoutReadyCart();
    fakeSquareRefusingPayment($product, 402, 'CARD_DECLINED');

    $this->post(route('checkout.store'), checkoutPayload());
    $this->post(route('checkout.store'), checkoutPayload());

    [$first, $second] = paymentKeysSent();

    // Identical details: Square replays rather than charging twice.
    expect($first)->toBe($second);
});

it('sends a different payment key when the card or the tip changes', function (): void {
    $product = checkoutReadyCart();
    fakeSquareRefusingPayment($product, 402, 'CARD_DECLINED');

    $this->post(route('checkout.store'), checkoutPayload());
    $this->post(route('checkout.store'), checkoutPayload(['source_id' => 'cnon:another-card']));
    $this->post(route('checkout.store'), checkoutPayload(['tip_cents' => 200]));

    // Same key with different details is rejected by Square, and would read
    // to the customer as a declined card.
    expect(array_unique(paymentKeysSent()))->toHaveCount(3);
});

it('tells the customer their card was declined only when it was', function (): void {
    $product = checkoutReadyCart();
    fakeSquareRefusingPayment($product, 402, 'CARD_DECLINED', 'Card declined.');

    $this->post(route('checkout.store'), checkoutPayload())
        ->assertSessionHasErrors('checkout');

    expect(session('errors')->first('checkout'))->toContain('declined');
});

it('says what was wrong with the card when Square says so', function (): void {
    $product = checkoutReadyCart();
    fakeSquareRefusingPayment($product, 402, 'INSUFFICIENT_FUNDS');

    $this->post(route('checkout.store'), checkoutPayload())
        ->assertSessionHasErrors('checkout');

    expect(session('errors')->first('checkout'))->toContain('insufficient funds');
});

it('does not blame the card when the payment was refused for another reason', function (): void {
    $product = checkoutReadyCart();
    fakeSquareRefusingPayment($product, 400, 'BAD_REQUEST', 'The order is already paid.');

    $this->post(route('checkout.store'), checkoutPayload())
        ->assertSessionHasErrors('checkout');

    expect(session('errors')->first('checkout'))->not->toContain('declined')
        ->and(Order::query()->firstOrFail()->status)->toBe(OrderStatus::PendingPayment);
});

it('creates the Square order when an earlier attempt never reached Square', function (): void {
    $product = checkoutReadyCart();

    // A previous attempt saved the order but lost the Square response.
    $stranded = Order::factory()->unlinked()->create([
        'idempotency_key' => 'checkout-key-0000000001',
        'customer_email' => 'jaired@example.com',
    ]);
    $stranded->items()->create([
        'product_name' => 'Felisa Latte',
        'product_slug' => 'felisa-latte',
        'category' => ProductCategory::Signature,
        'square_variation_id' => $product->load('variations')->variations->firstOrFail()->square_variation_id,
        'variation_name' => 'Espresso',
        'quantity' => 1,
        'unit_price_cents' => 850,
        'total_cents' => 850,
        'modifiers' => [],
    ]);

    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload());

    expect(Order::query()->count())->toBe(1)
        ->and($stranded->fresh()->square_order_id)->toBe('SQ_ORDER_1')
        ->and($stranded->fresh()->status)->toBe(OrderStatus::Paid);
});

it('takes a tip larger than the order, because the customer chose it', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload(['tip_cents' => 50_000]))
        ->assertSessionHasNoErrors();

    expect(Order::query()->firstOrFail()->tip_cents)->toBe(50_000);

    Http::assertSent(fn ($request): bool => str_ends_with($request->url(), '/v2/payments')
        && $request->data()['tip_money']['amount'] === 50_000);
});

it('refuses a negative tip', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload(['tip_cents' => -100]))
        ->assertSessionHasErrors('tip_cents');

    expect(Order::query()->count())->toBe(0);
});

it('records an accepted tip on the order', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload(['tip_cents' => 200]));

    expect(Order::query()->firstOrFail()->tip_cents)->toBe(200);

    Http::assertSent(fn ($request): bool => str_ends_with($request->url(), '/v2/payments')
        && $request->data()['tip_money']['amount'] === 200);
});

it('charges the order total the server calculated, not one from the browser', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->post(route('checkout.store'), checkoutPayload(['total_cents' => 1]));

    Http::assertSent(fn ($request): bool => str_ends_with($request->url(), '/v2/payments')
        && $request->data()['amount_money']['amount'] === 918);
});

it('shows the checkout page with Square tax preview but no pickup estimate', function (): void {
    $product = checkoutReadyCart();
    fakeSquareFor($product);

    $this->get(route('checkout'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('checkout/index')
            ->where('cart.subtotal.cents', 850)
            ->where('pricingPreview.tax.cents', 68)
            ->where('pricingPreview.total.cents', 918)
            ->where('square.configured', true)
            ->missing('estimatedReadyAt')
        );
});
