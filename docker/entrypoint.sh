#!/bin/sh
set -e

# Ensure PORT defaults to 8080 if not provided by Render/Cloud environment
export PORT="${PORT:-8080}"

# Ensure storage and bootstrap/cache directories exist and have proper permissions
mkdir -p /app/storage/framework/cache/data \
         /app/storage/framework/sessions \
         /app/storage/framework/views \
         /app/storage/logs \
         /app/bootstrap/cache

chmod -R 775 /app/storage /app/bootstrap/cache
chown -R www-data:www-data /app/storage /app/bootstrap/cache

# Run database migrations if configured or DB connection is present
if [ "${AUTORUN_MIGRATIONS:-true}" = "true" ] && [ -n "${DB_HOST}" ]; then
    echo "Running database migrations..."
    php artisan migrate --force

    # Load the menu so the storefront isn't empty. Both steps are idempotent:
    # the seeder upserts by slug, and the Square sync adopts those rows.
    php artisan db:seed --class=MenuSeeder --force

    # Square being unreachable or unconfigured must not stop the server booting.
    if [ -n "${SQUARE_ACCESS_TOKEN}" ]; then
        echo "Syncing Square catalog..."
        timeout 60 php artisan square:sync-catalog || echo "Square catalog sync failed; continuing."
    fi
fi

# Cache configuration, routes, and views if in production
if [ "${APP_ENV}" = "production" ]; then
    echo "Caching configuration and routes for production..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
fi

echo "Starting FrankenPHP server on port ${PORT}..."
exec frankenphp run --config /etc/caddy/Caddyfile --adapter caddyfile
