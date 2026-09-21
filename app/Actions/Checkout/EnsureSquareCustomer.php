<?php

declare(strict_types=1);

namespace App\Actions\Checkout;

use App\Models\User;
use App\Square\Data\CustomerContact;
use App\Square\IdempotencyKey;
use App\Square\SquareGateway;

/**
 * Cards on file belong to a Square customer, so an account needs one before
 * its first card can be stored.
 *
 * The idempotency key is derived from the account's email, so a retry after a
 * lost response returns the customer created the first time instead of a
 * second one. It is not the account ID: IDs are only unique within one
 * database, and Square's keys are shared by every environment using the same
 * account, so user 2 elsewhere would be handed this user's customer.
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
            idempotencyKey: IdempotencyKey::make('felisa-customer', mb_strtolower(trim($user->email))),
            customer: $contact,
            referenceId: (string) $user->id,
        );

        $user->square_customer_id = $customerId;
        $user->save();

        return $customerId;
    }
}
