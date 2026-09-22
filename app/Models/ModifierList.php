<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ModifierListFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * A cached Square modifier list, e.g. "Milk" or "Add-Ons".
 *
 * @property string $id
 * @property string $square_modifier_list_id
 * @property string $name
 * @property int $min_selected
 * @property int $max_selected
 * @property-read Collection<int, Modifier> $modifiers
 * @property-read Pivot|null $pivot  set when loaded through a product
 */
class ModifierList extends Model
{
    /** @use HasFactory<ModifierListFactory> */
    use HasFactory, HasUuids;

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'min_selected' => 'integer',
            'max_selected' => 'integer',
        ];
    }

    /** @return HasMany<Modifier, $this> */
    public function modifiers(): HasMany
    {
        return $this->hasMany(Modifier::class)->orderBy('ordinal');
    }

    /**
     * The limits that apply to the product this list was loaded for. Square
     * lets an item override its lists' own limits, and those overrides are
     * stored on the pivot.
     *
     * @return array{int, int} minimum and maximum selections; 0 means unlimited
     */
    public function limitsForProduct(): array
    {
        $pivot = $this->pivot;

        if ($pivot === null) {
            return [$this->min_selected, $this->max_selected];
        }

        return [
            (int) $pivot->getAttribute('min_selected'),
            (int) $pivot->getAttribute('max_selected'),
        ];
    }
}
