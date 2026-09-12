<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('participants', function (Blueprint $table): void {
            $table->foreignUuid('qris_media_id')->nullable()->after('payment_url')->constrained('media_assets')->nullOnDelete();
            $table->index('qris_media_id', 'participants_qris_media_idx');
        });

        Schema::create('voting_campaigns', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('edition_id')->constrained('editions')->cascadeOnDelete();
            $table->foreignUuid('eligibility_stage_id')->nullable()->constrained('selection_stages')->restrictOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('timezone', 64)->default('Asia/Jakarta');
            $table->dateTime('starts_at', 3);
            $table->dateTime('ends_at', 3);
            $table->dateTime('started_at', 3)->nullable();
            $table->dateTime('closed_at', 3)->nullable();
            $table->string('status', 32)->default('draft');
            $table->unsignedInteger('price_per_point')->default(0);
            $table->string('result_visibility', 32)->default('hidden');
            $table->unsignedInteger('version')->default(1);
            $table->timestamps(3);

            $table->index(['edition_id', 'starts_at'], 'voting_campaign_edition_starts_idx');
            $table->index(['edition_id', 'status'], 'voting_campaign_edition_status_idx');
        });

        Schema::create('voting_campaign_participants', function (Blueprint $table): void {
            $table->foreignUuid('campaign_id')->constrained('voting_campaigns')->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained('participants')->restrictOnDelete();
            $table->foreignUuid('source_stage_id')->nullable()->constrained('selection_stages')->nullOnDelete();
            $table->dateTime('added_at', 3)->useCurrent();

            $table->primary(['campaign_id', 'participant_id'], 'voting_campaign_participant_primary');
            $table->index('participant_id', 'voting_campaign_participant_participant_idx');
            $table->index('source_stage_id', 'voting_campaign_participant_stage_idx');
        });

        Schema::create('vote_daily_tallies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('campaign_id')->constrained('voting_campaigns')->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained('participants')->restrictOnDelete();
            $table->string('local_date', 10);
            $table->unsignedInteger('amount')->default(0);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps(3);

            $table->unique(['campaign_id', 'participant_id', 'local_date'], 'vote_daily_tally_unique');
            $table->index(['campaign_id', 'local_date'], 'vote_daily_tally_campaign_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vote_daily_tallies');
        Schema::dropIfExists('voting_campaign_participants');
        Schema::dropIfExists('voting_campaigns');

        Schema::table('participants', function (Blueprint $table): void {
            $table->dropForeign(['qris_media_id']);
            $table->dropIndex('participants_qris_media_idx');
            $table->dropColumn('qris_media_id');
        });
    }
};
