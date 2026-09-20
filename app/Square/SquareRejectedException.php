<?php

declare(strict_types=1);

namespace App\Square;

/**
 * Square refused the request and said why: a declined card, an invalid
 * catalog object, bad credentials. Retrying the identical request cannot
 * change the answer.
 */
class SquareRejectedException extends SquareException {}
