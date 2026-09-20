<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Square\Data\CustomerContact;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Everything checkout accepts from the browser. Note what is absent: no
 * prices, no totals, no tax. The only money value here is the tip, which is
 * checked against the order's own total before it is charged.
 */
class CheckoutRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:191'],
            'email' => ['required', 'email', 'max:191'],
            'notes' => ['nullable', 'string', 'max:500'],
            // Generated once per checkout attempt in the browser and reused on
            // retry, so a resubmitted form resumes one order rather than
            // creating a second.
            'idempotency_key' => ['required', 'string', 'min:16', 'max:191'],
            // A single-use card token from Square's Web Payments SDK. Card
            // details never reach this application.
            'source_id' => ['required', 'string', 'max:2048'],
            'tip_cents' => ['nullable', 'integer', 'min:0'],
        ];
    }

    public function contact(): CustomerContact
    {
        return new CustomerContact(
            name: trim($this->string('name')->toString()),
            email: trim($this->string('email')->toString()),
        );
    }

    public function tipCents(): int
    {
        return $this->integer('tip_cents');
    }
}
