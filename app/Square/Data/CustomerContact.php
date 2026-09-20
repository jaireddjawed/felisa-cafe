<?php

declare(strict_types=1);

namespace App\Square\Data;

final readonly class CustomerContact
{
    public function __construct(
        public string $name,
        public string $email,
    ) {}
}
