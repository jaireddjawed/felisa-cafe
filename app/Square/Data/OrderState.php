<?php

declare(strict_types=1);

namespace App\Square\Data;

use App\Enums\OrderStatus;
use Carbon\CarbonImmutable;

/**
 * Square's authoritative view of an order. This is the only thing allowed to
 * decide whether an order has been paid.
 */
final readonly class OrderState
{
    public function __construct(
        public string $squareOrderId,
        public int $version,
        /** Our local order ID, echoed back by Square. */
        public string $referenceId,
        /** OPEN, COMPLETED or CANCELED. */
        public string $state,
        public int $totalCents,
        public int $taxCents,
        public string $currency,
        /** True only when Square holds tenders covering the full amount due. */
        public bool $fullyPaid,
        public ?string $paymentId,
        /** PROPOSED, RESERVED, PREPARED, COMPLETED, CANCELED or FAILED. */
        public ?string $fulfillmentState,
        public ?CarbonImmutable $pickedUpAt,
        public ?CarbonImmutable $closedAt,
    ) {}

    /**
     * Project Square's order, payment and fulfillment state onto our status.
     * Staff drive fulfillment from Square POS, so this is a read of their work.
     */
    public function toOrderStatus(): OrderStatus
    {
        if ($this->state === 'CANCELED') {
            return OrderStatus::Cancelled;
        }

        if ($this->state === 'COMPLETED') {
            return OrderStatus::Completed;
        }

        if (! $this->fullyPaid) {
            return OrderStatus::PendingPayment;
        }

        return match ($this->fulfillmentState) {
            'RESERVED' => OrderStatus::Preparing,
            'PREPARED' => OrderStatus::Ready,
            'COMPLETED' => OrderStatus::Completed,
            'CANCELED', 'FAILED' => OrderStatus::Cancelled,
            default => OrderStatus::Paid,
        };
    }
}
