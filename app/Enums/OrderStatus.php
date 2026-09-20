<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * The local projection of Square's order, payment and fulfillment state.
 * Square is authoritative; this is derived from it.
 */
enum OrderStatus: string
{
    /** Order created in Square, no verified payment yet. */
    case PendingPayment = 'pending_payment';

    /** Square confirms the order is fully paid; waiting in the queue. */
    case Paid = 'paid';

    /** Staff accepted the fulfillment in Square. */
    case Preparing = 'preparing';

    /** Fulfillment marked prepared, awaiting pickup. */
    case Ready = 'ready';

    case Completed = 'completed';

    case Cancelled = 'cancelled';

    /** Whether the order currently occupies the preparation queue. */
    public function inQueue(): bool
    {
        return match ($this) {
            self::Paid, self::Preparing => true,
            default => false,
        };
    }

    /** Whether a verified payment exists for the order. */
    public function isPaid(): bool
    {
        return match ($this) {
            self::Paid, self::Preparing, self::Ready, self::Completed => true,
            default => false,
        };
    }

    public function isTerminal(): bool
    {
        return match ($this) {
            self::Completed, self::Cancelled => true,
            default => false,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::PendingPayment => 'Awaiting payment',
            self::Paid => 'Confirmed',
            self::Preparing => 'Preparing',
            self::Ready => 'Ready for pickup',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }
}
