<?php

declare(strict_types=1);

use App\Actions\Checkout\PaymentFailureMessage;
use App\Square\SquareRejectedException;

/**
 * A customer is told their card was declined only when it was. Anything else
 * gets a neutral message, because "declined" sends them off to fix the wrong
 * thing.
 */
function rejection(?string $code): SquareRejectedException
{
    return new SquareRejectedException('rejected', errorCode: $code);
}

it('calls a card the bank turned down declined', function (string $code): void {
    expect(PaymentFailureMessage::for(rejection($code)))->toContain('declined');
})->with(['CARD_DECLINED', 'GENERIC_DECLINE', 'INVALID_CARD', 'CARD_NOT_SUPPORTED']);

it('describes the specific card problem when Square names one', function (string $code, string $contains): void {
    expect(PaymentFailureMessage::for(rejection($code)))->toContain($contains);
})->with([
    ['INSUFFICIENT_FUNDS', 'insufficient funds'],
    ['CARD_EXPIRED', 'expired'],
    ['CVV_FAILURE', 'security code'],
    ['ADDRESS_VERIFICATION_FAILURE', 'postal code'],
    ['CARD_TOKEN_USED', 'enter the card again'],
]);

it('does not blame the card for anything else', function (?string $code): void {
    $message = PaymentFailureMessage::for(rejection($code));

    expect($message)->not->toContain('declined')
        ->and($message)->toContain('could not take that payment');
})->with([null, 'BAD_REQUEST', 'IDEMPOTENCY_KEY_REUSED', 'UNAUTHORIZED', 'SOMETHING_NEW']);
