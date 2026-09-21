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

interface SquareGateway
{
    public function isConfigured(): bool;

    public function currency(): string;

    public function locationId(): string;

    public function fetchCatalog(): CatalogSnapshot;

    /**
     * @param  list<string>  $variationIds
     * @param  list<string>  $modifierIds
     */
    public function lookupPrices(array $variationIds, array $modifierIds): LivePrices;

    /**
     * @param  list<array<string, mixed>>  $objects
     */
    public function batchUpsertCatalogObjects(string $idempotencyKey, array $objects): void;

    /**
     * @param  list<string>  $itemIds
     * @return list<string> all deleted object IDs, including child variations
     */
    public function deleteCatalogItems(array $itemIds): array;

    /**
     * @param  list<OrderLine>  $lines
     */
    public function calculateOrder(string $idempotencyKey, array $lines): OrderPricing;

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
    ): OrderState;

    /**
     * Charges either a single-use token from the Web Payments SDK or a card
     * Square holds on file. A stored card can only be charged alongside the
     * `customerId` it belongs to.
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
    ): PaymentResult;

    /** Creates the Square customer that cards on file hang off. */
    public function createCustomer(
        string $idempotencyKey,
        CustomerContact $customer,
        string $referenceId,
    ): string;

    /**
     * Exchanges a single-use card token for a card stored against a customer.
     * The token is consumed here, so the payment that follows must be made
     * with the returned card instead.
     */
    public function createCard(
        string $idempotencyKey,
        string $customerId,
        string $sourceId,
        CustomerContact $customer,
        string $referenceId,
        ?string $verificationToken = null,
    ): StoredCard;

    /** Stops a stored card from being charged again. */
    public function disableCard(string $squareCardId): void;

    public function getOrder(string $squareOrderId): OrderState;

    public function verifyWebhookSignature(string $rawBody, string $signature): bool;
}
