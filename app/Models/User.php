<?php

namespace App\Models;

use App\Notifications\VerifyFelisaEmail;
use Carbon\CarbonImmutable;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string|null $last_confirmed_email
 * @property string|null $square_customer_id
 * @property CarbonImmutable|null $email_verified_at
 * @property string $password
 * @property string|null $remember_token
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * An account exists to give a customer their order history; guests can
     * order without one, so orders do not require a user.
     *
     * @return HasMany<Order, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /**
     * The cards this customer keeps on file. Guests cannot save a card,
     * because there is no account to attach it to.
     *
     * @return HasMany<SavedCard, $this>
     */
    public function savedCards(): HasMany
    {
        return $this->hasMany(SavedCard::class)->latest('id');
    }

    /**
     * Where an order receipt should go.
     *
     * The account's own address once it is confirmed. After a change, and
     * until the new address is confirmed, it is the last one that was, so a
     * receipt is never sent to an address nobody has proven they own. An
     * account that has never confirmed anything just uses its current address.
     */
    public function receiptEmail(): string
    {
        if ($this->hasVerifiedEmail()) {
            return $this->email;
        }

        return $this->last_confirmed_email ?? $this->email;
    }

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyFelisaEmail);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
