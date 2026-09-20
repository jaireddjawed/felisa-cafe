<?php

declare(strict_types=1);

namespace App\Actions\Square;

use App\Actions\Catalog\SyncSquareCatalog;
use App\Actions\Orders\SyncOrderFromSquare;
use App\Models\ProcessedWebhookEvent;
use App\Square\Json;
use App\Square\SquareException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Log;

/**
 * Processes one signature-verified Square webhook.
 *
 * Square delivers at least once and in no particular order, so processing is
 * idempotent twice over: an event ID we have already handled is skipped, and
 * handling never trusts what the payload says happened. It takes only the
 * order ID from the event and re-reads that order from Square, which converges
 * on the right answer however the events arrive.
 *
 * A SquareException here means the event could not be processed. The
 * controller answers 500 and Square redelivers, which is the recovery path
 * for a Square outage in the middle of a delivery.
 *
 * @throws SquareException
 */
class HandleSquareWebhook
{
    public function __construct(
        private readonly SyncOrderFromSquare $syncOrder,
        private readonly SyncSquareCatalog $syncCatalog,
    ) {}

    /**
     * @param  array<string, mixed>  $payload  the decoded, verified event
     */
    public function handle(array $payload): void
    {
        $eventId = Json::nullableString($payload, 'event_id');
        $type = Json::nullableString($payload, 'type');

        if ($eventId === null || $type === null) {
            // Malformed beyond recovery; redelivering it would not help.
            Log::warning('Discarding a Square webhook with no event_id or type.');

            return;
        }

        if (ProcessedWebhookEvent::query()->where('event_id', $eventId)->exists()) {
            return;
        }

        $this->process($payload, $type);

        try {
            ProcessedWebhookEvent::query()->create([
                'event_id' => $eventId,
                'event_type' => $type,
                'processed_at' => now(),
            ]);
        } catch (UniqueConstraintViolationException) {
            // A concurrent delivery of the same event won the race. Both did
            // the same idempotent work, so there is nothing to fix.
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function process(array $payload, string $type): void
    {
        if ($type === 'catalog.version.updated') {
            // A cafe catalog is a couple of API calls, well within Square's
            // delivery timeout, so this runs inline rather than on a queue.
            $this->syncCatalog->handle();

            return;
        }

        $isOrderEvent = str_starts_with($type, 'order.')
            || str_starts_with($type, 'payment.')
            || str_starts_with($type, 'refund.');

        if (! $isOrderEvent) {
            return;
        }

        $squareOrderId = $this->squareOrderId($payload);

        if ($squareOrderId !== null) {
            // Returns null for orders that aren't ours, e.g. in-store POS
            // sales, which we acknowledge without further work.
            $this->syncOrder->bySquareOrderId($squareOrderId);
        }
    }

    /**
     * Square puts the order ID in a different place per event type
     * (`payment.order_id`, `order_updated.order_id`, ...), so we look for the
     * first `order_id` inside the event's object, then fall back to the
     * object's own ID for order events.
     *
     * @param  array<string, mixed>  $payload
     */
    private function squareOrderId(array $payload): ?string
    {
        foreach (Json::object($payload, 'data.object') as $value) {
            if (is_array($value)) {
                $orderId = Json::nullableString($value, 'order_id');

                if ($orderId !== null) {
                    return $orderId;
                }
            }
        }

        if (Json::string($payload, 'data.type') === 'order') {
            return Json::nullableString($payload, 'data.id');
        }

        return null;
    }
}
