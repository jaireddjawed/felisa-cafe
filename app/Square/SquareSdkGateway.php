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
use App\Square\Data\StoredCard;
use Carbon\CarbonImmutable;
use GuzzleHttp\Client as GuzzleClient;
use LogicException;
use Square\Cards\Requests\CreateCardRequest;
use Square\Cards\Requests\DisableCardsRequest;
use Square\Catalog\Requests\BatchDeleteCatalogObjectsRequest;
use Square\Catalog\Requests\BatchGetCatalogObjectsRequest;
use Square\Catalog\Requests\BatchUpsertCatalogObjectsRequest;
use Square\Catalog\Requests\ListCatalogRequest;
use Square\Customers\Requests\CreateCustomerRequest;
use Square\Exceptions\SquareApiException as SquareSdkApiException;
use Square\Exceptions\SquareException as SquareSdkException;
use Square\Orders\Requests\CalculateOrderRequest;
use Square\Orders\Requests\GetOrdersRequest;
use Square\Payments\Requests\CreatePaymentRequest;
use Square\SquareClient;
use Square\Types\Card;
use Square\Types\CatalogObject;
use Square\Types\CatalogObjectBatch;
use Square\Types\CreateOrderRequest;
use Square\Types\Currency;
use Square\Types\Money;
use Square\Types\Order;
use Square\Utils\WebhooksHelper;
use Throwable;

/**
 * The production implementation of the application's Square boundary.
 *
 * Every failure leaves the caller with one of two answers:
 * SquareRejectedException ("this request can never succeed") or
 * SquareUnavailableException ("unknown; retry with the same idempotency key").
 */
final class SquareSdkGateway implements SquareGateway
{
    private const DELETE_BATCH_SIZE = 200;

    private const REQUEST_TIMEOUT_STATUS = 408;

    private const TOO_MANY_REQUESTS_STATUS = 429;

    private const SERVER_ERROR_STATUS = 500;

    private readonly CatalogMapper $mapper;

    private readonly bool $configured;

    private readonly SquareClient $squareClient;

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
        $this->configured = $this->accessToken !== null && $this->accessToken !== '' && $this->locationId !== '';
        $this->squareClient = new SquareClient(
            token: $this->accessToken ?? '',
            version: $this->apiVersion,
            options: [
                'baseUrl' => (string) config("square.hosts.{$this->environment}"),
                'client' => new GuzzleClient(['timeout' => $this->timeoutSeconds]),
                'maxRetries' => 2,
            ],
        );
    }

    public function isConfigured(): bool
    {
        return $this->configured;
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
        $pager = $this->send(
            fn (): mixed => $this->squareClient->catalog->list(new ListCatalogRequest([
                'types' => 'ITEM,MODIFIER_LIST,CATEGORY',
            ])),
            'catalog.list',
        );

        return $this->mapper->snapshotFromCatalogObjects($pager);
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

        $response = $this->send(
            fn (): mixed => $this->squareClient->catalog->batchGet(new BatchGetCatalogObjectsRequest([
                'objectIds' => $ids,
                'includeRelatedObjects' => true,
            ])),
            'catalog.batchGet',
        );

        [$variations, $modifiers] = $this->mapper->livePricesFromCatalogObjects(
            $response->getObjects() ?? [],
            $response->getRelatedObjects() ?? [],
        );

        return new LivePrices($variations, $modifiers);
    }

    /**
     * Creates or updates a batch of catalog objects.
     *
     * @param  list<array<string, mixed>>  $objects
     */
    public function batchUpsertCatalogObjects(string $idempotencyKey, array $objects): void
    {
        if ($objects === []) {
            return;
        }

        $this->send(
            fn (): mixed => $this->squareClient->catalog->batchUpsert(new BatchUpsertCatalogObjectsRequest([
                'idempotencyKey' => $idempotencyKey,
                'batches' => [
                    new CatalogObjectBatch([
                        'objects' => array_map(
                            fn (array $object): CatalogObject => CatalogObject::jsonDeserialize($object),
                            $objects,
                        ),
                    ]),
                ],
            ])),
            'catalog.batchUpsert',
        );
    }

    /**
     * @param  list<string>  $itemIds
     * @return list<string>
     */
    public function deleteCatalogItems(array $itemIds): array
    {
        $deletedIds = [];

        foreach (array_chunk($itemIds, self::DELETE_BATCH_SIZE) as $itemIdBatch) {
            $response = $this->send(
                fn (): mixed => $this->squareClient->catalog->batchDelete(
                    new BatchDeleteCatalogObjectsRequest(['objectIds' => $itemIdBatch]),
                ),
                'catalog.batchDelete',
            );

            $deletedIds = [...$deletedIds, ...($response->getDeletedObjectIds() ?? [])];
        }

        return array_values(array_unique($deletedIds));
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
        $response = $this->send(
            fn (): mixed => $this->squareClient->orders->calculate(new CalculateOrderRequest([
                'order' => Order::jsonDeserialize($this->orderPayload(lines: $lines)),
            ]), [
                'bodyProperties' => ['idempotency_key' => $idempotencyKey],
            ]),
            'orders.calculate',
        );

        $order = $this->sdkModelToArray($response->getOrder());

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
        $response = $this->send(
            fn (): mixed => $this->squareClient->orders->create(new CreateOrderRequest([
                'idempotencyKey' => $idempotencyKey,
                'order' => Order::jsonDeserialize($this->orderPayload($lines, $referenceId, $customer, $note, $prepMinutes)),
            ])),
            'orders.create',
        );

        return $this->orderState($this->sdkModelToArray($response->getOrder()));
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
        ?string $customerId = null,
        ?string $verificationToken = null,
    ): PaymentResult {
        $response = $this->send(
            fn (): mixed => $this->squareClient->payments->create(new CreatePaymentRequest([
                'sourceId' => $sourceId,
                'idempotencyKey' => $idempotencyKey,
                'amountMoney' => $this->money($amountCents),
                'orderId' => $squareOrderId,
                'locationId' => $this->locationId,
                'referenceId' => $referenceId,
                'autocomplete' => true,
                'note' => "Online order {$referenceId}",
                'tipMoney' => $tipCents > 0 ? $this->money($tipCents) : null,
                'buyerEmailAddress' => $customer->email === '' ? null : $customer->email,
                // Required when the source is a card on file: Square will only
                // charge a stored card for the customer that owns it.
                'customerId' => $customerId,
                'verificationToken' => $verificationToken,
            ])),
            'payments.create',
        );

        $payment = $this->sdkModelToArray($response->getPayment());
        $paymentId = Json::string($payment, 'id');

        return new PaymentResult($paymentId, $this->getOrder($squareOrderId));
    }

    /** Square's authoritative state for an order. */
    public function getOrder(string $squareOrderId): OrderState
    {
        $response = $this->send(
            fn (): mixed => $this->squareClient->orders->get(new GetOrdersRequest(['orderId' => $squareOrderId])),
            'orders.get',
        );

        return $this->orderState($this->sdkModelToArray($response->getOrder()));
    }

    // -----------------------------------------------------------------------
    // Customers and cards on file
    // -----------------------------------------------------------------------

    /**
     * Square's customer record for one of our accounts. The reference ID is
     * the local user ID, so a customer can always be traced back here.
     */
    public function createCustomer(
        string $idempotencyKey,
        CustomerContact $customer,
        string $referenceId,
    ): string {
        $response = $this->send(
            fn (): mixed => $this->squareClient->customers->create(new CreateCustomerRequest([
                'idempotencyKey' => $idempotencyKey,
                'givenName' => $customer->name === '' ? null : $customer->name,
                'emailAddress' => $customer->email === '' ? null : $customer->email,
                'referenceId' => $referenceId,
            ])),
            'customers.create',
        );

        $created = $this->sdkModelToArray($response->getCustomer());

        return Json::string($created, 'id');
    }

    /**
     * Stores a card against a customer. The single-use token is spent doing
     * this, which is why the card returned here is what gets charged.
     */
    public function createCard(
        string $idempotencyKey,
        string $customerId,
        string $sourceId,
        CustomerContact $customer,
        string $referenceId,
        ?string $verificationToken = null,
    ): StoredCard {
        $response = $this->send(
            fn (): mixed => $this->squareClient->cards->create(new CreateCardRequest([
                'idempotencyKey' => $idempotencyKey,
                'sourceId' => $sourceId,
                'verificationToken' => $verificationToken,
                'card' => new Card([
                    'customerId' => $customerId,
                    'cardholderName' => $customer->name === '' ? null : $customer->name,
                    'referenceId' => $referenceId,
                ]),
            ])),
            'cards.create',
        );

        return $this->storedCard($this->sdkModelToArray($response->getCard()));
    }

    public function disableCard(string $squareCardId): void
    {
        $this->send(
            fn (): mixed => $this->squareClient->cards->disable(
                new DisableCardsRequest(['cardId' => $squareCardId]),
            ),
            'cards.disable',
        );
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

        return WebhooksHelper::verifySignature(
            requestBody: $rawBody,
            signatureHeader: $signature,
            signatureKey: $this->webhookSignatureKey,
            notificationUrl: $this->webhookUrl,
        );
    }

    // -----------------------------------------------------------------------
    // Mapping
    // -----------------------------------------------------------------------

    /**
     * @param  array<string, mixed>  $card
     */
    private function storedCard(array $card): StoredCard
    {
        $id = Json::string($card, 'id');

        if ($id === '') {
            throw new SquareUnavailableException('Square stored a card but did not return its ID.');
        }

        return new StoredCard(
            squareCardId: $id,
            brand: Json::string($card, 'card_brand'),
            last4: Json::string($card, 'last_4'),
            expMonth: Json::int($card, 'exp_month'),
            expYear: Json::int($card, 'exp_year'),
            cardholderName: Json::string($card, 'cardholder_name'),
            fingerprint: Json::nullableString($card, 'fingerprint'),
        );
    }

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

    private function money(int $amountCents): Money
    {
        $currency = Currency::tryFrom($this->currency) ?? Currency::Usd;

        return new Money(['amount' => $amountCents, 'currency' => $currency->value]);
    }

    /**
     * @return array<string, mixed>
     */
    private function sdkModelToArray(mixed $model): array
    {
        if ($model === null) {
            return [];
        }

        $serialized = $model->jsonSerialize();

        return is_array($serialized) ? $serialized : [];
    }

    /**
     * @template TReturn
     *
     * @param  callable(): TReturn  $send
     * @return TReturn
     */
    private function send(callable $send, string $operation): mixed
    {
        if (! $this->isConfigured()) {
            throw new SquareNotConfiguredException(
                'Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID to use Square.'
            );
        }

        try {
            return $send();
        } catch (SquareSdkApiException $exception) {
            throw $this->failure($exception, $operation);
        } catch (SquareSdkException $exception) {
            throw new SquareUnavailableException(
                "Could not reach Square ({$operation}): {$exception->getMessage()}",
                previous: $exception,
            );
        } catch (Throwable $exception) {
            throw new SquareUnavailableException(
                "Could not reach Square ({$operation}): {$exception->getMessage()}",
                previous: $exception,
            );
        }
    }

    private function failure(SquareSdkApiException $exception, string $operation): SquareException
    {
        $status = $exception->getStatusCode();
        $detail = $this->errorDetail($exception);

        if ($status === self::REQUEST_TIMEOUT_STATUS
            || $status === self::TOO_MANY_REQUESTS_STATUS
            || $status >= self::SERVER_ERROR_STATUS) {
            return new SquareUnavailableException("Square {$operation} failed with {$status}: {$detail}");
        }

        return new SquareRejectedException("Square {$operation} rejected the request ({$status}): {$detail}");
    }

    /** Square's error detail, which carries its error code but never credentials. */
    private function errorDetail(SquareSdkApiException $exception): string
    {
        $errors = $exception->getErrors();

        if ($errors === []) {
            return 'no detail';
        }

        $first = $errors[0]->jsonSerialize();
        $code = Json::string($first, 'code', 'UNKNOWN');
        $detail = Json::string($first, 'detail');

        return trim("{$code} {$detail}");
    }
}
