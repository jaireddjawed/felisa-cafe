<?php

namespace App\Providers;

use App\Square\SquareGateway;
use App\Square\SquareSdkGateway;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(SquareGateway::class, fn (): SquareGateway => new SquareSdkGateway(
            accessToken: $this->stringConfig('square.access_token'),
            locationId: $this->stringConfig('square.location_id') ?? '',
            environment: $this->stringConfig('square.environment') ?? 'sandbox',
            currency: $this->stringConfig('square.currency') ?? 'USD',
            timeoutSeconds: (int) config('square.timeout', 15),
            apiVersion: $this->stringConfig('square.api_version') ?? '',
            webhookSignatureKey: $this->stringConfig('square.webhook_signature_key'),
            webhookUrl: $this->stringConfig('square.webhook_url'),
        ));
    }

    private function stringConfig(string $key): ?string
    {
        $value = config($key);

        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
