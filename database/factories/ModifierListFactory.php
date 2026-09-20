<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\ModifierList;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ModifierList>
 */
class ModifierListFactory extends Factory
{
    protected $model = ModifierList::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'square_modifier_list_id' => 'SQ_LIST_'.Str::upper(Str::random(12)),
            'name' => 'Milk',
            'min_selected' => 0,
            'max_selected' => 0,
        ];
    }

    /** "Choose exactly one", the way the Milk list is configured. */
    public function pickOne(): static
    {
        return $this->state(['min_selected' => 1, 'max_selected' => 1]);
    }
}
