<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('editions', function (Blueprint $table): void {
            $table->foreignUuid('logo_media_id')
                ->nullable()
                ->after('organization_period_id')
                ->constrained('media_assets')
                ->nullOnDelete();
        });

        Schema::create('edition_programs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->constrained('editions')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index(['edition_id', 'display_order']);
        });

        Schema::create('site_asset_bindings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->constrained('editions')->cascadeOnDelete();
            $table->string('slot_key', 128);
            $table->foreignUuid('media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->string('alt_override')->nullable();
            $table->unsignedTinyInteger('focal_x')->nullable();
            $table->unsignedTinyInteger('focal_y')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->unique(['edition_id', 'slot_key']);
            $table->index('edition_id');
            $table->index('media_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_asset_bindings');
        Schema::dropIfExists('edition_programs');
        Schema::table('editions', function (Blueprint $table): void {
            $table->dropForeign(['logo_media_id']);
            $table->dropColumn('logo_media_id');
        });
    }
};
