<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\Catalog\PushSquareCatalog;
use App\Actions\Catalog\SyncSquareCatalog;
use App\Square\SquareException;
use Illuminate\Console\Command;

class PushSquareCatalogCommand extends Command
{
    protected $signature = 'square:push-catalog {--no-sync : Do not pull Square back into the local catalog after pushing}';

    protected $description = 'Create the initial Square catalog from unlinked local products';

    public function handle(PushSquareCatalog $push, SyncSquareCatalog $sync): int
    {
        try {
            $result = $push->handle();
        } catch (SquareException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        if ($result->products === 0) {
            $this->info('No unlinked local products to push.');

            return self::SUCCESS;
        }

        $this->info("Catalog pushed: {$result->summary()}");

        if ($this->option('no-sync')) {
            return self::SUCCESS;
        }

        try {
            $syncResult = $sync->handle();
        } catch (SquareException $exception) {
            $this->error('Catalog was pushed, but the follow-up sync failed: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->info("Catalog synced: {$syncResult->summary()}");

        return self::SUCCESS;
    }
}
