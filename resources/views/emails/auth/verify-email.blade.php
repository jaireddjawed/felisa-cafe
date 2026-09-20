@component('mail::message')
# Welcome to Felisa

Hi there,

Confirm this email address so your Felisa account can keep your order history in the right place.

@component('mail::button', ['url' => $url])
Confirm email
@endcomponent

You can still order without confirming, but verification helps us keep your account tidy.

If you did not create a Felisa account, you can ignore this email.

Thanks,<br>
Felisa Cafe
@endcomponent
