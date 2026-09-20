<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Modifier;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Modifier>
 */
class ModifierFactory extends Factory
{
    protected $model = Modifier::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'modifier_list_id' => ModifierListFactory::new(),
            'square_modifier_id' => 'SQ_MOD_'.Str::upper(Str::random(12)),
            'name' => 'Oat Milk',
            'price_cents' => 0,
            'currency' => 'USD',
            'ordinal' => 0,
            'hidden_online' => false,
        ];
    }
}
