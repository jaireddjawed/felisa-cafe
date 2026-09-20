<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Accounts are optional at Felisa: they exist so a customer can see their
 * order history. Authentication itself is Fortify's, so these tests cover the
 * wiring rather than the framework.
 */
test('the login screen renders', function () {
    $this->get(route('login'))->assertOk();
});

test('customers can sign in and land back on the storefront', function () {
    $user = User::factory()->create();

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('home', absolute: false));
});

test('customers cannot sign in with the wrong password', function () {
    $user = User::factory()->create();

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'not-the-password',
    ]);

    $this->assertGuest();
});

test('repeated failed sign-ins are rate limited', function () {
    $user = User::factory()->create();

    foreach (range(1, 6) as $attempt) {
        $this->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'not-the-password',
        ]);
    }

    // Even the correct password is refused once the limiter has tripped.
    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ])->assertStatus(429);

    $this->assertGuest();

    RateLimiter::clear('login');
});

test('customers can sign out', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('logout'))
        ->assertRedirect();

    $this->assertGuest();
});
