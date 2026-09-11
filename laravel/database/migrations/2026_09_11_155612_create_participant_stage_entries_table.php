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
        Schema::create('participant_stage_entries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('participant_id')->constrained('participants')->cascadeOnDelete();
            $table->foreignUuid('stage_id')->constrained('selection_stages')->cascadeOnDelete();
            $table->string('decision', 32)->default('pending');
            $table->dateTime('decided_at', 3)->nullable();
            $table->foreignId('decided_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps(3);

            $table->unique(['participant_id', 'stage_id']);
            $table->index('stage_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('participant_stage_entries');
    }
};
