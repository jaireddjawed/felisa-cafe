<?php

declare(strict_types=1);

use App\Models\SavedCard;
use App\Models\User;
use App\Notifications\VerifyFelisaEmail;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia;
use Tests\Support\FakeSquare;

/**
 * Account settings: a customer's profile, their password, and the cards they
 * keep on file. The page only ever shows its own customer's cards, and shows
 * nothing that could be used to charge one.
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

it('tells the settings page whether the email is confirmed and what a password needs', function (): void {
    $this->actingAs(User::factory()->unverified()->create())
        ->get(route('settings'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('emailVerified', false)
            ->has('passwordRules')
        );
});

it('changes the name without touching verification', function (): void {
    Notification::fake();

    $user = User::factory()->create(['name' => 'Old Name', 'email' => 'same@example.com']);

    $this->actingAs($user)
        ->put(route('user-profile-information.update'), ['name' => 'New Name', 'email' => 'same@example.com'])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->name)->toBe('New Name')
        ->and($user->fresh()->hasVerifiedEmail())->toBeTrue();

    Notification::assertNothingSent();
});

it('unverifies a changed email and sends a link to the new address', function (): void {
    Notification::fake();

    $user = User::factory()->create(['email' => 'old@example.com']);

    $this->actingAs($user)
        ->put(route('user-profile-information.update'), ['name' => $user->name, 'email' => 'New@Example.com'])
        ->assertSessionHasNoErrors();

    // Fortify lowercases the address, which the Square customer key relies on.
    expect($user->fresh()->email)->toBe('new@example.com')
        ->and($user->fresh()->hasVerifiedEmail())->toBeFalse();

    Notification::assertSentTo($user->fresh(), VerifyFelisaEmail::class);
});

it('will not take an email another account already has', function (): void {
    User::factory()->create(['email' => 'taken@example.com']);
    $user = User::factory()->create(['email' => 'mine@example.com']);

    $this->actingAs($user)
        ->put(route('user-profile-information.update'), ['name' => $user->name, 'email' => 'taken@example.com'])
        ->assertSessionHasErrors('email', errorBag: 'updateProfileInformation');

    expect($user->fresh()->email)->toBe('mine@example.com');
});

it('requires a name and a valid email', function (): void {
    $this->actingAs(User::factory()->create())
        ->put(route('user-profile-information.update'), ['name' => '', 'email' => 'not-an-email'])
        ->assertSessionHasErrors(['name', 'email'], errorBag: 'updateProfileInformation');
});

it('changes the password when the current one is right', function (): void {
    $user = User::factory()->create(['password' => 'old-password-123']);

    $this->actingAs($user)
        ->put(route('user-password.update'), [
            'current_password' => 'old-password-123',
            'password' => 'brand-new-password-456',
            'password_confirmation' => 'brand-new-password-456',
        ])
        ->assertSessionHasNoErrors();

    expect(Hash::check('brand-new-password-456', $user->fresh()->password))->toBeTrue()
        ->and(Hash::check('old-password-123', $user->fresh()->password))->toBeFalse();
});

it('refuses a password change with the wrong current password', function (): void {
    $user = User::factory()->create(['password' => 'old-password-123']);

    $this->actingAs($user)
        ->put(route('user-password.update'), [
            'current_password' => 'not-my-password',
            'password' => 'brand-new-password-456',
            'password_confirmation' => 'brand-new-password-456',
        ])
        ->assertSessionHasErrors('current_password', errorBag: 'updatePassword');

    expect(Hash::check('old-password-123', $user->fresh()->password))->toBeTrue();
});

it('refuses a new password that is unconfirmed or too short', function (): void {
    $user = User::factory()->create(['password' => 'old-password-123']);

    $this->actingAs($user)
        ->put(route('user-password.update'), [
            'current_password' => 'old-password-123',
            'password' => 'short',
            'password_confirmation' => 'different',
        ])
        ->assertSessionHasErrors('password', errorBag: 'updatePassword');

    expect(Hash::check('old-password-123', $user->fresh()->password))->toBeTrue();
});

it('keeps the profile and password errors apart', function (): void {
    // Both forms are on one page, so neither may show the other's errors.
    $this->actingAs(User::factory()->create(['password' => 'old-password-123']))
        ->put(route('user-password.update'), [
            'current_password' => 'wrong',
            'password' => 'brand-new-password-456',
            'password_confirmation' => 'brand-new-password-456',
        ])
        ->assertSessionHasErrors('current_password', errorBag: 'updatePassword')
        ->assertSessionDoesntHaveErrors(['name', 'email'], errorBag: 'updateProfileInformation');
});

it('keeps both forms away from guests', function (): void {
    $this->put(route('user-profile-information.update'), ['name' => 'X', 'email' => 'x@example.com'])
        ->assertRedirect(route('login'));

    $this->put(route('user-password.update'), ['current_password' => 'a', 'password' => 'b', 'password_confirmation' => 'b'])
        ->assertRedirect(route('login'));
});

it('remembers the confirmed address when it is replaced', function (): void {
    Notification::fake();

    $user = User::factory()->create(['email' => 'old@example.com']);

    $this->actingAs($user)
        ->put(route('user-profile-information.update'), ['name' => $user->name, 'email' => 'new@example.com']);

    expect($user->fresh()->last_confirmed_email)->toBe('old@example.com');
});

it('keeps the last confirmed address through further changes before the new one is confirmed', function (): void {
    Notification::fake();

    $user = User::factory()->create(['email' => 'old@example.com']);

    $this->actingAs($user)
        ->put(route('user-profile-information.update'), ['name' => $user->name, 'email' => 'second@example.com'])
        ->assertSessionHasNoErrors();

    // "second" was never confirmed, so it must not replace "old".
    $this->put(route('user-profile-information.update'), ['name' => $user->name, 'email' => 'third@example.com'])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->email)->toBe('third@example.com')
        ->and($user->fresh()->last_confirmed_email)->toBe('old@example.com');
});

it('sends receipts to the confirmed address until the new one is confirmed', function (): void {
    $confirmed = User::factory()->create(['email' => 'confirmed@example.com']);
    expect($confirmed->receiptEmail())->toBe('confirmed@example.com');

    $switched = User::factory()->unverified()->create([
        'email' => 'new@example.com',
        'last_confirmed_email' => 'old@example.com',
    ]);
    expect($switched->receiptEmail())->toBe('old@example.com');

    // Once the new address is confirmed it is the one that counts.
    $switched->forceFill(['email_verified_at' => now()])->save();
    expect($switched->receiptEmail())->toBe('new@example.com');

    // An account that never confirmed anything has nowhere better to use.
    $never = User::factory()->unverified()->create(['email' => 'never@example.com']);
    expect($never->receiptEmail())->toBe('never@example.com');
});

it('signs out other devices when the password changes, but not this one', function (): void {
    $user = User::factory()->create(['password' => 'old-password-123']);
    $oldHash = $user->getAuthPassword();

    // This device, signed in with the old password.
    $this->actingAs($user)
        ->withSession(['password_hash_web' => $oldHash])
        ->put(route('user-password.update'), [
            'current_password' => 'old-password-123',
            'password' => 'brand-new-password-456',
            'password_confirmation' => 'brand-new-password-456',
        ])
        ->assertSessionHasNoErrors();

    $this->get(route('settings'))->assertOk();

    // Another device is still carrying the old password's hash.
    $this->flushSession()
        ->withSession(['password_hash_web' => $oldHash])
        ->get(route('settings'))
        ->assertRedirect(route('login'));
});
