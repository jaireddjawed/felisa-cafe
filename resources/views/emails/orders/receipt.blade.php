@component('mail::message')
# Thanks, {{ $order->customer_name }}

We received your Felisa order **#{{ $order->reference() }}**.

@if ($order->estimated_ready_at)
Estimated ready time: **{{ $order->estimated_ready_at->format('g:i A') }}**
@endif

@component('mail::table')
| Item | Total |
| :--- | ----: |
@foreach ($order->items as $item)
| {{ $item->quantity }}x {{ $item->product_name }}@if($item->optionsSummary())<br><small>{{ $item->optionsSummary() }}</small>@endif | {{ $item->total()->format() }} |
@endforeach
@endcomponent

@component('mail::table')
| Summary |  |
| :--- | ----: |
| Subtotal | {{ $order->subtotal()->format() }} |
@if ($order->tax_cents > 0)
| Tax | {{ $order->tax()->format() }} |
@endif
@if ($order->tip_cents > 0)
| Tip | {{ $order->tip()->format() }} |
@endif
| **Total** | **{{ $order->total()->format() }}** |
@endcomponent

We will have it waiting for you at the Felisa bar.

Thanks,<br>
Felisa Cafe
@endcomponent
