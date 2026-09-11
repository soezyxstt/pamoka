<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_periods', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('label');
            $table->unsignedSmallInteger('start_year');
            $table->unsignedSmallInteger('end_year');
            $table->text('vision')->nullable();
            $table->json('mission_json');
            $table->string('lifecycle', 32)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->index('lifecycle');
            $table->index(['start_year', 'end_year']);
        });

        Schema::create('editions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedSmallInteger('year')->unique();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('timezone', 64)->default('Asia/Jakarta');
            $table->string('lifecycle', 32)->default('draft');
            $table->dateTime('starts_at', 3)->nullable();
            $table->dateTime('ends_at', 3)->nullable();
            $table->foreignUuid('organization_period_id')->nullable()->constrained('organization_periods')->nullOnDelete();
            $table->text('slogan')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->index('lifecycle');
        });

        Schema::create('categories', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->constrained('editions')->cascadeOnDelete();
            $table->string('code', 8);
            $table->string('slug');
            $table->string('label');
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['edition_id', 'code']);
            $table->unique(['edition_id', 'slug']);
        });

        Schema::create('selection_stages', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->constrained('editions')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->unsignedInteger('display_order')->default(0);
            $table->unsignedInteger('target_participant_count')->default(0);
            $table->string('lifecycle', 32)->default('draft');
            $table->boolean('final_stage')->default(false);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->unique(['edition_id', 'slug']);
            $table->index(['edition_id', 'display_order']);
        });

        Schema::create('participants', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->constrained('editions')->cascadeOnDelete();
            $table->foreignUuid('category_id')->constrained('categories')->restrictOnDelete();
            $table->string('stage');
            $table->foreignUuid('current_stage_id')->nullable()->constrained('selection_stages')->restrictOnDelete();
            $table->string('selection_status', 32)->default('registered');
            $table->unsignedInteger('number');
            $table->string('name');
            $table->string('slug');
            $table->text('bio')->nullable();
            $table->text('payment_url')->nullable();
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->unique(['edition_id', 'stage', 'slug']);
            $table->index(['edition_id', 'category_id']);
            $table->index('current_stage_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('participants');
        Schema::dropIfExists('selection_stages');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('editions');
        Schema::dropIfExists('organization_periods');
    }
};
