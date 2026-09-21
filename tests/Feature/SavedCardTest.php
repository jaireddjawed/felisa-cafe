<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Models\Modifier;
use App\Models\ModifierList;
use App\Models\Order;
use App\Models\Product;
use App\Models\SavedCard;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia;
use Tests\Support\FakeSquare;

/**
 * Cards on file: keeping one during checkout, paying with one afterwards, and
 * forgetting one.
 *
 * The rules being protected here are that a card belongs to exactly one
 * account, that nothing chargeable is ever handed to the browser, and that a
 * card we fail to store never costs the customer their order.
 */
beforeEach(function (): void {
    Notification::fake();
});

/** The same $8.50 latte checkout uses, already in the session cart. */
function cardReadyCart(): Product
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

/**
 * Square accepts the order, stores the card and takes the payment.
 *
 * @param  array<string, mixed>  $overrides  extra or replacement route stubs
 */
function fakeSquareWithCards(Product $product, array $overrides = []): void
{
    $variationId = $product->load('variations')->variations->firstOrFail()->square_variation_id;

    FakeSquare::fake([
        '/v2/catalog/batch-retrieve' => Http::response(FakeSquare::livePrices(
            variationPrices: [$variationId => 850],
            modifierPrices: ['MOD_OAT' => 0],
        )),
        '/v2/orders/calculate' => Http::response(FakeSquare::order(totalCents: 918, taxCents: 68)),
        '/v2/orders' => Http::response(FakeSquare::order(totalCents: 918, taxCents: 68)),
        '/v2/customers' => Http::response(FakeSquare::customer()),
        '/v2/cards' => Http::response(FakeSquare::card()),
        '/v2/cards/*/disable' => Http::response(FakeSquare::card()),
        '/v2/payments' => Http::response(FakeSquare::payment()),
        '/v2/orders/*' => Http::response(FakeSquare::order(
            totalCents: 918, taxCents: 68, paid: true, version: 2,
        )),
        ...$overrides,
    ]);
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function cardCheckoutPayload(array $overrides = []): array
{
    return [
        'name' => 'Jaired',
        'email' => 'jaired@example.com',
        'source_id' => 'cnon:card-nonce-ok',
        'idempotency_key' => 'checkout-key-0000000001',
        ...$overrides,
    ];
}

/**
 * What was sent to Square's payments endpoint.
 *
 * @return array<string, mixed>
 */
function paymentData(): array
{
    $data = [];

    Http::assertSent(function ($request) use (&$data): bool {
        if (! str_ends_with($request->url(), '/v2/payments')) {
            return false;
        }

        $data = $request->data();

        return true;
    });

    return $data;
}

it('keeps a card on file when the customer asks for it', function (): void {
    $user = User::factory()->create();
    $this->actingAs($user);

    $product = cardReadyCart();
    fakeSquareWithCards($product);

    $this->post(route('checkout.store'), cardCheckoutPayload(['save_card' => true]));

    $card = SavedCard::query()->firstOrFail();

    expect($user->fresh()->square_customer_id)->toBe('SQ_CUSTOMER_1')
        ->and($card->user_id)->toBe($user->id)
        ->and($card->square_card_id)->toBe('ccof:SQ_CARD_1')
        ->and($card->brand)->toBe('VISA')
        ->and($card->last_4)->toBe('1111')
        ->and($card->exp_month)->toBe(12)
        ->and(Order::query()->firstOrFail()->status)->toBe(OrderStatus::Paid);
});

it("derives the Square customer key from the account's email, not its ID", function (): void {
    // IDs are only unique within one database, and every environment using the
    // same Square account shares one set of idempotency keys.
    $this->actingAs(User::factory()->create(['email' => 'Card.Owner@Example.com']));

    $product = cardReadyCart();
    fakeSquareWithCards($product);

    $this->post(route('checkout.store'), cardCheckoutPayload(['save_card' => true]));

    $expected = 'felisa-customer-'.hash('sha256', 'card.owner@example.com');

    Http::assertSent(fn ($request): bool => str_ends_with($request->url(), '/v2/customers')
        && $request->data()['idempotency_key'] === $expected);
});

it('charges the stored card rather than the token that created it', function (): void {
    $this->actingAs(User::factory()->create());

    $product = cardReadyCart();
    fakeSquareWithCards($product);

    $this->post(route('checkout.store'), cardCheckoutPayload(['save_card' => true]));

    // Storing the card spends the token, so the payment cannot use it again.
    expect(paymentData()['source_id'])->toBe('ccof:SQ_CARD_1')
        ->and(paymentData()['customer_id'])->toBe('SQ_CUSTOMER_1');
});

it('charges a card the customer already has on file', function (): void {
    $user = User::factory()->create(['square_customer_id' => 'SQ_CUSTOMER_1']);
    $card = SavedCard::factory()->for($user)->create(['square_card_id' => 'ccof:SAVED']);
    $this->actingAs($user);

    $product = cardReadyCart();
    fakeSquareWithCards($product);

    $this->post(route('checkout.store'), cardCheckoutPayload([
        'source_id' => '',
        'saved_card_id' => $card->id,
    ]));

    expect(Order::query()->firstOrFail()->status)->toBe(OrderStatus::Paid)
        ->and(paymentData()['source_id'])->toBe('ccof:SAVED')
        ->and(paymentData()['customer_id'])->toBe('SQ_CUSTOMER_1')
        // Nothing was stored a second time.
        ->and(SavedCard::query()->count())->toBe(1);

    Http::assertNotSent(fn ($request): bool => str_ends_with($request->url(), '/v2/cards'));
});

it('records when a card on file was last charged', function (): void {
    $user = User::factory()->create(['square_customer_id' => 'SQ_CUSTOMER_1']);
    $card = SavedCard::factory()->for($user)->create(['last_used_at' => null]);
    $this->actingAs($user);

    $product = cardReadyCart();
    fakeSquareWithCards($product);

    $this->post(route('checkout.store'), cardCheckoutPayload([
        'source_id' => '',
        'saved_card_id' => $card->id,
    ]));

    expect($card->fresh()->last_used_at)->not->toBeNull();
});

it("refuses to charge another customer's card", function (): void {
    $stranger = User::factory()->create(['square_customer_id' => 'SQ_CUSTOMER_2']);
    $card = SavedCard::factory()->for($stranger)->create();

    $this->actingAs(User::factory()->create());

    $product = cardReadyCart();
    fakeSquareWithCards($product);

    $this->post(route('checkout.store'), cardCheckoutPayload([
        'source_id' => '',
        'saved_card_id' => $card->id,
    ]))->assertSessionHasErrors('saved_card_id');

    expect(Order::query()->count())->toBe(0);
    Http::assertNotSent(fn ($request): bool => str_contains($request->url(), '/v2/payments'));
});

it('refuses a card on file to a guest', function (): void {
    $card = SavedCard::factory()->for(User::factory())->create();

    $product = cardReadyCart();
    fakeSquareWithCards($product);

    $this->post(route('checkout.store'), cardCheckoutPayload([
        'source_id' => '',
        'saved_card_id' => $card->id,
    ]))->assertSessionHasErrors('saved_card_id');

    expect(Order::query()->count())->toBe(0);
});

it("has nothing to attach a guest's card to, so does not keep it", function (): void {
    $product = cardReadyCart();
    fakeSquareWithCards($product);

    $this->post(route('checkout.store'), cardCheckoutPayload(['save_card' => true]));

    expect(SavedCard::query()->count())->toBe(0)
        ->and(Order::query()->firstOrFail()->status)->toBe(OrderStatus::Paid)
        // The token itself paid, exactly as any guest checkout does.
        ->and(paymentData()['source_id'])->toBe('cnon:card-nonce-ok');

    Http::assertNotSent(fn ($request): bool => str_ends_with($request->url(), '/v2/cards'));
});

it('still takes the order when Square will not keep the card', function (): void {
    $this->actingAs(User::factory()->create());

    $product = cardReadyCart();
    fakeSquareWithCards($product, [
        '/v2/cards' => Http::response([
            'errors' => [['code' => 'INVALID_CARD_DATA', 'detail' => 'Card cannot be stored.']],
        ], 400),
    ]);

    $this->post(route('checkout.store'), cardCheckoutPayload(['save_card' => true]));

    expect(SavedCard::query()->count())->toBe(0)
        ->and(Order::query()->firstOrFail()->status)->toBe(OrderStatus::Paid)
        // The token was never spent, so it can still pay for the order.
        ->and(paymentData()['source_id'])->toBe('cnon:card-nonce-ok');
});

it('does not list the same card twice when it is saved again', function (): void {
    $user = User::factory()->create(['square_customer_id' => 'SQ_CUSTOMER_1']);
    $card = SavedCard::factory()->for($user)->create([
        'square_card_id' => 'ccof:OLD_CARD',
        'fingerprint' => 'sq-1-FINGERPRINT',
        'last_4' => '9999',
    ]);
    $this->actingAs($user);

    $product = cardReadyCart();
    fakeSquareWithCards($product);

    $this->post(route('checkout.store'), cardCheckoutPayload(['save_card' => true]));

    expect(SavedCard::query()->count())->toBe(1)
        ->and($card->fresh()->square_card_id)->toBe('ccof:SQ_CARD_1')
        ->and($card->fresh()->last_4)->toBe('1111');

    // The card it replaced can no longer be charged.
    Http::assertSent(fn ($request): bool => str_contains($request->url(), '/v2/cards/ccof:OLD_CARD/disable'));
});

it('offers a signed-in customer their cards, and a guest none', function (): void {
    $user = User::factory()->create(['square_customer_id' => 'SQ_CUSTOMER_1']);
    SavedCard::factory()->for($user)->create(['brand' => 'VISA', 'last_4' => '4242']);

    $product = cardReadyCart();
    fakeSquareWithCards($product);

    $this->actingAs($user)
        ->get(route('checkout'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('canSaveCard', true)
            ->has('savedCards', 1)
            ->where('savedCards.0.brand', 'Visa')
            ->where('savedCards.0.last4', '4242')
            ->where('savedCards.0.expired', false)
            // Nothing chargeable reaches the browser.
            ->missing('savedCards.0.square_card_id')
        );

    $this->post(route('logout'));

    $this->get(route('checkout'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('canSaveCard', false)
            ->has('savedCards', 0)
        );
});

it('marks a card the customer can no longer use as expired', function (): void {
    $user = User::factory()->create(['square_customer_id' => 'SQ_CUSTOMER_1']);
    SavedCard::factory()->for($user)->expired()->create();

    $product = cardReadyCart();
    fakeSquareWithCards($product);

    $this->actingAs($user)
        ->get(route('checkout'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('savedCards.0.expired', true));
});

it('forgets a card and disables it at Square', function (): void {
    $user = User::factory()->create(['square_customer_id' => 'SQ_CUSTOMER_1']);
    $card = SavedCard::factory()->for($user)->create(['square_card_id' => 'ccof:GONE']);

    fakeSquareWithCards(cardReadyCart());

    $this->actingAs($user)
        ->delete(route('saved-cards.destroy', $card))
        ->assertRedirect();

    expect(SavedCard::query()->count())->toBe(0);

    Http::assertSent(fn ($request): bool => str_contains($request->url(), '/v2/cards/ccof:GONE/disable'));
});

it('forgets a card even when Square cannot be reached', function (): void {
    $user = User::factory()->create(['square_customer_id' => 'SQ_CUSTOMER_1']);
    $card = SavedCard::factory()->for($user)->create();

    fakeSquareWithCards(cardReadyCart(), [
        '/v2/cards/*/disable' => Http::response('', 503),
    ]);

    $this->actingAs($user)->delete(route('saved-cards.destroy', $card));

    expect(SavedCard::query()->count())->toBe(0);
});

it("will not let one customer forget another customer's card", function (): void {
    $card = SavedCard::factory()->for(User::factory())->create();

    fakeSquareWithCards(cardReadyCart());

    $this->actingAs(User::factory()->create())
        ->delete(route('saved-cards.destroy', $card))
        ->assertNotFound();

    expect(SavedCard::query()->count())->toBe(1);
});
