<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\SavedCardFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A card a customer chose to keep on file. Square stores the card itself; this
 * record holds the ID needed to charge it again and the few details needed to
 * show the customer which card they are picking.
 *
 * @property int $id
 * @property int $user_id
 * @property string $square_card_id
 * @property string|null $fingerprint
 * @property string $brand
 * @property string $last_4
 * @property int $exp_month
 * @property int $exp_year
 * @property string $cardholder_name
 * @property CarbonImmutable|null $last_used_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $user
 */
class SavedCard extends Model
{
    /** @use HasFactory<SavedCardFactory> */
    use HasFactory;

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'exp_month' => 'integer',
            'exp_year' => 'integer',
            'last_used_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** "Visa" as Square spells it: VISA, MASTERCARD, AMERICAN_EXPRESS… */
    public function brandLabel(): string
    {
        $brand = str_replace('_', ' ', mb_strtolower($this->brand));

        return match ($brand) {
            '' => 'Card',
            'visa' => 'Visa',
            default => mb_convert_case($brand, MB_CASE_TITLE),
        };
    }

    /** True once the card's expiry month has passed. */
    public function isExpired(): bool
    {
        if ($this->exp_year === 0 || $this->exp_month === 0) {
            return false;
        }

        return now()->isAfter(
            CarbonImmutable::createFromDate($this->exp_year, $this->exp_month, 1)->endOfMonth(),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toPayload(): array
    {
        return [
            'id' => $this->id,
            'brand' => $this->brandLabel(),
            'last4' => $this->last_4,
            'expMonth' => $this->exp_month,
            'expYear' => $this->exp_year,
            'expired' => $this->isExpired(),
            'addedAt' => $this->created_at?->toIso8601String(),
            'lastUsedAt' => $this->last_used_at?->toIso8601String(),
        ];
    }
}
