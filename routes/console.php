<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Keeping up with Square
|--------------------------------------------------------------------------
|
| Both of these are safety nets rather than the primary mechanism. The catalog
| is normally refreshed by the catalog.version.updated webhook, and orders by
| their payment webhooks; these catch anything a missed delivery would leave
| behind. Both are idempotent, so running them often is harmless.
|
*/

Schedule::command('square:sync-catalog')
    ->everyThirtyMinutes()
    ->withoutOverlapping()
    ->runInBackground();

Schedule::command('square:reconcile-orders')
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->runInBackground();
