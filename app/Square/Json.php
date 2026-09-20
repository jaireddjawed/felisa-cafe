<?php

declare(strict_types=1);

namespace App\Square;

use Illuminate\Support\Arr;

/**
 * Typed reads out of Square's decoded JSON.
 *
 * Square's payloads are deeply optional: almost every field can be absent or
 * null, and PHP would happily hand the rest of the application a `mixed`.
 * These helpers are the one place that coercion happens, so every other file
 * in app/Square works with real types.
 *
 * Keys may use dot notation, e.g. `Json::int($line, 'base_price_money.amount')`.
 */
final class Json
{
    /** @param array<mixed> $data */
    public static function string(array $data, string $key, string $default = ''): string
    {
        $value = Arr::get($data, $key);

        return is_string($value) ? $value : $default;
    }

    /** @param array<mixed> $data */
    public static function nullableString(array $data, string $key): ?string
    {
        $value = Arr::get($data, $key);

        return is_string($value) && $value !== '' ? $value : null;
    }

    /** @param array<mixed> $data */
    public static function int(array $data, string $key, int $default = 0): int
    {
        $value = Arr::get($data, $key);

        return is_int($value) || (is_string($value) && is_numeric($value))
            ? (int) $value
            : $default;
    }

    /** @param array<mixed> $data */
    public static function nullableInt(array $data, string $key): ?int
    {
        $value = Arr::get($data, $key);

        return is_int($value) || (is_string($value) && is_numeric($value))
            ? (int) $value
            : null;
    }

    /** @param array<mixed> $data */
    public static function bool(array $data, string $key, bool $default = false): bool
    {
        $value = Arr::get($data, $key);

        return is_bool($value) ? $value : $default;
    }

    /**
     * A single nested JSON object, or an empty array when it is absent.
     *
     * @param  array<mixed>  $data
     * @return array<string, mixed>
     */
    public static function object(array $data, string $key): array
    {
        $value = Arr::get($data, $key);

        return is_array($value) ? $value : [];
    }

    /**
     * A nested JSON object, or null when it is absent. Use this where the
     * difference between "absent" and "empty" matters, e.g. a price that
     * Square omits entirely versus one that is zero.
     *
     * @param  array<mixed>  $data
     * @return array<string, mixed>|null
     */
    public static function nullableObject(array $data, string $key): ?array
    {
        $value = Arr::get($data, $key);

        return is_array($value) ? $value : null;
    }

    /**
     * A list of nested JSON objects, with anything that is not an object
     * dropped rather than passed along as `mixed`.
     *
     * @param  array<mixed>  $data
     * @return list<array<string, mixed>>
     */
    public static function objects(array $data, string $key): array
    {
        $value = Arr::get($data, $key);

        if (! is_array($value)) {
            return [];
        }

        return array_values(array_filter($value, is_array(...)));
    }

    /**
     * A list of plain strings, e.g. Square's location ID arrays.
     *
     * @param  array<mixed>  $data
     * @return list<string>
     */
    public static function strings(array $data, string $key): array
    {
        $value = Arr::get($data, $key);

        if (! is_array($value)) {
            return [];
        }

        return array_values(array_filter($value, is_string(...)));
    }
}
