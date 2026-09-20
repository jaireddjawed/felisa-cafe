<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| No test may reach the real Square
|--------------------------------------------------------------------------
|
| Http::preventStrayRequests() turns any unfaked outbound request into a
| failed test, so a new test that forgets to fake Square fails loudly rather
| than quietly calling a live API with whatever token is in the environment.
|
| Only Feature tests boot the application; Unit tests stay framework-free.
|
*/

pest()->beforeEach(function (): void {
    Http::preventStrayRequests();

    // Rendering through the SSR server would be a real HTTP request, and
    // these tests assert on Inertia's props, not on rendered markup.
    config()->set('inertia.ssr.enabled', false);

    config()->set('square.access_token', 'test-access-token');
    config()->set('square.application_id', 'test-application-id');
    config()->set('square.location_id', 'TEST_LOCATION');
    config()->set('square.environment', 'sandbox');
    config()->set('square.webhook_signature_key', 'test-signature-key');
    config()->set('square.webhook_url', 'https://felisa.test/webhooks/square');
})->in('Feature');
