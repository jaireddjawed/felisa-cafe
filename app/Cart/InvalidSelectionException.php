<?php

declare(strict_types=1);

namespace App\Cart;

use RuntimeException;

/**
 * The requested item, variation or combination of options cannot be sold.
 * The message is written for the customer, because it is shown to them.
 */
class InvalidSelectionException extends RuntimeException {}
