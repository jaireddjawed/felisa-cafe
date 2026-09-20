<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Pickup time estimates
    |--------------------------------------------------------------------------
    |
    | The assumptions behind App\Actions\Orders\CalculateOrderEta. Every paid,
    | not-yet-ready order is work in the queue: base_prep + per_item × drinks.
    | "capacity" baristas work that queue in parallel, and "buffer" is hand-off
    | slack added to every estimate.
    |
    */

    'eta' => [
        'base_prep_seconds' => (int) env('ETA_BASE_PREP_SECONDS', 120),
        'per_item_seconds' => (int) env('ETA_PER_ITEM_SECONDS', 90),
        'buffer_seconds' => (int) env('ETA_BUFFER_SECONDS', 120),
        'capacity' => (int) env('ETA_CAPACITY', 2),
    ],

    /*
    |--------------------------------------------------------------------------
    | Cart limits
    |--------------------------------------------------------------------------
    */

    'cart' => [
        'max_lines' => 30,
        'max_line_quantity' => 20,
        'max_note_length' => 200,
    ],

    /*
    |--------------------------------------------------------------------------
    | Orders
    |--------------------------------------------------------------------------
    |
    | "refresh_after_seconds" throttles how often viewing an unsettled order
    | re-reads it from Square. "reconcile_window_hours" bounds how far back
    | the reconcile command looks for orders that missed their webhook.
    |
    */

    'orders' => [
        'history_limit' => 50,
        'refresh_after_seconds' => 10,
        'reconcile_window_hours' => 48,
    ],

    /*
    |--------------------------------------------------------------------------
    | Shop details
    |--------------------------------------------------------------------------
    |
    | Shown in the site header, footer and menu. Copy, not configuration, but
    | it appears on several pages and is the sort of thing that changes.
    |
    */

    'shop' => [
        'host' => 'Chase Coffee Roasters',
        'street' => '2736 Nutwood Ave',
        'city' => 'Fullerton, CA 92831',
        'opening_label' => 'Grand Opening',
        'opening_date' => 'Monday, October 5',
        'opening_hours' => '5:00PM – 12:00AM',
        'instagram' => '@felisacafe',
    ],

];
