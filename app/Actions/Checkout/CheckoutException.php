<?php

declare(strict_types=1);

namespace App\Actions\Checkout;

use RuntimeException;

/**
 * Checkout could not proceed. The message is written for the customer: it is
 * shown to them as a validation error on the checkout page.
 */
class CheckoutException extends RuntimeException
{
    public static function emptyCart(): self
    {
        return new self('Your cart is empty.');
    }

    public static function invalidCart(): self
    {
        return new self('Some items in your cart are no longer available. Please review your cart.');
    }

    public static function pricesChanged(): self
    {
        return new self('Our menu just changed. Please review your cart and try again.');
    }

    public static function unavailable(): self
    {
        return new self('Checkout is temporarily unavailable. Please try again in a moment.');
    }

    public static function declined(string $detail): self
    {
        return new self($detail);
    }
}
