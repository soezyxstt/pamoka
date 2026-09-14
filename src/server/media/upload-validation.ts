import {
  isAllowedMediaMimeType,
  mediaPolicy,
  mediaSizeLabel,
  type MediaUploadKind,
} from "./policy";

export type MediaFileLike = {
  name: string;
  type: string;
  size: number;
};

export type MediaFileRejection<T> = {
  file: T;
  reason: "mime" | "size";
};

export type MediaFileValidationResult<T> = {
  accepted: T[];
  rejected: MediaFileRejection<T>[];
  truncated: T[];
  maxFileCount: number;
};

export function validateMediaFiles<T extends MediaFileLike>(
  files: readonly T[],
  kind: MediaUploadKind,
): MediaFileValidationResult<T> {
  const valid: T[] = [];
  const rejected: MediaFileRejection<T>[] = [];
  for (const file of files) {
    if (!isAllowedMediaMimeType(kind, file.type)) {
      rejected.push({ file, reason: "mime" });
      continue;
    }
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > mediaPolicy[kind].applicationMaxBytes) {
      rejected.push({ file, reason: "size" });
      continue;
    }
    valid.push(file);
  }

  const maxFileCount = mediaPolicy[kind].maxFileCount;
  return {
    accepted: valid.slice(0, maxFileCount),
    rejected,
    truncated: valid.slice(maxFileCount),
    maxFileCount,
  };
}

export function mediaUploadAccept(kind: MediaUploadKind) {
  return mediaPolicy[kind].allowedMimeTypes.join(",");
}

export { mediaSizeLabel };

export type UploadedMediaIdentity = {
  mediaAssetId: string;
  provider: string;
  providerKey: string;
  url: string;
};

export function parseUploadedMediaIdentity(value: unknown): UploadedMediaIdentity | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.mediaAssetId !== "string" ||
    record.mediaAssetId.trim().length === 0 ||
    record.provider !== "r2" ||
    typeof record.providerKey !== "string" ||
    record.providerKey.trim().length === 0 ||
    typeof record.url !== "string" ||
    record.url.trim().length === 0
  ) {
    return null;
  }
  return {
    mediaAssetId: record.mediaAssetId.trim(),
    provider: "r2",
    providerKey: record.providerKey.trim(),
    url: record.url.trim(),
  };
}
