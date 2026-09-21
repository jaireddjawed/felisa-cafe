<?php

declare(strict_types=1);

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\UpdatesUserPasswords;

class UpdateUserPassword implements UpdatesUserPasswords
{
    use PasswordValidationRules;

    /**
     * Validate and update the user's password.
     *
     * The current password is required, so a session left open on a shared
     * machine cannot be used to lock the owner out.
     *
     * @param  array<string, string>  $input
     *
     * @throws ValidationException
     */
    public function update(User $user, array $input): void
    {
        Validator::make($input, [
            'current_password' => $this->currentPasswordRules(),
            'password' => $this->passwordRules(),
        ], [
            'current_password.current_password' => 'That is not your current password.',
        ])->validateWithBag('updatePassword');

        // The model's `hashed` cast hashes it.
        $user->forceFill(['password' => $input['password']])->save();
    }
}
