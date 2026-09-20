<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Credentials
    |--------------------------------------------------------------------------
    |
    | Leave the access token empty to run the storefront without Square. The
    | menu is then served from local Product records, while checkout and
    | catalog synchronization report that Square is not configured.
    |
    */

    'access_token' => env('SQUARE_ACCESS_TOKEN'),

    'application_id' => env('SQUARE_APPLICATION_ID'),

    'location_id' => env('SQUARE_LOCATION_ID'),

    /*
    |--------------------------------------------------------------------------
    | Environment
    |--------------------------------------------------------------------------
    |
    | Either "sandbox" or "production". This picks the API host and the Web
    | Payments SDK bundle the checkout page loads in the browser.
    |
    */

    'environment' => env('SQUARE_ENVIRONMENT', 'sandbox'),

    'hosts' => [
        'sandbox' => 'https://connect.squareupsandbox.com',
        'production' => 'https://connect.squareup.com',
    ],

    'web_payments_sdk' => [
        'sandbox' => 'https://sandbox.web.squarecdn.com/v1/square.js',
        'production' => 'https://web.squarecdn.com/v1/square.js',
    ],

    /*
    |--------------------------------------------------------------------------
    | Webhooks
    |--------------------------------------------------------------------------
    |
    | Both values come from the webhook subscription in the Square Developer
    | Dashboard. The URL must match the subscription exactly, because it is
    | part of the signed payload.
    |
    */

    'webhook_signature_key' => env('SQUARE_WEBHOOK_SIGNATURE_KEY'),

    'webhook_url' => env('SQUARE_WEBHOOK_URL'),

    /*
    |--------------------------------------------------------------------------
    | Miscellaneous
    |--------------------------------------------------------------------------
    */

    'currency' => env('SQUARE_CURRENCY', 'USD'),

    'timeout' => (int) env('SQUARE_TIMEOUT', 15),

    'api_version' => '2025-01-23',

    'allow_tipping' => (bool) env('SQUARE_ALLOW_TIPPING', true),

];
