<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('person_social_links', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('person_id')->constrained('people')->cascadeOnDelete();
            $table->string('platform', 32);
            $table->string('label')->nullable();
            $table->text('url');
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps(3);

            $table->index(['person_id', 'display_order'], 'person_social_links_person_order_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('person_social_links');
    }
};
