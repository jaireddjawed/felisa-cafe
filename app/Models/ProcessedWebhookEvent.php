<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * A Square webhook event that has already been handled. Square delivers events
 * at least once, so every delivery is checked against this table first.
 *
 * @property string $id
 * @property string $event_id
 * @property string $event_type
 * @property CarbonImmutable $processed_at
 */
class ProcessedWebhookEvent extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['processed_at' => 'datetime'];
    }
}
