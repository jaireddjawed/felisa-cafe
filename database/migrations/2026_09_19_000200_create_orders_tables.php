<?php

declare(strict_types=1);

use App\Models\OrderItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            // A short, sequential, customer-quotable number ("Order #000001").
            // The primary key is a UUID and has no natural ordinal to show.
            $table->unsignedBigInteger('number')->autoIncrement()->unique();
            // Null for guest orders: an account is never required to buy.
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status')->default('pending_payment')->index();

            $table->string('customer_name');
            $table->string('customer_email');
            $table->string('customer_phone')->default('');
            $table->text('notes')->default('');

            $table->integer('subtotal_cents')->default(0);
            $table->integer('tax_cents')->default(0);
            $table->integer('tip_cents')->default(0);
            $table->integer('total_cents')->default(0);
            $table->string('currency', 3)->default('USD');

            // The client-supplied checkout key. A retry with the same key
            // resumes this order instead of creating a second one.
            $table->string('idempotency_key')->unique();

            $table->string('square_order_id')->nullable()->unique();
            $table->bigInteger('square_order_version')->default(0);
            $table->string('square_payment_id')->nullable();

            $table->timestamp('estimated_ready_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'paid_at']);
        });

        // An immutable snapshot of what was bought: order history stays
        // correct after products are renamed, repriced or deleted.
        Schema::create('order_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('product_id')->nullable()->constrained()->nullOnDelete();

            $table->string('product_name');
            $table->string('product_slug')->default('');
            $table->string('category')->nullable();
            $table->string('square_variation_id');
            $table->string('variation_name')->default('');

            $table->integer('quantity');
            $table->integer('unit_price_cents');
            $table->integer('total_cents');
            $table->string('currency', 3)->default('USD');
            /** @see OrderItem::$modifiers */
            $table->json('modifiers')->nullable();
            $table->string('note')->default('');

            $table->timestamps();
        });

        // Square delivers webhooks at least once and out of order. Recording
        // handled event IDs makes processing idempotent.
        Schema::create('processed_webhook_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('event_id')->unique();
            $table->string('event_type');
            $table->timestamp('processed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('processed_webhook_events');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
