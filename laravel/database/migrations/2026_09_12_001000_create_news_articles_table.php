<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('news_articles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->nullable()->constrained('editions')->nullOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('excerpt')->nullable();
            $table->longText('body')->nullable();
            $table->json('body_json')->nullable();
            $table->string('kind', 32)->default('internal');
            $table->text('source_url')->nullable();
            $table->foreignUuid('cover_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->dateTime('published_at', 3)->nullable();
            $table->string('status', 32)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->timestamps(3);

            $table->index(['edition_id', 'status']);
            $table->index(['status', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('news_articles');
    }
};
