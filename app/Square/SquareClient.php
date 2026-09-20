<?php

declare(strict_types=1);

namespace App\Square;

use App\Square\Data\CatalogSnapshot;
use App\Square\Data\CustomerContact;
use App\Square\Data\LivePrices;
use App\Square\Data\OrderLine;
use App\Square\Data\OrderPricing;
use App\Square\Data\OrderState;
use App\Square\Data\PaymentResult;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * The only class that talks to Square.
 *
 * It speaks Square's documented v2 REST API over Laravel's HTTP client, which
 * keeps the dependency surface to something the whole team already knows and
 * lets tests use Http::fake() against real Square payloads.
 *
 * Every failure leaves the caller with one of two answers:
 * SquareRejectedException ("this request can never succeed") or
 * SquareUnavailableException ("unknown; retry with the same idempotency key").
 */
class SquareClient
{
    private readonly CatalogMapper $mapper;

    public function __construct(
        private readonly ?string $accessToken,
        private readonly string $locationId,
        private readonly string $environment,
        private readonly string $currency,
        private readonly int $timeoutSeconds,
        private readonly string $apiVersion,
        private readonly ?string $webhookSignatureKey,
        private readonly ?string $webhookUrl,
    ) {
        $this->mapper = new CatalogMapper($this->locationId, $this->currency);
    }

    public function isConfigured(): bool
    {
        return $this->accessToken !== null && $this->accessToken !== '' && $this->locationId !== '';
    }

    public function currency(): string
    {
        return $this->currency;
    }

    public function locationId(): string
    {
        return $this->locationId;
    }

    // -----------------------------------------------------------------------
    // Catalog
    // -----------------------------------------------------------------------

    /**
     * Every item, modifier list and category Square currently offers. Pages
     * through the whole catalog; deleted objects are never returned.
     */
    public function fetchCatalog(): CatalogSnapshot
    {
        $objects = [];
        $cursor = null;

        do {
            $query = ['types' => 'ITEM,MODIFIER_LIST,CATEGORY'];
            if ($cursor !== null) {
                $query['cursor'] = $cursor;
            }

            $body = $this->get('/v2/catalog/list', $query);
            $objects = [...$objects, ...Json::objects($body, 'objects')];
            $cursor = Json::nullableString($body, 'cursor');
        } while ($cursor !== null);

        return $this->mapper->snapshot($objects);
    }

    /**
     * Current prices and availability for the exact objects a cart uses.
     * Related objects are included so that a variation of an archived item is
     * correctly reported as unavailable.
     *
     * @param  list<string>  $variationIds
     * @param  list<string>  $modifierIds
     */
    public function lookupPrices(array $variationIds, array $modifierIds): LivePrices
    {
        $ids = [...array_unique($variationIds), ...array_unique($modifierIds)];

        if ($ids === []) {
            return new LivePrices([], []);
        }

        $body = $this->post('/v2/catalog/batch-retrieve', [
            'object_ids' => $ids,
            'include_related_objects' => true,
        ]);

        [$variations, $modifiers] = $this->mapper->livePrices(
            Json::objects($body, 'objects'),
            Json::objects($body, 'related_objects'),
        );

        return new LivePrices($variations, $modifiers);
    }

    // -----------------------------------------------------------------------
    // Orders and payments
    // -----------------------------------------------------------------------

    /**
     * Creates a Square order from catalog IDs, so Square prices every line and
     * applies taxes. Square replays the original order for a repeated
     * idempotency key, so callers must derive the key from the stored local
     * order and rebuild this request from it.
     *
     * @param  list<OrderLine>  $lines
     */
    public function calculateOrder(string $idempotencyKey, array $lines): OrderPricing
    {
        $body = $this->post('/v2/orders/calculate', [
            'idempotency_key' => $idempotencyKey,
            'order' => $this->orderPayload(lines: $lines),
        ]);

        $order = Json::object($body, 'order');

        return new OrderPricing(
            totalCents: Json::int($order, 'total_money.amount'),
            taxCents: Json::int($order, 'total_tax_money.amount'),
            currency: Json::string($order, 'total_money.currency', $this->currency),
        );
    }

    /**
     * @param  list<OrderLine>  $lines
     */
    public function createOrder(
        string $idempotencyKey,
        string $referenceId,
        array $lines,
        CustomerContact $customer,
        string $note,
        int $prepMinutes,
    ): OrderState {
        $body = $this->post('/v2/orders', [
            'idempotency_key' => $idempotencyKey,
            'order' => $this->orderPayload($lines, $referenceId, $customer, $note, $prepMinutes),
        ]);

        return $this->orderState(Json::object($body, 'order'));
    }

    /**
     * @param  list<OrderLine>  $lines
     * @return array<string, mixed>
     */
    private function orderPayload(
        array $lines,
        ?string $referenceId = null,
        ?CustomerContact $customer = null,
        string $note = '',
        int $prepMinutes = 1,
    ): array {
        $payload = [
            'location_id' => $this->locationId,
            'line_items' => array_map($this->lineItem(...), $lines),
            'pricing_options' => [
                'auto_apply_taxes' => true,
                'auto_apply_discounts' => true,
            ],
        ];

        if ($referenceId !== null) {
            $payload['reference_id'] = $referenceId;
            $payload['fulfillments'] = [[
                'type' => 'PICKUP',
                'state' => 'PROPOSED',
                'pickup_details' => array_filter([
                    'recipient' => array_filter([
                        'display_name' => $customer?->name ?? '',
                        'email_address' => $customer?->email ?? '',
                        'phone_number' => $customer?->phone ?? '',
                    ], fn (string $value): bool => $value !== ''),
                    'schedule_type' => 'ASAP',
                    'prep_time_duration' => 'PT'.max(1, $prepMinutes).'M',
                    'note' => mb_substr($note, 0, 500),
                ], fn (array|string $value): bool => $value !== '' && $value !== []),
            ]];
            $payload['metadata'] = ['local_order_id' => $referenceId];
        }

        return $payload;
    }

    /**
     * Charges a card token produced by the Web Payments SDK in the browser,
     * then re-reads the order: only Square's own view of the order decides
     * whether it has been paid.
     */
    public function createPayment(
        string $idempotencyKey,
        string $squareOrderId,
        string $referenceId,
        int $amountCents,
        int $tipCents,
        string $sourceId,
        CustomerContact $customer,
    ): PaymentResult {
        $payload = [
            'source_id' => $sourceId,
            'idempotency_key' => $idempotencyKey,
            'amount_money' => ['amount' => $amountCents, 'currency' => $this->currency],
            'order_id' => $squareOrderId,
            'location_id' => $this->locationId,
            'reference_id' => $referenceId,
            'autocomplete' => true,
            'note' => "Online order {$referenceId}",
        ];

        if ($tipCents > 0) {
            $payload['tip_money'] = ['amount' => $tipCents, 'currency' => $this->currency];
        }
        if ($customer->email !== '') {
            $payload['buyer_email_address'] = $customer->email;
        }

        $body = $this->post('/v2/payments', $payload);
        $paymentId = Json::string($body, 'payment.id');

        return new PaymentResult($paymentId, $this->getOrder($squareOrderId));
    }

    /** Square's authoritative state for an order. */
    public function getOrder(string $squareOrderId): OrderState
    {
        $body = $this->get("/v2/orders/{$squareOrderId}");

        return $this->orderState(Json::object($body, 'order'));
    }

    // -----------------------------------------------------------------------
    // Webhooks
    // -----------------------------------------------------------------------

    /**
     * Square signs base64(HMAC-SHA256(signature key, notification URL + raw
     * body)). The URL must match the webhook subscription exactly, because it
     * is part of the signed payload.
     */
    public function verifyWebhookSignature(string $rawBody, string $signature): bool
    {
        if ($this->webhookSignatureKey === null || $this->webhookSignatureKey === ''
            || $this->webhookUrl === null || $this->webhookUrl === '') {
            throw new SquareNotConfiguredException(
                'SQUARE_WEBHOOK_SIGNATURE_KEY and SQUARE_WEBHOOK_URL are required to accept webhooks.'
            );
        }

        if ($rawBody === '' || $signature === '') {
            return false;
        }

        $expected = base64_encode(
            hash_hmac('sha256', $this->webhookUrl.$rawBody, $this->webhookSignatureKey, binary: true)
        );

        return hash_equals($expected, $signature);
    }

    // -----------------------------------------------------------------------
    // Mapping
    // -----------------------------------------------------------------------

    /**
     * @param  array<string, mixed>  $order
     */
    private function orderState(array $order): OrderState
    {
        $totalCents = Json::int($order, 'total_money.amount');

        // Paid means Square holds tenders covering the full amount due.
        // Tenders only appear once a payment has actually been captured.
        $tenders = Json::objects($order, 'tenders');
        $tendered = array_sum(array_map(
            fn (array $tender): int => Json::int($tender, 'amount_money.amount'),
            $tenders,
        ));

        $amountDue = Json::nullableInt($order, 'net_amount_due_money.amount') ?? ($totalCents - $tendered);
        $state = Json::string($order, 'state');

        $fulfillmentState = null;
        $pickedUpAt = null;
        foreach (Json::objects($order, 'fulfillments') as $fulfillment) {
            if (Json::string($fulfillment, 'type') !== 'PICKUP') {
                continue;
            }
            $fulfillmentState = Json::nullableString($fulfillment, 'state');
            $pickedUpAt = $this->parseTime(Json::nullableString($fulfillment, 'pickup_details.picked_up_at'));
            break;
        }

        return new OrderState(
            squareOrderId: Json::string($order, 'id'),
            version: Json::int($order, 'version'),
            referenceId: Json::string($order, 'reference_id'),
            state: $state,
            totalCents: $totalCents,
            taxCents: Json::int($order, 'total_tax_money.amount'),
            currency: Json::string($order, 'total_money.currency', $this->currency),
            fullyPaid: $tenders !== [] && $amountDue <= 0 && $state !== 'CANCELED',
            paymentId: Json::nullableString($tenders[0] ?? [], 'payment_id'),
            fulfillmentState: $fulfillmentState,
            pickedUpAt: $pickedUpAt,
            closedAt: $this->parseTime(Json::nullableString($order, 'closed_at')),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function lineItem(OrderLine $line): array
    {
        $item = [
            'quantity' => (string) $line->quantity,
            'catalog_object_id' => $line->squareVariationId,
            'modifiers' => array_map(
                fn (string $id): array => ['catalog_object_id' => $id],
                $line->squareModifierIds,
            ),
        ];

        if ($line->note !== '') {
            $item['note'] = mb_substr($line->note, 0, 500);
        }

        return $item;
    }

    private function parseTime(?string $value): ?CarbonImmutable
    {
        return $value === null ? null : CarbonImmutable::parse($value);
    }

    // -----------------------------------------------------------------------
    // HTTP
    // -----------------------------------------------------------------------

    /**
     * @param  array<string, string>  $query
     * @return array<string, mixed>
     */
    private function get(string $path, array $query = []): array
    {
        return $this->send(fn (PendingRequest $request): Response => $request->get($path, $query), $path);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function post(string $path, array $payload): array
    {
        return $this->send(fn (PendingRequest $request): Response => $request->post($path, $payload), $path);
    }

    /**
     * @param  callable(PendingRequest): Response  $send
     * @return array<string, mixed>
     */
    private function send(callable $send, string $path): array
    {
        if (! $this->isConfigured()) {
            throw new SquareNotConfiguredException(
                'Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID to use Square.'
            );
        }

        try {
            $response = $send($this->request());
        } catch (ConnectionException $exception) {
            // Timeout or network failure: the request may well have succeeded
            // at Square. Retries must reuse the same idempotency key.
            throw new SquareUnavailableException(
                "Could not reach Square ({$path}): {$exception->getMessage()}",
                previous: $exception,
            );
        }

        if ($response->failed()) {
            throw $this->failure($response, $path);
        }

        $body = $response->json();

        return is_array($body) ? $body : [];
    }

    private function request(): PendingRequest
    {
        $host = config("square.hosts.{$this->environment}");

        return Http::baseUrl(is_string($host) ? $host : '')
            ->withToken((string) $this->accessToken)
            ->withHeaders(['Square-Version' => $this->apiVersion])
            ->acceptJson()
            ->asJson()
            ->timeout($this->timeoutSeconds)
            // Only 408/429/5xx reach a retry, and every mutating call carries
            // an idempotency key, so retrying cannot double-charge.
            ->retry(2, 200, throw: false);
    }

    private function failure(Response $response, string $path): SquareException
    {
        $status = $response->status();
        $detail = $this->errorDetail($response);

        if ($status === 408 || $status === 429 || $status >= 500) {
            return new SquareUnavailableException("Square {$path} failed with {$status}: {$detail}");
        }

        return new SquareRejectedException("Square {$path} rejected the request ({$status}): {$detail}");
    }

    /** Square's error detail, which carries its error code but never credentials. */
    private function errorDetail(Response $response): string
    {
        $body = $response->json();
        $errors = is_array($body) ? Json::objects($body, 'errors') : [];

        if ($errors === []) {
            return 'no detail';
        }

        $code = Json::string($errors[0], 'code', 'UNKNOWN');
        $detail = Json::string($errors[0], 'detail');

        return trim("{$code} {$detail}");
    }
}
