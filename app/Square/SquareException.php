<?php

declare(strict_types=1);

namespace App\Square;

use RuntimeException;

/**
 * Something went wrong talking to Square. Callers distinguish the two
 * subclasses, because they imply opposite recovery strategies.
 *
 * @see SquareUnavailableException retry is safe and expected
 * @see SquareRejectedException    retrying the same request cannot help
 */
abstract class SquareException extends RuntimeException {}
