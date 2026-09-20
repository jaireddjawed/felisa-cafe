<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Square\SquareException;
use App\Square\SquareGateway;
use Illuminate\Console\Command;

class DeleteSquareProductsCommand extends Command
{
    protected $signature = 'square:delete-products {--force : Delete without a confirmation prompt}';

    protected $description = 'Delete every product and variation from the Square catalog';

    public function handle(SquareGateway $square): int
    {
        try {
            $itemIds = array_map(
                fn ($item): string => $item->squareItemId,
                $square->fetchCatalog()->items,
            );
        } catch (SquareException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        if ($itemIds === []) {
            $this->info('No Square products to delete.');

            return self::SUCCESS;
        }

        if (! $this->option('force') && ! $this->confirm('Delete all '.count($itemIds).' Square products and their variations?')) {
            $this->info('Deletion cancelled.');

            return self::SUCCESS;
        }

        try {
            $deletedIds = $square->deleteCatalogItems($itemIds);
        } catch (SquareException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $missingIds = array_diff($itemIds, $deletedIds);
        if ($missingIds !== []) {
            $this->error('Square did not delete every requested product: '.implode(', ', $missingIds));

            return self::FAILURE;
        }

        $this->info('Deleted '.count($itemIds).' Square product(s) and their variations.');

        return self::SUCCESS;
    }
}
