<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'user_id' => null,
            'status' => OrderStatus::PendingPayment,
            'customer_name' => fake()->name(),
            'customer_email' => fake()->safeEmail(),
            'customer_phone' => '',
            'notes' => '',
            'subtotal_cents' => 850,
            'tax_cents' => 0,
            'tip_cents' => 0,
            'total_cents' => 850,
            'currency' => 'USD',
            'idempotency_key' => (string) Str::uuid(),
            'square_order_id' => 'SQ_ORDER_'.Str::upper(Str::random(12)),
            'square_order_version' => 1,
        ];
    }

    public function paid(): static
    {
        return $this->state([
            'status' => OrderStatus::Paid,
            'paid_at' => now(),
            'square_payment_id' => 'SQ_PAY_'.Str::upper(Str::random(12)),
        ]);
    }

    public function status(OrderStatus $status): static
    {
        return $this->state([
            'status' => $status,
            'paid_at' => $status->isPaid() ? now() : null,
        ]);
    }

    /** A checkout that never reached Square, e.g. because the call timed out. */
    public function unlinked(): static
    {
        return $this->state([
            'square_order_id' => null,
            'square_order_version' => 0,
        ]);
    }
}
