<?php

declare(strict_types=1);

use App\Models\User;

test('the registration screen renders', function () {
    $this->get(route('register'))->assertOk();
});

test('a customer can create an account', function () {
    $response = $this->post(route('register.store'), [
        'name' => 'Jaired',
        'email' => 'jaired@example.com',
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('home', absolute: false));

    expect(User::query()->where('email', 'jaired@example.com')->exists())->toBeTrue();
});

test('an account cannot reuse an email address', function () {
    User::factory()->create(['email' => 'jaired@example.com']);

    $this->post(route('register.store'), [
        'name' => 'Someone Else',
        'email' => 'jaired@example.com',
        'password' => 'password',
    ])->assertSessionHasErrors('email');

    expect(User::query()->where('email', 'jaired@example.com')->count())->toBe(1);
});
