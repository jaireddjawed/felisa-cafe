<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\SavedCard;
use App\Models\User;
use App\Square\Data\CustomerContact;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

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
        // A signed-in customer's name and email come from their account (see
        // contact()), so only a guest has to supply them.
        $guest = $this->user() === null;

        return [
            'name' => [$guest ? 'required' : 'nullable', 'string', 'max:191'],
            'email' => [$guest ? 'required' : 'nullable', 'email', 'max:191'],
            'notes' => ['nullable', 'string', 'max:500'],
            // Generated once per checkout attempt in the browser and reused on
            // retry, so a resubmitted form resumes one order rather than
            // creating a second.
            'idempotency_key' => ['required', 'string', 'min:16', 'max:191'],
            // A single-use card token from Square's Web Payments SDK. Card
            // details never reach this application. Absent when paying with a
            // card already on file.
            'source_id' => ['required_without:saved_card_id', 'nullable', 'string', 'max:2048'],
            // A card on file, which the scoped rule below proves belongs to
            // the customer making the request. Guests match nothing.
            'saved_card_id' => [
                'nullable',
                'string',
                'uuid',
                // No account means no match, which is what a guest should get.
                Rule::exists('saved_cards', 'id')->where('user_id', Auth::id()),
            ],
            'save_card' => ['nullable', 'boolean'],
            // Square's buyer verification result, when the browser produced
            // one. It proves the buyer was challenged, and carries no card data.
            'verification_token' => ['nullable', 'string', 'max:2048'],
            'tip_cents' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * Who the order is for. An account is the source of truth for its own
     * name and email, so whatever the browser sent is ignored for a signed-in
     * customer; a guest has only what they typed.
     */
    public function contact(): CustomerContact
    {
        $user = $this->user();

        if ($user instanceof User) {
            return new CustomerContact(
                name: trim($user->name),
                // The address the receipt can safely go to, which is not
                // necessarily the account's newest one.
                email: trim($user->receiptEmail()),
            );
        }

        return new CustomerContact(
            name: trim($this->string('name')->toString()),
            email: trim($this->string('email')->toString()),
        );
    }

    public function tipCents(): int
    {
        return $this->integer('tip_cents');
    }

    /** The card on file to charge, if the customer picked one of their own. */
    public function savedCard(): ?SavedCard
    {
        $user = $this->user();
        $savedCardId = $this->string('saved_card_id')->toString();

        if ($user === null || $savedCardId === '') {
            return null;
        }

        return $user->savedCards()->with('user')->find($savedCardId);
    }

    /** Only an account can keep a card; there is nothing to attach one to. */
    public function shouldSaveCard(): bool
    {
        return $this->user() !== null && $this->boolean('save_card');
    }

    public function verificationToken(): ?string
    {
        $token = trim($this->string('verification_token')->toString());

        return $token === '' ? null : $token;
    }
}
