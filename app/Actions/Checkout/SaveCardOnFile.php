<?php

declare(strict_types=1);

namespace App\Actions\Checkout;

use App\Models\SavedCard;
use App\Models\User;
use App\Square\Data\CustomerContact;
use App\Square\Data\StoredCard;
use App\Square\IdempotencyKey;
use App\Square\SquareException;
use App\Square\SquareGateway;

/**
 * Hands a card token to Square to keep on file, and records enough locally to
 * show the customer which card it is.
 *
 *     ensure the account has a Square customer
 *       → exchange the single-use token for a stored card
 *       → save the card ID, brand, last four and expiry
 *
 * The token is spent by the exchange, so a checkout that saves a card must
 * then charge the stored card rather than the token.
 *
 * The idempotency key is derived from the token itself: a retry that reuses
 * the same token replays the first result, while a retry with a freshly
 * tokenized card is correctly treated as a new card.
 */
class SaveCardOnFile
{
    public function __construct(
        private readonly SquareGateway $square,
        private readonly EnsureSquareCustomer $ensureCustomer,
    ) {}

    /**
     * @throws SquareException when Square will not store the card
     */
    public function handle(
        User $user,
        string $sourceId,
        CustomerContact $contact,
        ?string $verificationToken = null,
    ): SavedCard {
        $customerId = $this->ensureCustomer->handle($user, $contact);

        $stored = $this->square->createCard(
            idempotencyKey: IdempotencyKey::make('felisa-card', $sourceId),
            customerId: $customerId,
            sourceId: $sourceId,
            customer: $contact,
            referenceId: (string) $user->id,
            verificationToken: $verificationToken,
        );

        return $this->record($user, $stored);
    }

    /**
     * Saving the same physical card twice updates the row that is already
     * there, so the customer's list never fills up with the same card. The
     * card it replaces is disabled, because nothing can reach it any more.
     */
    private function record(User $user, StoredCard $stored): SavedCard
    {
        $existing = $this->existingCard($user, $stored);

        if ($existing === null) {
            return $user->savedCards()->create($this->attributes($stored));
        }

        $replacedCardId = $existing->square_card_id;

        $existing->fill($this->attributes($stored))->save();

        if ($replacedCardId !== $stored->squareCardId) {
            $this->disableQuietly($replacedCardId);
        }

        return $existing;
    }

    private function existingCard(User $user, StoredCard $stored): ?SavedCard
    {
        $byCardId = $user->savedCards()->where('square_card_id', $stored->squareCardId)->first();

        if ($byCardId !== null || $stored->fingerprint === null) {
            return $byCardId;
        }

        return $user->savedCards()->where('fingerprint', $stored->fingerprint)->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function attributes(StoredCard $stored): array
    {
        return [
            'square_card_id' => $stored->squareCardId,
            'fingerprint' => $stored->fingerprint,
            'brand' => $stored->brand,
            'last_4' => $stored->last4,
            'exp_month' => $stored->expMonth,
            'exp_year' => $stored->expYear,
            'cardholder_name' => $stored->cardholderName,
        ];
    }

    /** A card we can no longer reach is not worth failing a checkout over. */
    private function disableQuietly(string $squareCardId): void
    {
        try {
            $this->square->disableCard($squareCardId);
        } catch (SquareException $exception) {
            report($exception);
        }
    }
}
