# ==========================================
# 1. Frontend Build Stage
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Copy package manifests and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy application source needed for Vite asset compilation
COPY vite.config.ts tsconfig.json components.json* ./
COPY resources ./resources
COPY public ./public

# Build frontend assets (Inertia + React + Tailwind)
RUN npm run build

# ==========================================
# 2. Composer Dependencies Stage
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
