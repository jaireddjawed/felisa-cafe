<?php

declare(strict_types=1);

namespace App\Enums;

enum ProductCategory: string
{
    case Signature = 'signature';
    case Matcha = 'matcha';
    case Pantry = 'pantry';
    case Merch = 'merch';

    /**
     * Whether items in this category are made to order by a barista, and so
     * occupy the preparation queue, rather than handed over off the shelf.
     */
    public function requiresPreparation(): bool
    {
        return match ($this) {
            self::Signature, self::Matcha => true,
            self::Pantry, self::Merch => false,
        };
    }

    /**
     * Match a Square category name ("Matcha Series", "Signature Drinks") onto
     * a menu section by keyword. Returns null when nothing matches, which
     * leaves the locally assigned category alone.
     */
    public static function fromSquareCategoryName(string $name): ?self
    {
        $name = mb_strtolower($name);

        foreach (self::cases() as $category) {
            if (str_contains($name, $category->value)) {
                return $category;
            }
        }

        return null;
    }
}
