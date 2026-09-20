<?php

declare(strict_types=1);

namespace App\Support;

use InvalidArgumentException;

/**
 * An amount in a currency's smallest unit (cents for USD). Money never uses
 * floating point: every price, subtotal, tax and total in this application is
 * an integer number of minor units.
 *
 * @phpstan-type MoneyArray array{cents: int, currency: string, formatted: string}
 */
final readonly class Money
{
    /** Currencies with no minor unit: 1 JPY is already the smallest amount. */
    private const ZERO_DECIMAL = ['JPY', 'KRW', 'VND', 'CLP', 'ISK'];

    public function __construct(
        public int $cents,
        public string $currency,
    ) {}

    public static function of(int $cents, ?string $currency = null): self
    {
        return new self($cents, $currency ?? self::defaultCurrency());
    }

    public static function zero(?string $currency = null): self
    {
        return self::of(0, $currency);
    }

    public static function defaultCurrency(): string
    {
        $currency = config('square.currency', 'USD');

        return is_string($currency) ? $currency : 'USD';
    }

    public function plus(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->cents + $other->cents, $this->currency);
    }

    public function times(int $quantity): self
    {
        return new self($this->cents * $quantity, $this->currency);
    }

    public function equals(self $other): bool
    {
        return $this->cents === $other->cents && $this->currency === $other->currency;
    }

    public function isZero(): bool
    {
        return $this->cents === 0;
    }

    /** Formats for display, e.g. "$8.50" or "1200 JPY". */
    public function format(): string
    {
        $sign = $this->cents < 0 ? '-' : '';
        $amount = abs($this->cents);

        if (in_array($this->currency, self::ZERO_DECIMAL, true)) {
            return "{$sign}{$amount} {$this->currency}";
        }

        $major = intdiv($amount, 100);
        $minor = str_pad((string) ($amount % 100), 2, '0', STR_PAD_LEFT);

        return $this->currency === 'USD'
            ? "{$sign}\${$major}.{$minor}"
            : "{$sign}{$major}.{$minor} {$this->currency}";
    }

    /**
     * The shape every Inertia page receives money in: the authoritative cents
     * plus a display string, so React never formats currency itself.
     *
     * @return MoneyArray
     */
    public function toArray(): array
    {
        return [
            'cents' => $this->cents,
            'currency' => $this->currency,
            'formatted' => $this->format(),
        ];
    }

    private function assertSameCurrency(self $other): void
    {
        if ($this->currency !== $other->currency) {
            throw new InvalidArgumentException(
                "Cannot combine {$this->currency} with {$other->currency}."
            );
        }
    }
}
