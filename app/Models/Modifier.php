<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Money;
use Database\Factories\ModifierFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One choice within a modifier list, e.g. "Oat Milk".
 *
 * @property int $id
 * @property int $modifier_list_id
 * @property string $square_modifier_id
 * @property string $name
 * @property int $price_cents
 * @property string $currency
 * @property int $ordinal
 * @property bool $hidden_online
 * @property-read ModifierList $modifierList
 */
class Modifier extends Model
{
    /** @use HasFactory<ModifierFactory> */
    use HasFactory;

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'price_cents' => 'integer',
            'ordinal' => 'integer',
            'hidden_online' => 'boolean',
        ];
    }

    /** @return BelongsTo<ModifierList, $this> */
    public function modifierList(): BelongsTo
    {
        return $this->belongsTo(ModifierList::class);
    }

    public function price(): Money
    {
        return new Money($this->price_cents, $this->currency);
    }
}
