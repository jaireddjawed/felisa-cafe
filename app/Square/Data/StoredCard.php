<?php

declare(strict_types=1);

namespace App\Square\Data;

/**
 * A card Square has stored on file for a customer. `squareCardId` is the only
 * value that can be charged, and only with the merchant's own access token;
 * everything else here exists so the customer can recognise the card.
 */
final class StoredCard
{
    public function __construct(
        public string $squareCardId,
        public string $brand,
        public string $last4,
        public int $expMonth,
        public int $expYear,
        public string $cardholderName,
        public ?string $fingerprint,
    ) {}
}
