<?php

declare(strict_types=1);

use App\Models\SavedCard;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use Tests\Support\FakeSquare;

/**
 * Account settings, which is where a customer manages the cards they keep on
 * file. The page only ever shows its own customer's cards, and shows nothing
 * that could be used to charge one.
 */
it('shows a customer the cards they have on file', function (): void {
    $user = User::factory()->create(['square_customer_id' => 'SQ_CUSTOMER_1']);
    SavedCard::factory()->for($user)->create([
        'brand' => 'VISA',
        'last_4' => '4242',
        'exp_month' => 4,
        'exp_year' => 2031,
    ]);

    $this->actingAs($user)
        ->get(route('settings'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->has('savedCards', 1)
            ->where('savedCards.0.brand', 'Visa')
            ->where('savedCards.0.last4', '4242')
            ->where('savedCards.0.expMonth', 4)
            ->where('savedCards.0.expired', false)
            // Nothing chargeable reaches the browser.
            ->missing('savedCards.0.square_card_id')
        );
});

it('never shows one customer another customer\'s cards', function (): void {
    SavedCard::factory()->for(User::factory())->create(['last_4' => '9999']);

    $this->actingAs(User::factory()->create())
        ->get(route('settings'))
        ->assertInertia(fn (AssertableInertia $page) => $page->has('savedCards', 0));
});

it('has nothing to show a guest, so asks them to sign in', function (): void {
    $this->get(route('settings'))->assertRedirect(route('login'));
});

it('removes a card from settings and stays there', function (): void {
    $user = User::factory()->create(['square_customer_id' => 'SQ_CUSTOMER_1']);
    $card = SavedCard::factory()->for($user)->create(['square_card_id' => 'ccof:GONE']);

    FakeSquare::fake([
        '/v2/cards/*/disable' => Http::response(FakeSquare::card()),
    ]);

    $this->actingAs($user)
        ->from(route('settings'))
        ->delete(route('saved-cards.destroy', $card))
        ->assertRedirect(route('settings'));

    expect(SavedCard::query()->count())->toBe(0);

    Http::assertSent(fn ($request): bool => str_contains($request->url(), '/v2/cards/ccof:GONE/disable'));
});
