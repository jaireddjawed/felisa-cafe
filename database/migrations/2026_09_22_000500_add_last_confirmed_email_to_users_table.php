<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The last address this account proved it owns. It is only recorded
        // when a confirmed address is replaced, so until the new one is
        // confirmed, order receipts can keep going to somewhere known to work.
        Schema::table('users', function (Blueprint $table) {
            $table->string('last_confirmed_email')->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_confirmed_email');
        });
    }
};
