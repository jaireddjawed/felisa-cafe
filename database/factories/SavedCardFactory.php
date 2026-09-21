<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\SavedCard;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<SavedCard>
 */
class SavedCardFactory extends Factory
{
    protected $model = SavedCard::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'square_card_id' => 'ccof:'.Str::upper(Str::random(20)),
            'fingerprint' => 'sq-1-'.Str::random(20),
            'brand' => 'VISA',
            'last_4' => (string) fake()->numberBetween(1000, 9999),
            'exp_month' => 12,
            'exp_year' => (int) now()->addYears(2)->format('Y'),
            'cardholder_name' => fake()->name(),
        ];
    }

    public function expired(): static
    {
        return $this->state([
            'exp_month' => 1,
            'exp_year' => (int) now()->subYear()->format('Y'),
        ]);
    }
}
