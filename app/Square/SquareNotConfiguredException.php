<?php

declare(strict_types=1);

namespace App\Square;

/**
 * No Square credentials are set. The storefront still serves its menu from
 * local Product records; only checkout and catalog sync need Square.
 *
 * This extends "unavailable" rather than "rejected" so that callers already
 * handling a Square outage — refusing to charge, showing a cached order —
 * treat a missing configuration the same safe way.
 */
class SquareNotConfiguredException extends SquareUnavailableException {}
