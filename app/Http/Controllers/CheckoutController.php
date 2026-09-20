<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Cart\PriceCart;
use App\Actions\Checkout\CheckoutException;
use App\Actions\Checkout\CreateCheckout;
use App\Actions\Checkout\PayOrder;
use App\Actions\Checkout\PreviewCheckoutPricing;
use App\Actions\Checkout\SendOrderReceipt;
use App\Cart\CartSession;
use App\Http\Requests\CheckoutRequest;
use App\Square\SquareClient;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CheckoutController extends Controller
{
    public function show(
        PriceCart $priceCart,
        PreviewCheckoutPricing $previewPricing,
        CartSession $cart,
        SquareClient $square,
    ): Response {
        $priced = $priceCart->handle($cart);

        return Inertia::render('checkout/index', [
            'cart' => $priced->toArray(),
            'pricingPreview' => $previewPricing->handle($priced, $square),
            // The application and location IDs are public by design: the Web
            // Payments SDK needs them in the browser to tokenize a card.
            'square' => [
                'applicationId' => config('square.application_id'),
                'locationId' => $square->locationId(),
                'sdkUrl' => config('square.web_payments_sdk.'.config('square.environment')),
                'countryCode' => config('square.country_code'),
                'currencyCode' => config('square.currency'),
                'configured' => $square->isConfigured() && config('square.application_id') !== null,
            ],
            'allowTipping' => (bool) config('square.allow_tipping', true),
        ]);
    }

    /**
     * Creates the order and charges it. Each step is its own Action, and the
     * order they run in is the whole checkout flow:
     *
     *   CreateCheckout  cart → validated, priced, local order + Square order
     *   PayOrder        card token → Square payment → verified order state
     *
     * A card decline leaves the local order pending. The browser keeps its
     * idempotency key, so retrying resumes that same order instead of
     * creating another.
     */
    public function store(
        CheckoutRequest $request,
        CreateCheckout $createCheckout,
        PayOrder $payOrder,
        SendOrderReceipt $sendReceipt,
        CartSession $cart,
    ): RedirectResponse {
        try {
            $order = $createCheckout->handle(
                cart: $cart,
                customer: $request->contact(),
                idempotencyKey: $request->string('idempotency_key')->toString(),
                notes: $request->string('notes')->toString(),
                userId: $request->user()?->id,
            );

            $order = $payOrder->handle(
                order: $order,
                sourceId: $request->string('source_id')->toString(),
                idempotencyKey: $request->string('idempotency_key')->toString().'-payment',
                tipCents: $request->tipCents(),
            );
        } catch (CheckoutException $exception) {
            throw ValidationException::withMessages(['checkout' => $exception->getMessage()]);
        }

        $sendReceipt->handle($order);

        // The order snapshot now holds what the cart held.
        $cart->clear();

        $this->rememberGuestOrder($request, $order->id);

        return to_route('orders.show', $order);
    }

    /**
     * Lets a guest see the order they just placed. Their session is the proof
     * of ownership, so no token has to be handed to the browser.
     */
    private function rememberGuestOrder(CheckoutRequest $request, int $orderId): void
    {
        if ($request->user() !== null) {
            return;
        }

        $orderIds = $request->session()->get('guest_order_ids', []);
        $orderIds = is_array($orderIds) ? $orderIds : [];
        $orderIds[] = $orderId;

        $request->session()->put('guest_order_ids', array_values(array_unique($orderIds)));
    }
}
