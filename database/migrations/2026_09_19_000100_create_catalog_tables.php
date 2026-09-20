<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The local cache of the Square catalog. Square owns names, prices, variations,
 * modifiers and availability; the columns after the divider in each table are
 * owned locally and survive synchronization.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();

            // Square-owned.
            $table->string('square_item_id')->nullable()->unique();
            $table->bigInteger('square_version')->default(0);
            $table->string('status')->default('unlinked')->index();
            $table->string('name');
            $table->text('description')->default('');
            $table->string('category')->nullable()->index();
            $table->timestamp('synced_at')->nullable();

            // Locally owned presentation metadata.
            $table->string('slug')->unique();
            $table->string('tagline')->default('');
            $table->json('ingredients')->nullable();
            $table->string('size')->default('');
            $table->string('pour_top')->default('#9B6BD8');
            $table->string('pour_bottom')->default('#E7D9F8');
            $table->string('badge')->default('');
            $table->integer('sort_order')->default(0);

            $table->timestamps();
        });

        Schema::create('product_variations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('square_variation_id')->unique();
            $table->bigInteger('square_version')->default(0);
            $table->string('name');
            $table->integer('price_cents')->default(0);
            $table->string('currency', 3)->default('USD');
            // False for variable-priced or unsellable variations: we can never
            // charge for those online.
            $table->boolean('sellable')->default(true);
            $table->integer('ordinal')->default(0);
            $table->timestamps();
        });

        Schema::create('modifier_lists', function (Blueprint $table) {
            $table->id();
            $table->string('square_modifier_list_id')->unique();
            $table->string('name');
            // Normalized Square semantics: 0 means no minimum / no maximum.
            $table->integer('min_selected')->default(0);
            $table->integer('max_selected')->default(0);
            $table->timestamps();
        });

        Schema::create('modifiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('modifier_list_id')->constrained()->cascadeOnDelete();
            $table->string('square_modifier_id')->unique();
            $table->string('name');
            $table->integer('price_cents')->default(0);
            $table->string('currency', 3)->default('USD');
            $table->integer('ordinal')->default(0);
            $table->boolean('hidden_online')->default(false);
            $table->timestamps();
        });

        // A modifier list as it applies to one product, with Square's
        // item-level selection overrides already resolved.
        Schema::create('modifier_list_product', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('modifier_list_id')->constrained()->cascadeOnDelete();
            $table->integer('min_selected')->default(0);
            $table->integer('max_selected')->default(0);
            $table->integer('position')->default(0);

            $table->unique(['product_id', 'modifier_list_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('modifier_list_product');
        Schema::dropIfExists('modifiers');
        Schema::dropIfExists('modifier_lists');
        Schema::dropIfExists('product_variations');
        Schema::dropIfExists('products');
    }
};
