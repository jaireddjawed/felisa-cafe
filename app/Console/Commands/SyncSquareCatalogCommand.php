<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\Catalog\SyncSquareCatalog;
use App\Square\SquareException;
use Illuminate\Console\Command;

class SyncSquareCatalogCommand extends Command
{
    protected $signature = 'square:sync-catalog';

    protected $description = 'Pull the Square catalog into local products (full and idempotent)';

    public function handle(SyncSquareCatalog $sync): int
    {
        try {
            $result = $sync->handle();
        } catch (SquareException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info("Catalog synced: {$result->summary()}");

        if ($result->uncategorized !== []) {
            $this->warn(
                'No menu category for: '.implode(', ', $result->uncategorized).
                '. Assign a matching category in Square, or set one locally.'
            );
        }

        return self::SUCCESS;
    }
}
