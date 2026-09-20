<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * A cached product's state relative to Square.
 */
enum CatalogStatus: string
{
    /** Local metadata exists but no Square item is matched to it yet. Not sellable. */
    case Unlinked = 'unlinked';

    case Active = 'active';

    /** Archived in Square, or not offered at our location. */
    case Archived = 'archived';

    /**
     * No longer returned by Square. Kept rather than hard-deleted, so local
     * presentation metadata survives if the item is recreated.
     */
    case Deleted = 'deleted';
}
