<?php

declare(strict_types=1);

namespace App\Actions\Checkout;

use App\Models\SavedCard;

/**
 * What the payment will actually be charged against: either a single-use
 * token from the browser, or a card Square holds on file.
 *
 * A stored card can only be charged together with the Square customer it
 * belongs to, which is why the two travel as one value.
 */
final class PaymentSource
{
    public function __construct(
        public string $sourceId,
        public ?string $squareCustomerId = null,
        public ?string $verificationToken = null,
        public ?SavedCard $savedCard = null,
    ) {}
}
