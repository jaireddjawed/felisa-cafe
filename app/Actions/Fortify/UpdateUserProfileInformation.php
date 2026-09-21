<?php

declare(strict_types=1);

namespace App\Actions\Fortify;

use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\UpdatesUserProfileInformation;

class UpdateUserProfileInformation implements UpdatesUserProfileInformation
{
    /**
     * Validate and update the given user's name and email.
     *
     * Errors go in their own bag so the profile and password forms, which sit
     * on the same page, never show each other's messages.
     *
     * @param  array<string, string>  $input
     *
     * @throws ValidationException
     */
    public function update(User $user, array $input): void
    {
        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($user->id),
            ],
        ])->validateWithBag('updateProfileInformation');

        $emailChanged = $input['email'] !== $user->email;

        $user->forceFill([
            'name' => $input['name'],
            'email' => $input['email'],
            // Leaving a confirmed address remembers it, so receipts keep
            // going there. Leaving an unconfirmed one keeps whichever
            // confirmed address was remembered before.
            'last_confirmed_email' => $emailChanged && $user->hasVerifiedEmail()
                ? $user->email
                : $user->last_confirmed_email,
            // A new address is unproven until its owner follows the link.
            'email_verified_at' => $emailChanged ? null : $user->email_verified_at,
        ])->save();

        if ($emailChanged) {
            $user->sendEmailVerificationNotification();
        }
    }
}
