<?php

declare(strict_types=1);

namespace App\Actions\Checkout;

use App\Square\SquareRejectedException;

/**
 * Turns Square's reason for refusing a payment into something a customer can
 * act on.
 *
 * Only reasons that are genuinely about the card say so. Everything else,
 * including a request Square considered malformed or an order it says is
 * already settled, gets a neutral message: telling someone their card was
 * declined when it never was sends them off to fix the wrong thing.
 */
final class PaymentFailureMessage
{
    private const GENERIC = 'We could not take that payment. Please try again, and contact us if it keeps happening.';

    private const DECLINED = 'That card was declined. Please check the details or try another card.';

    /** @var array<string, string> */
    private const SPECIFIC = [
        'INSUFFICIENT_FUNDS' => 'That card has insufficient funds. Please try another card.',
        'CARD_EXPIRED' => 'That card has expired. Please try another card.',
        'INVALID_EXPIRATION' => 'The expiry date on that card is not valid. Please check it and try again.',
        'BAD_EXPIRATION' => 'The expiry date on that card is not valid. Please check it and try again.',
        'CVV_FAILURE' => 'The security code (CVV) did not match. Please check it and try again.',
        'VERIFY_CVV_FAILURE' => 'The security code (CVV) did not match. Please check it and try again.',
        'ADDRESS_VERIFICATION_FAILURE' => 'The postal code did not match that card. Please check it and try again.',
        'VERIFY_AVS_FAILURE' => 'The postal code did not match that card. Please check it and try again.',
        'CARD_DECLINED_VERIFICATION_REQUIRED' => 'Your bank needs to verify this payment. Please try again to complete verification.',
        'CARD_TOKEN_EXPIRED' => 'That card entry timed out. Please enter the card again.',
        'CARD_TOKEN_USED' => 'That card entry has already been used. Please enter the card again.',
    ];

    /** Reasons that mean the card itself was turned down, without a better description. */
    private const CARD_REASONS = [
        'CARD_DECLINED',
        'GENERIC_DECLINE',
        'INVALID_CARD',
        'INVALID_CARD_DATA',
        'CARD_NOT_SUPPORTED',
        'PAN_FAILURE',
        'TRANSACTION_LIMIT',
        'PAYMENT_LIMIT_EXCEEDED',
        'VOICE_FAILURE',
        'CHIP_INSERTION_REQUIRED',
        'ALLOWABLE_PIN_TRIES_EXCEEDED',
        'CARD_PROCESSING_NOT_ENABLED',
    ];

    public static function for(SquareRejectedException $exception): string
    {
        $code = $exception->errorCode;

        if ($code === null) {
            return self::GENERIC;
        }

        if (isset(self::SPECIFIC[$code])) {
            return self::SPECIFIC[$code];
        }

        return in_array($code, self::CARD_REASONS, true) ? self::DECLINED : self::GENERIC;
    }
}
