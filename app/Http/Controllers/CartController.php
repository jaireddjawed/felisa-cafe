<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Cart\AddItemToCart;
use App\Actions\Cart\PriceCart;
use App\Cart\CartFullException;
use App\Cart\CartSession;
use App\Cart\InvalidSelectionException;
use App\Http\Requests\AddCartItemRequest;
use App\Http\Requests\UpdateCartItemRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The cart is shared with every page (see HandleInertiaRequests), so these
 * actions just mutate it and redirect back: Inertia re-renders the current
 * page with the updated cart and the drawer follows along.
 */
class CartController extends Controller
{
    public function index(PriceCart $priceCart, CartSession $cart): Response
    {
        return Inertia::render('cart/index', [
            'cart' => $priceCart->handle($cart)->toArray(),
        ]);
    }

    public function store(AddCartItemRequest $request, AddItemToCart $addItem, CartSession $cart): RedirectResponse
    {
        try {
            $addItem->handle(
                cart: $cart,
                squareVariationId: $request->string('variation_id')->toString(),
                squareModifierIds: $request->modifierIds(),
                quantity: $request->integer('quantity'),
                note: $request->string('note')->toString(),
            );
        } catch (InvalidSelectionException|CartFullException $exception) {
            throw ValidationException::withMessages(['cart' => $exception->getMessage()]);
        }

        return back()->with('cart_opened', (string) Str::uuid());
    }

    public function update(UpdateCartItemRequest $request, CartSession $cart, string $line): RedirectResponse
    {
        $cart->setQuantity($line, $request->integer('quantity'));

        return back();
    }

    public function destroy(CartSession $cart, string $line): RedirectResponse
    {
        $cart->remove($line);

        return back();
    }
}
