<?php

declare(strict_types=1);

namespace App\Square;

/**
 * Builds the idempotency keys sent to Square.
 *
 * Square rejects a longer key outright (VALUE_TOO_LONG, "must not be greater
 * than 45 length") on payments, cards and customers, so every key is kept
 * within that. A key is a fixed prefix plus a hash of whatever makes the
 * request unique: the same inputs always give the same key, so a retry
 * replays, and different inputs give a different one.
 *
 * The hash is trimmed to fit, which still leaves well over 100 bits, far more
 * than a collision needs.
 */
final class IdempotencyKey
{
    public const MAX_LENGTH = 45;

    public static function make(string $prefix, string ...$parts): string
    {
        $hashLength = self::MAX_LENGTH - strlen($prefix) - 1;

        return $prefix.'-'.substr(hash('sha256', implode('|', $parts)), 0, $hashLength);
    }
}
