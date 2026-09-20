<?php

declare(strict_types=1);

namespace App\Square;

/**
 * Square could not be reached, or failed in a way that may succeed later
 * (timeout, network error, 429, 5xx). The outcome of the request is unknown,
 * so retries must reuse the same idempotency key.
 */
class SquareUnavailableException extends SquareException {}
