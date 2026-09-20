<?php

declare(strict_types=1);

namespace App\Actions\Checkout;

use App\Models\Order;
use App\Notifications\OrderReceipt;
use Illuminate\Support\Facades\Notification;
use Throwable;

class SendOrderReceipt
{
    public function handle(Order $order): void
    {
        $order = $order->fresh('items');

        if ($order === null || ! $order->status->isPaid() || $order->receipt_sent_at !== null) {
            return;
        }

        try {
            Notification::route('mail', [$order->customer_email => $order->customer_name])
                ->notify(new OrderReceipt($order));
        } catch (Throwable $exception) {
            report($exception);

            return;
        }

        $order->forceFill(['receipt_sent_at' => now()])->save();
    }
}
