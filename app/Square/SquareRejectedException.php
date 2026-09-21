<?php

declare(strict_types=1);

namespace App\Square;

use Throwable;

/**
 * Square refused the request and said why: a declined card, an invalid
 * catalog object, bad credentials. Retrying the identical request cannot
 * change the answer.
 *
 * `errorCode` is Square's own machine-readable reason (CARD_DECLINED,
 * INSUFFICIENT_FUNDS, BAD_REQUEST…), so callers can tell a card the bank
 * turned down from a request that was simply wrong.
 */
class SquareRejectedException extends SquareException
{
    public function __construct(
        string $message = '',
        public readonly ?string $errorCode = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}
