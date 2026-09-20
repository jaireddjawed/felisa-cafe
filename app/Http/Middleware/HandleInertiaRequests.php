<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Actions\Cart\PriceCart;
use App\Cart\CartSession;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Props shared by every page.
     *
     * The cart is shared here because the header badge and the cart drawer
     * appear on every page. That is also why cart mutations can simply
     * redirect back: Inertia re-renders with a freshly priced cart.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user()?->only(['id', 'name', 'email']),
            ],
            'cart' => fn (): array => app(PriceCart::class)
                ->handle(app(CartSession::class))
                ->toArray(),
            'shop' => config('felisa.shop'),
            'flash' => [
                // A fresh token per add, so the React side can tell two
                // consecutive adds apart and reopen the drawer for each.
                'cartOpened' => $request->session()->get('cart_opened'),
            ],
        ];
    }
}
