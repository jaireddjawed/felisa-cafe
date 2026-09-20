<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Who may see an order.
 *
 * An account order belongs to its owner and nobody else. A guest order
 * belongs to the session that placed it, so knowing an order ID is never
 * enough to read someone else's order.
 */
class OrderPolicy
{
    public function __construct(private readonly Request $request) {}

    public function view(?User $user, Order $order): bool
    {
        if ($order->user_id !== null) {
            return $user !== null && $user->id === $order->user_id;
        }

        $guestOrderIds = $this->request->session()->get('guest_order_ids', []);

        return is_array($guestOrderIds) && in_array($order->id, $guestOrderIds, true);
    }
}
