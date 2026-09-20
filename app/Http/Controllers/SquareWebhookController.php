<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Square\HandleSquareWebhook;
use App\Square\SquareException;
use App\Square\SquareGateway;
use App\Square\SquareNotConfiguredException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class SquareWebhookController extends Controller
{
    /**
     * The raw body is verified against Square's HMAC signature before
     * anything in it is parsed or trusted.
     *
     * Square redelivers on any non-2xx response, so only failures worth
     * retrying answer 5xx. A bad signature or an unparseable body is not
     * worth retrying.
     */
    public function __invoke(Request $request, SquareGateway $square, HandleSquareWebhook $handle): Response
    {
        $body = $request->getContent();
        $signature = (string) $request->header('x-square-hmacsha256-signature', '');

        try {
            $verified = $square->verifyWebhookSignature($body, $signature);
        } catch (SquareNotConfiguredException) {
            return response('Webhooks are not configured.', 503);
        }

        if (! $verified) {
            // Logged without the body: an unverified payload is not ours.
            Log::warning('Rejected a Square webhook with an invalid signature.', ['ip' => $request->ip()]);

            return response('Invalid signature.', 401);
        }

        $payload = json_decode($body, associative: true);

        if (! is_array($payload)) {
            return response('Malformed event.', 400);
        }

        try {
            $handle->handle($payload);
        } catch (SquareException $exception) {
            report($exception);

            // 500 asks Square to redeliver, which is how a Square outage
            // during delivery recovers.
            return response('Processing failed.', 500);
        }

        return response('', 204);
    }
}
