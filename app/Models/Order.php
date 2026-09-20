<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\OrderStatus;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The local record of a checkout. Its items are an immutable snapshot, so the
 * order stays historically correct after products change.
 *
 * @property int $id
 * @property int|null $user_id
 * @property OrderStatus $status
 * @property string $customer_name
 * @property string $customer_email
 * @property string $customer_phone
 * @property string $notes
 * @property int $subtotal_cents
 * @property int $tax_cents
 * @property int $tip_cents
 * @property int $total_cents
 * @property string $currency
 * @property string $idempotency_key
 * @property string|null $square_order_id
 * @property int $square_order_version
 * @property string|null $square_payment_id
 * @property CarbonImmutable|null $estimated_ready_at
 * @property CarbonImmutable|null $paid_at
 * @property CarbonImmutable|null $completed_at
 * @property CarbonImmutable|null $last_synced_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User|null $user
 * @property-read Collection<int, OrderItem> $items
 */
class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory;

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'subtotal_cents' => 'integer',
            'tax_cents' => 'integer',
            'tip_cents' => 'integer',
            'total_cents' => 'integer',
            'square_order_version' => 'integer',
            'estimated_ready_at' => 'datetime',
            'paid_at' => 'datetime',
            'completed_at' => 'datetime',
            'last_synced_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<OrderItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Paid, not-yet-ready orders, oldest payment first: the preparation queue
     * that CalculateOrderEta schedules against.
     *
     * @param  Builder<$this>  $query
     */
    public function scopeInQueue(Builder $query): void
    {
        $query->whereIn('status', [OrderStatus::Paid, OrderStatus::Preparing])
            ->orderBy('paid_at');
    }

    /**
     * Orders that Square may still have news about.
     *
     * @param  Builder<$this>  $query
     */
    public function scopeUnsettled(Builder $query): void
    {
        $query->whereNotIn('status', [OrderStatus::Completed, OrderStatus::Cancelled])
            ->whereNotNull('square_order_id');
    }

    public function subtotal(): Money
    {
        return new Money($this->subtotal_cents, $this->currency);
    }

    public function tax(): Money
    {
        return new Money($this->tax_cents, $this->currency);
    }

    public function tip(): Money
    {
        return new Money($this->tip_cents, $this->currency);
    }

    public function total(): Money
    {
        return new Money($this->total_cents, $this->currency);
    }

    /** A short, human-quotable reference: "Order #A1B2C3". */
    public function reference(): string
    {
        return str_pad((string) $this->id, 6, '0', STR_PAD_LEFT);
    }

    /** The number of made-to-order items: the unit of work the ETA schedules. */
    public function preparationUnits(): int
    {
        return $this->items
            ->filter(fn (OrderItem $item): bool => $item->category?->requiresPreparation() ?? false)
            ->sum('quantity');
    }
}
