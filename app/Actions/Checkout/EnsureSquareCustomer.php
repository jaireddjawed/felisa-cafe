<?php

declare(strict_types=1);

namespace App\Actions\Checkout;

use App\Models\User;
use App\Square\Data\CustomerContact;
use App\Square\SquareGateway;

/**
 * Cards on file belong to a Square customer, so an account needs one before
 * its first card can be stored.
 *
 * The idempotency key is derived from the account ID, so a retry after a lost
 * response returns the customer created the first time instead of a second
 * one.
 */
class EnsureSquareCustomer
{
    public function __construct(private readonly SquareGateway $square) {}

    public function handle(User $user, CustomerContact $contact): string
    {
        if ($user->square_customer_id !== null) {
            return $user->square_customer_id;
        }

        $customerId = $this->square->createCustomer(
            idempotencyKey: "felisa-customer-{$user->id}",
            customer: $contact,
            referenceId: (string) $user->id,
        );

        $user->square_customer_id = $customerId;
        $user->save();

        return $customerId;
    }
}
