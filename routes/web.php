<?php

declare(strict_types=1);

use App\Http\Controllers\CartController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\MenuController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\SquareWebhookController;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class)->name('home');
Route::inertia('about', 'about')->name('about');

Route::get('menu', [MenuController::class, 'index'])->name('menu');
Route::get('menu/{product}', [MenuController::class, 'show'])->name('menu.show');

Route::get('cart', [CartController::class, 'index'])->name('cart');
Route::post('cart', [CartController::class, 'store'])->name('cart.store');
Route::patch('cart/{line}', [CartController::class, 'update'])->name('cart.update');
Route::delete('cart/{line}', [CartController::class, 'destroy'])->name('cart.destroy');

// Checkout is open to guests: an account is never required to buy.
Route::get('checkout', [CheckoutController::class, 'show'])->name('checkout');
Route::post('checkout', [CheckoutController::class, 'store'])
    ->middleware('throttle:10,1')
    ->name('checkout.store');

Route::get('orders', [OrderController::class, 'index'])
    ->middleware('auth')
    ->name('orders');

// Guests may view the order they just placed; their session proves it.
Route::get('orders/{order}', [OrderController::class, 'show'])->name('orders.show');

// Square calls this one; it is signature-verified, not session-authenticated.
Route::post('webhooks/square', SquareWebhookController::class)
    ->name('webhooks.square');
