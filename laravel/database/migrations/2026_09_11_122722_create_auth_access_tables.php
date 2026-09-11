<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('oauth_accounts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('provider', 32);
            $table->string('provider_account_id');
            $table->text('access_token')->nullable();
            $table->text('refresh_token')->nullable();
            $table->dateTime('access_token_expires_at', 3)->nullable();
            $table->timestamps(3);

            $table->unique(['provider', 'provider_account_id']);
            $table->index('user_id');
        });

        Schema::create('admin_profiles', function (Blueprint $table): void {
            $table->foreignId('user_id')->primary()->constrained('users')->cascadeOnDelete();
            $table->string('status', 32)->default('pending');
            $table->text('status_reason')->nullable();
            $table->dateTime('requested_at', 3)->nullable();
            $table->dateTime('last_signed_in_at', 3)->nullable();
            $table->timestamps(3);
        });

        Schema::create('roles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('slug')->unique();
            $table->string('label');
            $table->text('description');
            $table->boolean('is_system')->default(true);
            $table->timestamps(3);
        });

        Schema::create('permissions', function (Blueprint $table): void {
            $table->string('key', 64)->primary();
            $table->string('label');
            $table->text('description');
            $table->timestamps(3);
        });

        Schema::create('role_permissions', function (Blueprint $table): void {
            $table->foreignUuid('role_id')->constrained('roles')->cascadeOnDelete();
            $table->string('permission_key', 64);
            $table->timestamps(3);

            $table->primary(['role_id', 'permission_key']);
            $table->foreign('permission_key')->references('key')->on('permissions')->restrictOnDelete();
        });

        Schema::create('user_roles', function (Blueprint $table): void {
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('role_id')->constrained('roles')->restrictOnDelete();
            $table->foreignId('granted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('granted_at', 3);

            $table->primary(['user_id', 'role_id']);
            $table->index('role_id');
        });

        Schema::create('user_permission_overrides', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('permission_key', 64);
            $table->string('effect', 16);
            $table->text('reason');
            $table->foreignId('granted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps(3);

            $table->unique(['user_id', 'permission_key']);
            $table->foreign('permission_key')->references('key')->on('permissions')->restrictOnDelete();
        });

        Schema::create('access_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 32)->default('open');
            $table->text('reason');
            $table->json('requested_areas_json');
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('review_note')->nullable();
            $table->dateTime('reviewed_at', 3)->nullable();
            $table->timestamps(3);

            $table->index('user_id');
            $table->index('status');
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_label');
            $table->string('action');
            $table->string('resource_type');
            $table->string('resource_id')->nullable();
            $table->string('resource_label')->nullable();
            $table->json('before_json')->nullable();
            $table->json('after_json')->nullable();
            $table->json('changed_fields_json')->nullable();
            $table->string('source');
            $table->text('reason')->nullable();
            $table->dateTime('created_at', 3);

            $table->index(['resource_type', 'resource_id']);
            $table->index('actor_user_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('access_requests');
        Schema::dropIfExists('user_permission_overrides');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('admin_profiles');
        Schema::dropIfExists('oauth_accounts');
    }
};
