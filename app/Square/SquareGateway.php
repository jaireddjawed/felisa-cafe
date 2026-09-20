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

    public function createPayment(
        string $idempotencyKey,
        string $squareOrderId,
        string $referenceId,
        int $amountCents,
        int $tipCents,
        string $sourceId,
        CustomerContact $customer,
    ): PaymentResult;

    public function getOrder(string $squareOrderId): OrderState;

    public function verifyWebhookSignature(string $rawBody, string $signature): bool;
}
