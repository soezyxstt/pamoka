<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('people', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('gender', 1)->nullable();
            $table->text('short_bio')->nullable();
            $table->foreignUuid('portrait_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps(3);

            $table->index('portrait_media_id');
        });

        Schema::create('organization_units', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_period_id')->constrained('organization_periods')->cascadeOnDelete();
            $table->foreignUuid('parent_id')->nullable()->constrained('organization_units')->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps(3);

            $table->index(['organization_period_id', 'display_order'], 'org_units_period_order_idx');
            $table->index('parent_id', 'org_units_parent_idx');
        });

        Schema::create('organization_memberships', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_period_id')->constrained('organization_periods')->cascadeOnDelete();
            $table->foreignUuid('organization_unit_id')->constrained('organization_units')->cascadeOnDelete();
            $table->foreignUuid('person_id')->constrained('people')->cascadeOnDelete();
            $table->string('title');
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps(3);

            $table->index(['organization_period_id', 'display_order'], 'org_memberships_period_order_idx');
            $table->index(['organization_unit_id', 'display_order'], 'org_memberships_unit_order_idx');
            $table->index('person_id', 'org_memberships_person_idx');
        });

        Schema::create('organization_assignments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->nullable()->constrained('editions')->nullOnDelete();
            $table->foreignUuid('person_id')->constrained('people')->cascadeOnDelete();
            $table->string('title');
            $table->string('group');
            $table->string('term_label')->nullable();
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps(3);

            $table->index(['group', 'active', 'display_order'], 'org_assignments_group_order_idx');
            $table->index(['edition_id', 'group', 'active'], 'org_assignments_edition_group_idx');
            $table->index('person_id', 'org_assignments_person_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_assignments');
        Schema::dropIfExists('organization_memberships');
        Schema::dropIfExists('organization_units');
        Schema::dropIfExists('people');
    }
};
