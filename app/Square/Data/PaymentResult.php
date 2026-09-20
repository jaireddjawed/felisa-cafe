<?php

declare(strict_types=1);

namespace App\Square\Data;

final readonly class PaymentResult
{
    public function __construct(
        public string $paymentId,
        /** The order re-read after payment, which is what proves it is paid. */
        public OrderState $order,
    ) {}
}
