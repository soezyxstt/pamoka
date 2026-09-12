<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Exceptions\UploadThingException;
use App\Services\AuthorizationService;
use App\Services\UploadThingAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class UploadThingController extends Controller
{
    public function metadata(UploadThingAdapter $adapter): JsonResponse
    {
        return $this->json($adapter->metadata());
    }

    public function handle(
        Request $request,
        UploadThingAdapter $adapter,
        AuthorizationService $authorization,
    ): JsonResponse {
        $hook = $request->header('uploadthing-hook');
        if ($hook !== null) {
            return $this->handleHook($request, $adapter, $hook);
        }

        if ($request->query('actionType') !== 'upload') {
            return $this->json(['message' => 'Jenis aksi UploadThing tidak valid.'], 400);
        }

        $user = $request->user();
        if ($user === null) {
            return $this->json(['message' => 'Unauthenticated.'], 401);
        }
        if (! $authorization->has($user, PermissionKey::MediaManage->value)) {
            return $this->json(['message' => 'Forbidden.'], 403);
        }

        $payload = $this->payload($request);
        try {
            $files = $payload['files'] ?? null;
            $input = $payload['input'] ?? null;
            if (! is_array($files) || ($input !== null && ! is_array($input))) {
                throw ValidationException::withMessages(['files' => 'Payload unggah tidak valid.']);
            }

            return $this->json($adapter->prepareUpload(
                (string) $request->query('slug', ''),
                $files,
                $input,
                $user,
                (string) (config('services.uploadthing.callback_url') ?: route('uploadthing.endpoint')),
                (string) $request->header('x-uploadthing-package', 'uploadthing/laravel-inertia'),
            ));
        } catch (ValidationException $exception) {
            return $this->json([
                'message' => 'Input unggah tidak valid.',
                'errors' => $exception->errors(),
            ], 422);
        } catch (UploadThingException $exception) {
            return $this->json(['message' => $exception->getMessage()], $exception->status);
        } catch (Throwable) {
            return $this->json(['message' => 'Upload provider tidak dapat diproses.'], 502);
        }
    }

    private function handleHook(Request $request, UploadThingAdapter $adapter, string $hook): JsonResponse
    {
        if (! in_array($hook, ['callback', 'error'], true) || ! $adapter->verifyCallbackSignature($request->getContent(), $request->header('x-uploadthing-signature'))) {
            return $this->json(['message' => 'Signature callback tidak valid.'], 400);
        }
        if ($hook === 'error') {
            return $this->json(['ok' => true]);
        }

        try {
            $payload = $this->payload($request);
            $identity = $adapter->persistCallback($payload);
            $origin = $payload['origin'] ?? null;
            if (! is_string($origin) || trim($origin) === '') {
                throw new UploadThingException('Origin callback tidak ditemukan.', 422);
            }
            $adapter->reportCallbackResult(
                $origin,
                $identity['providerKey'],
                $identity,
                (string) $request->header('x-uploadthing-package', 'uploadthing/laravel-inertia'),
            );

            return $this->json(['ok' => true]);
        } catch (ValidationException $exception) {
            return $this->json([
                'message' => 'Payload callback tidak valid.',
                'errors' => $exception->errors(),
            ], 422);
        } catch (UploadThingException $exception) {
            return $this->json(['message' => $exception->getMessage()], $exception->status);
        } catch (Throwable) {
            return $this->json(['message' => 'Callback upload provider tidak dapat diproses.'], 502);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        try {
            $payload = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            throw ValidationException::withMessages(['payload' => 'Payload JSON tidak valid.']);
        }
        if (! is_array($payload)) {
            throw ValidationException::withMessages(['payload' => 'Payload JSON tidak valid.']);
        }

        return $payload;
    }

    private function json(mixed $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status)->header('x-uploadthing-version', UploadThingAdapter::VERSION);
    }
}
