<?php

declare(strict_types=1);

namespace App\Actions\Catalog;

/**
 * What one catalog sync did, for the Artisan command's output and for tests.
 */
class SyncResult
{
    public int $created = 0;

    public int $updated = 0;

    /** Square items matched to a hand-seeded local product for the first time. */
    public int $linked = 0;

    public int $deleted = 0;

    /**
     * Items whose Square categories map to no menu section. They are cached,
     * but stay hidden from the menu until someone assigns a category.
     *
     * @var list<string>
     */
    public array $uncategorized = [];

    public function summary(): string
    {
        return sprintf(
            'created=%d updated=%d linked=%d deleted=%d uncategorized=%d',
            $this->created,
            $this->updated,
            $this->linked,
            $this->deleted,
            count($this->uncategorized),
        );
    }
}
