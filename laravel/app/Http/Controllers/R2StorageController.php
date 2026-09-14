<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Exceptions\R2StorageException;
use App\Models\User;
use App\Services\AuthorizationService;
use App\Services\R2Storage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

final class R2StorageController extends Controller
{
    public function prepare(Request $request, R2Storage $storage, AuthorizationService $authorization): JsonResponse
    {
        $actor = $this->actor($request, $authorization);
        $payload = $this->payload($request);
        $kind = is_string($payload['kind'] ?? null) ? strtolower($payload['kind']) : '';
        $files = $payload['files'] ?? null;
        $folderId = $payload['folderId'] ?? null;
        if (! is_array($files) || ($folderId !== null && ! is_string($folderId))) {
            return $this->json(['message' => 'Payload unggah tidak valid.'], 422);
        }

        try {
            return $this->json(['files' => $storage->prepare($kind, $files, $folderId, $actor)]);
        } catch (ValidationException $exception) {
            return $this->json(['message' => 'Input unggah tidak valid.', 'errors' => $exception->errors()], 422);
        } catch (R2StorageException $exception) {
            return $this->json(['message' => $exception->getMessage()], $exception->status);
        } catch (Throwable) {
            return $this->json(['message' => 'R2 tidak dapat menyiapkan unggah.'], 502);
        }
    }

    public function complete(Request $request, R2Storage $storage, AuthorizationService $authorization): JsonResponse
    {
        $actor = $this->actor($request, $authorization);
        $payload = $this->payload($request);
        $assetIds = $payload['assetIds'] ?? null;
        if (! is_array($assetIds)) {
            return $this->json(['message' => 'Payload penyelesaian unggah tidak valid.'], 422);
        }

        try {
            return $this->json(['assets' => $storage->complete($assetIds, $actor)]);
        } catch (ValidationException $exception) {
            return $this->json(['message' => 'Input penyelesaian unggah tidak valid.', 'errors' => $exception->errors()], 422);
        } catch (R2StorageException $exception) {
            return $this->json(['message' => $exception->getMessage()], $exception->status);
        } catch (Throwable) {
            return $this->json(['message' => 'R2 tidak dapat memverifikasi unggah.'], 502);
        }
    }

    private function actor(Request $request, AuthorizationService $authorization): User
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }
        if (! $authorization->has($user, PermissionKey::MediaManage->value)) {
            abort(403);
        }

        return $user;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        $payload = $request->json()->all();

        return is_array($payload) ? $payload : [];
    }

    private function json(mixed $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status);
    }
}
