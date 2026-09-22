<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Cards on file belong to a Square customer, not to a payment. One
        // customer record per account, created the first time a card is saved.
        Schema::table('users', function (Blueprint $table) {
            $table->string('square_customer_id')->nullable()->unique()->after('email');
        });

        // What we keep of a card is only what is needed to recognise it in a
        // list. The number, CVV and expiry stay at Square; `square_card_id` is
        // the only thing that can be charged, and only with our access token.
        Schema::create('saved_cards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();

            $table->string('square_card_id')->unique();
            // Square's own identifier for the underlying card number, used to
            // recognise a card the customer has already saved.
            $table->string('fingerprint')->nullable();

            $table->string('brand')->default('');
            $table->string('last_4', 4)->default('');
            $table->unsignedTinyInteger('exp_month')->default(0);
            $table->unsignedSmallInteger('exp_year')->default(0);
            $table->string('cardholder_name')->default('');

            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'fingerprint']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_cards');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('square_customer_id');
        });
    }
};
