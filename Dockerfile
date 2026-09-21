# ==========================================
# 1. Composer Dependencies Stage
# ==========================================
FROM composer:2 AS composer-builder
WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --no-autoloader \
    --no-scripts \
    --ignore-platform-reqs

COPY . .
RUN composer dump-autoload --optimize --no-dev

# ==========================================
# 2. Frontend Build Stage
# ==========================================
# Wayfinder invokes `php artisan` during Vite compilation, so this stage needs
# the Composer-installed application as well as Node.
FROM composer-builder AS frontend-builder

COPY --from=node:22-alpine /usr/local/bin /usr/local/bin
COPY --from=node:22-alpine /usr/local/lib/node_modules /usr/local/lib/node_modules

RUN npm ci
RUN npm run build

# ==========================================
# 3. Final Production Stage with FrankenPHP
# ==========================================
FROM dunglas/frankenphp:1-php8.4-bookworm AS runner

# Install essential PHP extensions for Laravel + Postgres + Redis
RUN install-php-extensions \
    pdo_pgsql \
    pgsql \
    pdo_sqlite \
    pdo_mysql \
    intl \
    zip \
    bcmath \
    pcntl \
    opcache \
    redis \
    gd

# Configure production PHP settings
RUN cp /usr/local/etc/php/php.ini-production /usr/local/etc/php/php.ini && \
    sed -i 's/memory_limit = .*/memory_limit = 512M/' /usr/local/etc/php/php.ini && \
    sed -i 's/upload_max_filesize = .*/upload_max_filesize = 50M/' /usr/local/etc/php/php.ini && \
    sed -i 's/post_max_size = .*/post_max_size = 50M/' /usr/local/etc/php/php.ini

WORKDIR /app

# Copy application files
COPY --chown=www-data:www-data . /app

# Copy built vendor and frontend assets from previous stages
COPY --from=composer-builder --chown=www-data:www-data /app/vendor /app/vendor
COPY --from=composer-builder --chown=www-data:www-data /app/bootstrap/cache /app/bootstrap/cache
COPY --from=frontend-builder --chown=www-data:www-data /app/public/build /app/public/build

# Copy Caddy and entrypoint configurations
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Environment settings
ENV APP_ENV=production \
    APP_DEBUG=false \
    PORT=8080

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
