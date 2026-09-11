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
        Schema::create('media_assets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('provider', 32);
            $table->string('provider_key')->nullable();
            $table->text('url');
            $table->string('filename');
            $table->string('mime_type', 128);
            $table->unsignedBigInteger('bytes');
            $table->text('alt')->nullable();
            $table->boolean('decorative')->default(false);
            $table->string('lifecycle', 32)->default('ready');
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps(3);

            $table->unique(['provider', 'provider_key']);
            $table->index('lifecycle');
        });

        Schema::create('edition_titles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->constrained('editions')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('capacity')->default(1);
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps(3);

            $table->unique(['edition_id', 'name']);
            $table->index(['edition_id', 'display_order']);
        });

        Schema::create('participant_achievements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('participant_id')->constrained('participants')->cascadeOnDelete();
            $table->text('text');
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps(3);

            $table->index(['participant_id', 'display_order']);
        });

        Schema::create('participant_social_links', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('participant_id')->constrained('participants')->cascadeOnDelete();
            $table->string('platform', 32);
            $table->string('label')->nullable();
            $table->text('url');
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps(3);

            $table->index(['participant_id', 'display_order']);
        });

        Schema::create('participant_media', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('participant_id')->constrained('participants')->cascadeOnDelete();
            $table->string('role', 32);
            $table->foreignUuid('media_asset_id')->constrained('media_assets')->cascadeOnDelete();
            $table->text('caption')->nullable();
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps(3);

            $table->index(['participant_id', 'role', 'active']);
            $table->index('media_asset_id');
        });

        Schema::create('participant_title_assignments', function (Blueprint $table): void {
            $table->foreignUuid('edition_title_id')->constrained('edition_titles')->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained('participants')->cascadeOnDelete();
            $table->dateTime('assigned_at', 3)->useCurrent();
            $table->foreignId('assigned_by_user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->primary(['edition_title_id', 'participant_id']);
            $table->index('participant_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('participant_title_assignments');
        Schema::dropIfExists('participant_media');
        Schema::dropIfExists('participant_social_links');
        Schema::dropIfExists('participant_achievements');
        Schema::dropIfExists('edition_titles');
        Schema::dropIfExists('media_assets');
    }
};
