<?php

declare(strict_types=1);

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakeSquare;

it('deletes every Square product and its variations', function (): void {
    FakeSquare::fake([
        '/v2/catalog/list*' => Http::response(['objects' => [
            FakeSquare::item('ITEM_COFFEE', 'Coffee', []),
            FakeSquare::item('ITEM_TEA', 'Tea', []),
            FakeSquare::category('CATEGORY_DRINKS', 'Drinks'),
        ]]),
        '/v2/catalog/batch-delete' => Http::response([
            'deleted_object_ids' => ['ITEM_COFFEE', 'ITEM_TEA'],
        ]),
    ]);

    $this->artisan('square:delete-products', ['--force' => true])
        ->expectsOutput('Deleted 2 Square product(s) and their variations.')
        ->assertSuccessful();

    Http::assertSent(function (Request $request): bool {
        return str_ends_with($request->url(), '/v2/catalog/batch-delete')
            && $request->data() === ['object_ids' => ['ITEM_COFFEE', 'ITEM_TEA']];
    });
});

it('does not delete products when Square has none', function (): void {
    FakeSquare::fake([
        '/v2/catalog/list*' => Http::response(['objects' => []]),
    ]);

    $this->artisan('square:delete-products', ['--force' => true])
        ->expectsOutput('No Square products to delete.')
        ->assertSuccessful();

    Http::assertNothingSent();
});
