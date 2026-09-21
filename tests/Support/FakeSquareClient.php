<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Square\CatalogMapper;
use App\Square\Data\CatalogSnapshot;
use App\Square\Data\CustomerContact;
use App\Square\Data\LivePrices;
use App\Square\Data\OrderLine;
use App\Square\Data\OrderPricing;
use App\Square\Data\OrderState;
use App\Square\Data\PaymentResult;
use App\Square\Data\StoredCard;
use App\Square\Json;
use App\Square\SquareException;
use App\Square\SquareGateway;
use App\Square\SquareRejectedException;
use App\Square\SquareUnavailableException;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use LogicException;

final class FakeSquareClient implements SquareGateway
{
    private const REQUEST_TIMEOUT_STATUS = 408;

    private const TOO_MANY_REQUESTS_STATUS = 429;

    private const SERVER_ERROR_STATUS = 500;

    /** @var list<array{method: string, path: string, data: array<string, mixed>}> */
    public array $recorded = [];

    private CatalogMapper $mapper;

    /**
     * @param  array<string, mixed>  $routes
     */
    public function __construct(
        array $routes,
        private readonly string $locationId = 'TEST_LOCATION',
        private readonly string $currency = 'USD',
    ) {
        unset($routes);

        $this->mapper = new CatalogMapper($this->locationId, $this->currency);
    }

    public function isConfigured(): bool
    {
        return true;
    }

    public function currency(): string
    {
        return $this->currency;
    }

    public function locationId(): string
    {
        return $this->locationId;
    }

    public function fetchCatalog(): CatalogSnapshot
    {
        $body = $this->request('GET', '/v2/catalog/list', [
            'types' => 'ITEM,MODIFIER_LIST,CATEGORY',
        ]);

        return $this->mapper->snapshot(Json::objects($body, 'objects'));
    }

    public function lookupPrices(array $variationIds, array $modifierIds): LivePrices
    {
        $ids = [...array_unique($variationIds), ...array_unique($modifierIds)];

        if ($ids === []) {
            return new LivePrices([], []);
        }

        $body = $this->request('POST', '/v2/catalog/batch-retrieve', [
            'object_ids' => $ids,
            'include_related_objects' => true,
        ]);

        [$variations, $modifiers] = $this->mapper->livePrices(
            Json::objects($body, 'objects'),
            Json::objects($body, 'related_objects'),
        );

        return new LivePrices($variations, $modifiers);
    }

    public function batchUpsertCatalogObjects(string $idempotencyKey, array $objects): void
    {
        if ($objects === []) {
            return;
        }

        $this->request('POST', '/v2/catalog/batch-upsert', [
            'idempotency_key' => $idempotencyKey,
            'batches' => [
                ['objects' => $objects],
            ],
        ]);
    }

    /**
     * @param  list<string>  $itemIds
     * @return list<string>
     */
    public function deleteCatalogItems(array $itemIds): array
    {
        $deletedIds = [];

        foreach (array_chunk($itemIds, 200) as $itemIdBatch) {
            $body = $this->request('POST', '/v2/catalog/batch-delete', [
                'object_ids' => $itemIdBatch,
            ]);

            $deletedIds = [...$deletedIds, ...Json::strings($body, 'deleted_object_ids')];
        }

        return array_values(array_unique($deletedIds));
    }

    public function calculateOrder(string $idempotencyKey, array $lines): OrderPricing
    {
        $body = $this->request('POST', '/v2/orders/calculate', [
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

    public function createOrder(
        string $idempotencyKey,
        string $referenceId,
        array $lines,
        CustomerContact $customer,
        string $note,
        int $prepMinutes,
    ): OrderState {
        $body = $this->request('POST', '/v2/orders', [
            'idempotency_key' => $idempotencyKey,
            'order' => $this->orderPayload($lines, $referenceId, $customer, $note, $prepMinutes),
        ]);

        return $this->orderState(Json::object($body, 'order'));
    }

    public function createPayment(
        string $idempotencyKey,
        string $squareOrderId,
        string $referenceId,
        int $amountCents,
        int $tipCents,
        string $sourceId,
        CustomerContact $customer,
        ?string $customerId = null,
        ?string $verificationToken = null,
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
        if ($customerId !== null) {
            $payload['customer_id'] = $customerId;
        }
        if ($verificationToken !== null) {
            $payload['verification_token'] = $verificationToken;
        }

        $body = $this->request('POST', '/v2/payments', $payload);

        return new PaymentResult(
            Json::string($body, 'payment.id'),
            $this->getOrder($squareOrderId),
        );
    }

    public function createCustomer(
        string $idempotencyKey,
        CustomerContact $customer,
        string $referenceId,
    ): string {
        $body = $this->request('POST', '/v2/customers', array_filter([
            'idempotency_key' => $idempotencyKey,
            'given_name' => $customer->name,
            'email_address' => $customer->email,
            'reference_id' => $referenceId,
        ], fn (string $value): bool => $value !== ''));

        return Json::string($body, 'customer.id');
    }

    public function createCard(
        string $idempotencyKey,
        string $customerId,
        string $sourceId,
        CustomerContact $customer,
        string $referenceId,
        ?string $verificationToken = null,
    ): StoredCard {
        $payload = [
            'idempotency_key' => $idempotencyKey,
            'source_id' => $sourceId,
            'card' => [
                'customer_id' => $customerId,
                'cardholder_name' => $customer->name,
                'reference_id' => $referenceId,
            ],
        ];

        if ($verificationToken !== null) {
            $payload['verification_token'] = $verificationToken;
        }

        $card = Json::object($this->request('POST', '/v2/cards', $payload), 'card');

        return new StoredCard(
            squareCardId: Json::string($card, 'id'),
            brand: Json::string($card, 'card_brand'),
            last4: Json::string($card, 'last_4'),
            expMonth: Json::int($card, 'exp_month'),
            expYear: Json::int($card, 'exp_year'),
            cardholderName: Json::string($card, 'cardholder_name'),
            fingerprint: Json::nullableString($card, 'fingerprint'),
        );
    }

    public function disableCard(string $squareCardId): void
    {
        $this->request('POST', "/v2/cards/{$squareCardId}/disable");
    }

    public function getOrder(string $squareOrderId): OrderState
    {
        $body = $this->request('GET', "/v2/orders/{$squareOrderId}");

        return $this->orderState(Json::object($body, 'order'));
    }

    public function verifyWebhookSignature(string $rawBody, string $signature): bool
    {
        return hash_equals(FakeSquare::signature($rawBody), $signature);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, array $data = []): array
    {
        $this->recorded[] = compact('method', 'path', 'data');

        $response = Http::send(
            $method,
            'https://'.FakeSquare::HOST.$path,
            $method === 'GET' ? ['query' => $data] : ['json' => $data],
        );

        return $this->responseBody($response, $path);
    }

    /**
     * @return array<string, mixed>
     */
    private function responseBody(mixed $response, string $path): array
    {
        if ($response instanceof Response) {
            if ($response->failed()) {
                throw $this->failure($response->status(), $this->bodyArray($response), $path);
            }

            return $this->bodyArray($response);
        }

        if (is_array($response)) {
            return $response;
        }

        return [];
    }

    /**
     * @return array<string, mixed>
     */
    private function bodyArray(Response $response): array
    {
        $body = $response->json();

        return is_array($body) ? $body : [];
    }

    private function failure(int $status, array $body, string $path): SquareException
    {
        $errors = Json::objects($body, 'errors');
        $code = $errors === [] ? 'UNKNOWN' : Json::string($errors[0], 'code', 'UNKNOWN');
        $detail = $errors === [] ? 'no detail' : Json::string($errors[0], 'detail');
        $message = "Square {$path} rejected the request ({$status}): ".trim("{$code} {$detail}");

        if ($status === self::REQUEST_TIMEOUT_STATUS
            || $status === self::TOO_MANY_REQUESTS_STATUS
            || $status >= self::SERVER_ERROR_STATUS) {
            return new SquareUnavailableException("Square {$path} failed with {$status}: ".trim("{$code} {$detail}"));
        }

        return new SquareRejectedException($message);
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
            if ($customer === null) {
                throw new LogicException('A customer is required when creating a Square order.');
            }

            $payload['reference_id'] = $referenceId;
            $payload['fulfillments'] = [[
                'type' => 'PICKUP',
                'state' => 'PROPOSED',
                'pickup_details' => array_filter([
                    'recipient' => [
                        'display_name' => $customer->name,
                        'email_address' => $customer->email,
                    ],
                    'schedule_type' => 'ASAP',
                    'prep_time_duration' => 'PT'.max(1, $prepMinutes).'M',
                    'note' => mb_substr($note, 0, 500),
                ], fn (array|string $value): bool => $value !== ''),
            ]];
            $payload['metadata'] = ['local_order_id' => $referenceId];
        }

        return $payload;
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

    /**
     * @param  array<string, mixed>  $order
     */
    private function orderState(array $order): OrderState
    {
        $totalCents = Json::int($order, 'total_money.amount');
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

    private function parseTime(?string $value): ?CarbonImmutable
    {
        return $value === null ? null : CarbonImmutable::parse($value);
    }
}
