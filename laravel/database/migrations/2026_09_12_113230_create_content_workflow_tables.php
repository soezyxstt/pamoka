<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_drafts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('resource_type', 64);
            $table->string('resource_id', 36);
            $table->unsignedInteger('base_version');
            $table->json('snapshot_json');
            $table->foreignId('author_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamps(3);

            $table->unique(['resource_type', 'resource_id'], 'content_drafts_resource_unique');
            $table->index(['resource_type', 'resource_id']);
        });

        Schema::create('content_revisions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('resource_type', 64);
            $table->string('resource_id', 36);
            $table->unsignedInteger('version');
            $table->json('snapshot_json');
            $table->foreignId('author_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->dateTime('created_at', 3);

            $table->unique(['resource_type', 'resource_id', 'version'], 'content_revisions_resource_version_unique');
            $table->index(['resource_type', 'resource_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_revisions');
        Schema::dropIfExists('content_drafts');
    }
};
