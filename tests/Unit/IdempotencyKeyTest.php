<?php

declare(strict_types=1);

use App\Square\IdempotencyKey;

/**
 * Square rejects a key over 45 characters (VALUE_TOO_LONG), which only shows up
 * against the real API, so the limit is pinned here.
 */
it('never exceeds the length Square allows, however long the input', function (string $prefix): void {
    $key = IdempotencyKey::make($prefix, str_repeat('x', 500), str_repeat('y', 500));

    expect(strlen($key))->toBeLessThanOrEqual(45);
})->with(['felisa-order', 'felisa-pay', 'felisa-customer', 'felisa-card']);

it('gives the same key for the same inputs and a different one otherwise', function (): void {
    expect(IdempotencyKey::make('felisa-pay', 'a', 'b'))->toBe(IdempotencyKey::make('felisa-pay', 'a', 'b'))
        ->and(IdempotencyKey::make('felisa-pay', 'a', 'b'))->not->toBe(IdempotencyKey::make('felisa-pay', 'a', 'c'))
        // The parts are joined, so moving a boundary between them is a change.
        ->and(IdempotencyKey::make('felisa-pay', 'ab', 'c'))->not->toBe(IdempotencyKey::make('felisa-pay', 'a', 'bc'));
});

it('keeps its prefix, so a key can be traced back to what made it', function (): void {
    expect(IdempotencyKey::make('felisa-pay', 'a'))->toStartWith('felisa-pay-');
});
