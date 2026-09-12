<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('page_sections', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->nullable()->constrained('editions')->nullOnDelete();
            $table->string('page_key', 100);
            $table->string('section_key', 100);
            $table->string('title', 200)->nullable();
            $table->string('eyebrow', 120)->nullable();
            $table->text('body')->nullable();
            $table->json('presentation_json');
            $table->string('status', 32)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->timestamps(3);

            $table->unique(['edition_id', 'page_key', 'section_key'], 'page_sections_edition_page_section_unique');
            $table->index(['page_key', 'section_key', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('page_sections');
    }
};
