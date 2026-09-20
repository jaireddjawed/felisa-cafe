<?php

declare(strict_types=1);

use App\Support\Money;

it('formats US dollars from integer cents', function (int $cents, string $expected): void {
    expect(new Money($cents, 'USD')->format())->toBe($expected);
})->with([
    [0, '$0.00'],
    [5, '$0.05'],
    [50, '$0.50'],
    [850, '$8.50'],
    [1600, '$16.00'],
    [123456, '$1234.56'],
    [-850, '-$8.50'],
]);

it('formats currencies without a minor unit', function (): void {
    expect(new Money(1200, 'JPY')->format())->toBe('1200 JPY');
});

it('adds and multiplies without floating point', function (): void {
    $eight_fifty = new Money(850, 'USD');

    expect($eight_fifty->plus(new Money(75, 'USD'))->cents)->toBe(925)
        ->and($eight_fifty->times(3)->cents)->toBe(2550)
        ->and($eight_fifty->times(0)->cents)->toBe(0);
});

it('refuses to combine different currencies', function (): void {
    new Money(850, 'USD')->plus(new Money(850, 'EUR'));
})->throws(InvalidArgumentException::class);

it('sends cents, currency and a rendered string to the frontend', function (): void {
    expect(new Money(850, 'USD')->toArray())->toBe([
        'cents' => 850,
        'currency' => 'USD',
        'formatted' => '$8.50',
    ]);
});
