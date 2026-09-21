<?php

declare(strict_types=1);

namespace App\Actions\Checkout;

use App\Models\SavedCard;
use App\Models\User;
use App\Square\Data\CustomerContact;
use App\Square\SquareException;

/**
 * Decides what the card charge is made against:
 *
 *   a card on file    charge the stored card, with its Square customer
 *   save this card    store the token first, then charge the stored card
 *   anything else     charge the single-use token, as a guest checkout does
 *
 * Storing a card spends the token, so the two can never both be charged.
 */
class ResolvePaymentSource
{
    public function __construct(private readonly SaveCardOnFile $saveCard) {}

    public function handle(
        ?User $user,
        ?SavedCard $savedCard,
        string $sourceId,
        CustomerContact $contact,
        bool $saveCard = false,
        ?string $verificationToken = null,
    ): PaymentSource {
        if ($savedCard !== null) {
            $customerId = $savedCard->user->square_customer_id;

            // Only a card this application stored can be charged, and storing
            // one always creates the customer first.
            if ($customerId === null) {
                throw CheckoutException::declined(
                    'That saved card is no longer usable. Please pay with a card instead.'
                );
            }

            return new PaymentSource(
                sourceId: $savedCard->square_card_id,
                squareCustomerId: $customerId,
                verificationToken: $verificationToken,
                savedCard: $savedCard,
            );
        }

        if ($sourceId === '') {
            throw CheckoutException::declined(
                'We could not read that payment method. Please try again.'
            );
        }

        if ($user !== null && $saveCard) {
            return $this->storeThenCharge($user, $sourceId, $contact, $verificationToken);
        }

        return new PaymentSource($sourceId, verificationToken: $verificationToken);
    }

    /**
     * A card that cannot be stored should not cost the customer their order:
     * the checkout falls back to charging the token, which is still unspent
     * whenever Square rejected the card outright.
     */
    private function storeThenCharge(
        User $user,
        string $sourceId,
        CustomerContact $contact,
        ?string $verificationToken,
    ): PaymentSource {
        try {
            $card = $this->saveCard->handle($user, $sourceId, $contact, $verificationToken);
        } catch (SquareException $exception) {
            report($exception);

            return new PaymentSource($sourceId, verificationToken: $verificationToken);
        }

        return new PaymentSource(
            sourceId: $card->square_card_id,
            squareCustomerId: $user->square_customer_id,
            // The token above was verified for storage, not for this charge,
            // so it cannot be replayed here.
            verificationToken: null,
            savedCard: $card,
        );
    }
}
