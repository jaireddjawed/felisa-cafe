<?php

declare(strict_types=1);

namespace App\Actions\Catalog;

/**
 * What one local-to-Square catalog push sent.
 */
class PushResult
{
    public function __construct(
        public readonly int $products,
        public readonly int $objects,
    ) {}

    public function summary(): string
    {
        return "products={$this->products} objects={$this->objects}";
    }
}
