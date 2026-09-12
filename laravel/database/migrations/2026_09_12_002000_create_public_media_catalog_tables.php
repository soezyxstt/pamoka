<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->constrained('editions')->cascadeOnDelete();
            $table->string('slug');
            $table->string('label');
            $table->text('description')->nullable();
            $table->foreignUuid('hero_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps(3);

            $table->unique(['edition_id', 'slug']);
            $table->index('hero_media_id');
        });

        Schema::create('galleries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->nullable()->constrained('editions')->cascadeOnDelete();
            $table->string('slug');
            $table->string('title');
            $table->text('description')->nullable();
            $table->foreignUuid('cover_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->string('owner_type', 32)->default('standalone');
            $table->string('owner_id');
            $table->unsignedInteger('display_order')->default(0);
            $table->string('status', 32)->default('published');
            $table->boolean('active')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps(3);

            $table->unique(['edition_id', 'slug']);
            $table->index(['owner_type', 'owner_id']);
            $table->index('cover_media_id');
        });

        Schema::create('gallery_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('gallery_id')->constrained('galleries')->cascadeOnDelete();
            $table->foreignUuid('media_asset_id')->nullable()->constrained('media_assets')->cascadeOnDelete();
            $table->string('youtube_id')->nullable();
            $table->text('caption')->nullable();
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps(3);

            $table->index(['gallery_id', 'display_order']);
            $table->index('media_asset_id');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('alter table `gallery_items` add constraint `gallery_items_exactly_one_source` check ((`media_asset_id` is not null and `youtube_id` is null) or (`media_asset_id` is null and `youtube_id` is not null))');
        }

        Schema::create('sponsors', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->constrained('editions')->cascadeOnDelete();
            $table->string('name');
            $table->string('tier', 32)->default('pelengkap');
            $table->text('website')->nullable();
            $table->foreignUuid('logo_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps(3);

            $table->unique(['edition_id', 'name']);
            $table->index(['edition_id', 'active']);
            $table->index('logo_media_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sponsors');
        Schema::dropIfExists('gallery_items');
        Schema::dropIfExists('galleries');
        Schema::dropIfExists('events');
    }
};
