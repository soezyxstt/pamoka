<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('media_folders', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('parent_id')->nullable()->constrained('media_folders')->restrictOnDelete();
            $table->foreignUuid('edition_id')->nullable()->constrained('editions')->nullOnDelete();
            $table->string('name', 80);
            $table->string('slug', 80);
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps(3);

            $table->unique(['parent_id', 'slug']);
            $table->index('parent_id');
            $table->index('edition_id');
        });

        Schema::table('media_assets', function (Blueprint $table): void {
            $table->foreignUuid('folder_id')->nullable()->after('owner_user_id')->constrained('media_folders')->nullOnDelete();
            $table->index('folder_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('media_assets', function (Blueprint $table): void {
            $table->dropForeign(['folder_id']);
            $table->dropIndex(['folder_id']);
            $table->dropColumn('folder_id');
        });

        Schema::dropIfExists('media_folders');
    }
};
