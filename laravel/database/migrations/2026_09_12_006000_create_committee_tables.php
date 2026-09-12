<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('committee_units', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->constrained('editions')->cascadeOnDelete();
            $table->foreignUuid('parent_id')->nullable()->constrained('committee_units')->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index(['edition_id', 'display_order']);
            $table->index('parent_id');
        });

        Schema::create('committee_assignments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->constrained('editions')->cascadeOnDelete();
            $table->foreignUuid('committee_unit_id')->constrained('committee_units')->cascadeOnDelete();
            $table->foreignUuid('person_id')->constrained('people')->cascadeOnDelete();
            $table->string('title');
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->unique(['edition_id', 'committee_unit_id', 'person_id', 'title'], 'committee_assignment_unique');
            $table->index(['edition_id', 'display_order']);
            $table->index('committee_unit_id');
            $table->index('person_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('committee_assignments');
        Schema::dropIfExists('committee_units');
    }
};
