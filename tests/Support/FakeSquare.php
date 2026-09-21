<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Square\SquareGateway;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;

/**
 * Builds Square v2 API payloads for tests and fakes the HTTP endpoints.
 *
 * Tests go through Http::fake() rather than a stubbed client interface, so
 * they exercise the real request building and the real JSON mapping in
 * App\Square. If Square's shapes and ours ever disagree, these tests are
 * where it shows up.
 */
final class FakeSquare
{
    public const HOST = 'connect.squareupsandbox.com';

    public static ?FakeSquareClient $client = null;

    /**
     * Fakes the whole Square API from a map of URL pattern to response.
     *
     * Each call replaces the previous one, so a test can sync a catalog, then
     * change what Square returns, and sync again. Http::fake() on its own
     * merges its stubs and lets the first match win, which would silently
     * ignore the second catalog.
     *
     * @param  array<string, mixed>  $routes
     */
    public static function fake(array $routes): void
    {
        Http::swap(new Factory(app(Dispatcher::class)));
        Http::preventStrayRequests();

        self::$client = new FakeSquareClient(
            routes: $routes,
            locationId: (string) config('square.location_id', 'TEST_LOCATION'),
            currency: (string) config('square.currency', 'USD'),
        );
        app()->instance(SquareGateway::class, self::$client);

        $prefixed = [];

        foreach ($routes as $pattern => $response) {
            $prefixed[self::HOST.$pattern] = $response;
        }

        Http::fake($prefixed);
    }

    /** Square is reachable and the catalog contains exactly these objects. */
    public static function fakeCatalog(mixed ...$objects): void
    {
        self::fake([
            '/v2/catalog/list*' => Http::response(['objects' => array_values($objects)]),
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $variations
     * @param  list<string>  $modifierListIds
     * @return array<string, mixed>
     */
    public static function item(
        string $id,
        string $name,
        array $variations,
        ?string $categoryId = null,
        array $modifierListIds = [],
        string $description = '',
        bool $archived = false,
        int $version = 1,
    ): array {
        $itemData = [
            'name' => $name,
            'description' => $description,
            'variations' => $variations,
            'is_archived' => $archived,
            'modifier_list_info' => array_map(
                fn (string $listId): array => [
                    'modifier_list_id' => $listId,
                    'enabled' => true,
                    // -1 on both means "use the list's own limits".
                    'min_selected_modifiers' => -1,
                    'max_selected_modifiers' => -1,
                ],
                $modifierListIds,
            ),
        ];

        if ($categoryId !== null) {
            $itemData['categories'] = [['id' => $categoryId]];
            $itemData['reporting_category'] = ['id' => $categoryId];
        }

        return [
            'type' => 'ITEM',
            'id' => $id,
            'version' => $version,
            'item_data' => $itemData,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function variation(
        string $id,
        string $name,
        int $priceCents,
        string $itemId = 'ITEM',
        int $ordinal = 0,
        string $pricingType = 'FIXED_PRICING',
        int $version = 1,
    ): array {
        $data = [
            'name' => $name,
            'item_id' => $itemId,
            'pricing_type' => $pricingType,
            'ordinal' => $ordinal,
        ];

        // Variable-priced variations carry no price and can never be sold online.
        if ($pricingType === 'FIXED_PRICING') {
            $data['price_money'] = ['amount' => $priceCents, 'currency' => 'USD'];
        }

        return [
            'type' => 'ITEM_VARIATION',
            'id' => $id,
            'version' => $version,
            'item_variation_data' => $data,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function category(string $id, string $name): array
    {
        return [
            'type' => 'CATEGORY',
            'id' => $id,
            'version' => 1,
            'category_data' => ['name' => $name],
        ];
    }

    /**
     * @param  list<array{id: string, name: string, price_cents?: int, hidden_online?: bool}>  $modifiers
     * @return array<string, mixed>
     */
    public static function modifierList(
        string $id,
        string $name,
        array $modifiers,
        int $minSelected = 0,
        int $maxSelected = 0,
    ): array {
        return [
            'type' => 'MODIFIER_LIST',
            'id' => $id,
            'version' => 1,
            'modifier_list_data' => [
                'name' => $name,
                'min_selected_modifiers' => $minSelected,
                'max_selected_modifiers' => $maxSelected === 0 ? -1 : $maxSelected,
                'selection_type' => $maxSelected === 1 ? 'SINGLE' : 'MULTIPLE',
                'modifiers' => array_map(
                    fn (array $modifier, int $ordinal): array => [
                        'type' => 'MODIFIER',
                        'id' => $modifier['id'],
                        'version' => 1,
                        'modifier_data' => [
                            'name' => $modifier['name'],
                            'price_money' => [
                                'amount' => $modifier['price_cents'] ?? 0,
                                'currency' => 'USD',
                            ],
                            'ordinal' => $ordinal,
                            'hidden_online' => $modifier['hidden_online'] ?? false,
                        ],
                    ],
                    $modifiers,
                    array_keys($modifiers),
                ),
            ],
        ];
    }

    /**
     * A Square order. Without tenders it is unpaid, which is the only thing
     * that decides whether we consider it paid.
     *
     * @return array<string, mixed>
     */
    public static function order(
        string $id = 'SQ_ORDER_1',
        string $referenceId = '1',
        int $totalCents = 850,
        int $taxCents = 0,
        bool $paid = false,
        string $state = 'OPEN',
        ?string $fulfillmentState = 'PROPOSED',
        int $version = 1,
        ?string $paymentId = 'SQ_PAY_1',
    ): array {
        $order = [
            'id' => $id,
            'version' => $version,
            'reference_id' => $referenceId,
            'state' => $state,
            'location_id' => 'TEST_LOCATION',
            'total_money' => ['amount' => $totalCents, 'currency' => 'USD'],
            'total_tax_money' => ['amount' => $taxCents, 'currency' => 'USD'],
            'net_amount_due_money' => [
                'amount' => $paid ? 0 : $totalCents,
                'currency' => 'USD',
            ],
        ];

        if ($paid) {
            $order['tenders'] = [[
                'id' => 'TENDER_1',
                'payment_id' => $paymentId,
                'amount_money' => ['amount' => $totalCents, 'currency' => 'USD'],
            ]];
        }

        if ($fulfillmentState !== null) {
            $order['fulfillments'] = [[
                'uid' => 'FUL_1',
                'type' => 'PICKUP',
                'state' => $fulfillmentState,
                'pickup_details' => ['schedule_type' => 'ASAP'],
            ]];
        }

        return ['order' => $order];
    }

    /**
     * @return array<string, mixed>
     */
    public static function payment(string $id = 'SQ_PAY_1', string $status = 'COMPLETED'): array
    {
        return ['payment' => ['id' => $id, 'status' => $status]];
    }

    /**
     * The Square customer a saved card hangs off.
     *
     * @return array<string, mixed>
     */
    public static function customer(string $id = 'SQ_CUSTOMER_1'): array
    {
        return ['customer' => ['id' => $id, 'created_at' => '2026-09-21T00:00:00Z']];
    }

    /**
     * A card Square has stored on file.
     *
     * @return array<string, mixed>
     */
    public static function card(
        string $id = 'ccof:SQ_CARD_1',
        string $brand = 'VISA',
        string $last4 = '1111',
        int $expMonth = 12,
        int $expYear = 2030,
        string $fingerprint = 'sq-1-FINGERPRINT',
        string $customerId = 'SQ_CUSTOMER_1',
    ): array {
        return ['card' => [
            'id' => $id,
            'card_brand' => $brand,
            'last_4' => $last4,
            'exp_month' => $expMonth,
            'exp_year' => $expYear,
            'cardholder_name' => 'Jaired',
            'fingerprint' => $fingerprint,
            'customer_id' => $customerId,
            'enabled' => true,
        ]];
    }

    /**
     * The batch-retrieve response checkout uses to re-verify prices.
     *
     * @param  array<string, int>  $variationPrices  Square variation ID to cents
     * @param  array<string, int>  $modifierPrices  Square modifier ID to cents
     * @param  list<string>  $unavailableIds
     * @return array<string, mixed>
     */
    public static function livePrices(
        array $variationPrices,
        array $modifierPrices = [],
        array $unavailableIds = [],
    ): array {
        $objects = [];

        foreach ($variationPrices as $id => $cents) {
            $objects[] = self::variation(
                id: $id,
                name: 'Regular',
                priceCents: $cents,
                itemId: 'ITEM_FOR_'.$id,
                pricingType: in_array($id, $unavailableIds, true) ? 'VARIABLE_PRICING' : 'FIXED_PRICING',
            );
        }

        foreach ($modifierPrices as $id => $cents) {
            $objects[] = [
                'type' => 'MODIFIER',
                'id' => $id,
                'version' => 1,
                'modifier_data' => [
                    'name' => 'Option',
                    'price_money' => ['amount' => $cents, 'currency' => 'USD'],
                ],
            ];
        }

        // Every variation's parent item, so availability resolves.
        $related = [];
        foreach (array_keys($variationPrices) as $id) {
            $related[] = [
                'type' => 'ITEM',
                'id' => 'ITEM_FOR_'.$id,
                'version' => 1,
                'item_data' => ['name' => 'Item', 'is_archived' => false],
            ];
        }

        return ['objects' => $objects, 'related_objects' => $related];
    }

    /** The signature Square would send for this body. */
    public static function signature(string $body): string
    {
        $url = config('square.webhook_url');
        $key = config('square.webhook_signature_key');

        return base64_encode(hash_hmac('sha256', $url.$body, is_string($key) ? $key : '', binary: true));
    }
}
