import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq } from "drizzle-orm";

import { env } from "@/env";
import { appendAuditLog } from "@/server/auth/audit";
import type { Database } from "@/server/db/queries";
import { mediaAssets, mediaFolders } from "@/server/db/schema";
import { isAllowedMediaMimeType, mediaPolicy, type MediaUploadKind } from "@/server/media/policy";

const PRESIGNED_URL_TTL_SECONDS = 15 * 60;
const PROVIDER = "r2";

export class R2StorageError extends Error {
  constructor(public readonly status: 422 | 502 | 503, message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

type R2Configuration = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
  region: string;
};

type MediaFileMetadata = {
  name: string;
  type: string;
  size: number;
};

export type PreparedR2File = {
  assetId: string;
  key: string;
  url: string;
  headers: { "Content-Type": string };
  name: string;
  mimeType: string;
  bytes: number;
};

export type UploadedR2Identity = {
  mediaAssetId: string;
  provider: typeof PROVIDER;
  providerKey: string;
  key: string;
  url: string;
};

export function isR2Configured() {
  try {
    getConfiguration();
    return true;
  } catch (error) {
    if (error instanceof R2StorageError) return false;
    throw error;
  }
}

export async function prepareR2Uploads(
  db: Database,
  input: {
    kind: string;
    files: unknown[];
    folderId: string | null;
    ownerUserId: string;
    actorLabel: string;
  },
): Promise<PreparedR2File[]> {
  const kind = parseKind(input.kind);
  const files = normalizeFiles(input.files, kind);
  const folderId = await resolveFolderId(db, input.folderId);
  const configuration = getConfiguration();
  const client = createR2Client(configuration);
  const prepared: PreparedR2File[] = [];
  const assets: Array<Omit<typeof mediaAssets.$inferInsert, "id"> & { id: string }> = [];

  for (const file of files) {
    const assetId = crypto.randomUUID();
    const key = objectKey(assetId, file.name);
    const command = new PutObjectCommand({
      Bucket: configuration.bucket,
      Key: key,
      ContentType: file.type,
    });
    const url = await getSignedUrl(client, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
    const publicUrl = mediaPublicUrl(configuration.publicUrl, key);

    assets.push({
      id: assetId,
      provider: PROVIDER,
      providerKey: key,
      url: publicUrl,
      filename: file.name,
      mimeType: file.type,
      bytes: file.size,
      lifecycle: "processing",
      folderId,
      ownerUserId: input.ownerUserId,
    });
    prepared.push({
      assetId,
      key,
      url,
      headers: { "Content-Type": file.type },
      name: file.name,
      mimeType: file.type,
      bytes: file.size,
    });
  }

  await db.transaction(async (tx) => {
    for (const asset of assets) {
      await tx.insert(mediaAssets).values(asset);
      await appendAuditLog(tx, {
        actorUserId: input.ownerUserId,
        actorLabel: input.actorLabel,
        action: "media.upload.prepare",
        resourceType: "mediaAsset",
        resourceId: asset.id,
        resourceLabel: asset.filename,
        after: {
          kind,
          provider: PROVIDER,
          providerKey: asset.providerKey,
          url: asset.url,
          bytes: asset.bytes,
          mimeType: asset.mimeType,
          lifecycle: asset.lifecycle,
          folderId,
        },
        changedFields: ["provider", "providerKey", "url", "lifecycle", "folderId"],
        source: "r2-upload",
      });
    }
  });

  return prepared;
}

export async function completeR2Uploads(
  db: Database,
  input: {
    assetIds: unknown[];
    ownerUserId: string;
    actorLabel: string;
  },
): Promise<UploadedR2Identity[]> {
  const assetIds = normalizeAssetIds(input.assetIds);
  const configuration = getConfiguration();
  const client = createR2Client(configuration);
  const identities: UploadedR2Identity[] = [];

  for (const assetId of assetIds) {
    const [asset] = await db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.provider, PROVIDER), eq(mediaAssets.ownerUserId, input.ownerUserId)))
      .limit(1);
    if (!asset) throw new R2StorageError(422, "Aset unggah tidak ditemukan.");

    if (asset.lifecycle === "processing") {
      const providerKey = asset.providerKey?.trim();
      if (!providerKey) throw new R2StorageError(422, "Kunci objek R2 tidak ditemukan.");
      await assertObjectMatchesAsset(client, configuration, asset, providerKey);
    } else if (asset.lifecycle !== "ready") {
      throw new R2StorageError(422, "Status aset tidak dapat diselesaikan.");
    }

    identities.push(await markR2AssetReady(db, assetId, input));
  }

  return identities;
}

function getConfiguration(): R2Configuration {
  const values = {
    endpoint: env.R2_ENDPOINT,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    publicUrl: env.R2_PUBLIC_URL,
    region: env.R2_REGION,
  };
  if (!values.endpoint || !values.accessKeyId || !values.secretAccessKey || !values.bucket || !values.publicUrl) {
    throw new R2StorageError(503, "R2 belum dikonfigurasi.");
  }

  return {
    endpoint: values.endpoint.replace(/\/$/, ""),
    accessKeyId: values.accessKeyId,
    secretAccessKey: values.secretAccessKey,
    bucket: values.bucket,
    publicUrl: values.publicUrl.replace(/\/$/, ""),
    region: values.region,
  };
}

function createR2Client(configuration: R2Configuration) {
  return new S3Client({
    region: configuration.region,
    endpoint: configuration.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });
}

function parseKind(value: string): MediaUploadKind {
  if (value === "image" || value === "video" || value === "pdf") return value;
  throw new R2StorageError(422, "Jenis media tidak ditemukan.");
}

function normalizeFiles(files: unknown[], kind: MediaUploadKind): MediaFileMetadata[] {
  const policy = mediaPolicy[kind];
  if (files.length < 1 || files.length > policy.maxFileCount) {
    throw new R2StorageError(422, "Jumlah file tidak sesuai dengan batas unggah.");
  }

  return files.map((value, index) => {
    if (!value || typeof value !== "object") throw new R2StorageError(422, `Data file ke-${index + 1} tidak valid.`);
    const file = value as Record<string, unknown>;
    const name = typeof file.name === "string" ? file.name.trim().split(/[\\/]/).pop()?.trim() ?? "" : "";
    const type = typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
    const size = typeof file.size === "number" && Number.isInteger(file.size) ? file.size : Number.NaN;
    if (!name || name.length > 255 || !Number.isFinite(size) || size <= 0) {
      throw new R2StorageError(422, `Nama atau ukuran file ke-${index + 1} tidak valid.`);
    }
    if (!isAllowedMediaMimeType(kind, type)) {
      throw new R2StorageError(422, "Jenis file tidak sesuai dengan jalur unggah.");
    }
    if (size > policy.applicationMaxBytes) {
      throw new R2StorageError(422, `Ukuran ${kind} melebihi batas unggah.`);
    }

    return { name, type, size };
  });
}

function normalizeAssetIds(assetIds: unknown[]): string[] {
  if (assetIds.length < 1 || assetIds.length > 10) throw new R2StorageError(422, "Jumlah aset tidak sesuai dengan batas unggah.");
  for (const assetId of assetIds) {
    if (typeof assetId !== "string" || !isUuid(assetId)) throw new R2StorageError(422, "ID aset tidak valid.");
  }
  return [...new Set(assetIds as string[])];
}

async function resolveFolderId(db: Database, folderId: string | null) {
  if (folderId === null || folderId.trim() === "") return null;
  if (!isUuid(folderId)) throw new R2StorageError(422, "Folder media tidak ditemukan.");
  const [folder] = await db.select({ id: mediaFolders.id }).from(mediaFolders).where(eq(mediaFolders.id, folderId)).limit(1);
  if (!folder) throw new R2StorageError(422, "Folder media tidak ditemukan.");
  return folder.id;
}

async function assertObjectMatchesAsset(
  client: S3Client,
  configuration: R2Configuration,
  asset: typeof mediaAssets.$inferSelect,
  providerKey: string,
) {
  let head;
  try {
    head = await client.send(new HeadObjectCommand({ Bucket: configuration.bucket, Key: providerKey }));
  } catch (error) {
    throw new R2StorageError(422, "Objek R2 belum tersedia.", { cause: error });
  }
  const bytes = head.ContentLength ?? 0;
  const mimeType = (head.ContentType ?? "").toLowerCase();
  if (bytes !== asset.bytes || mimeType !== asset.mimeType.toLowerCase()) {
    throw new R2StorageError(422, "Metadata objek R2 tidak sesuai dengan file yang didaftarkan.");
  }
}

async function markR2AssetReady(
  db: Database,
  assetId: string,
  input: { ownerUserId: string; actorLabel: string },
): Promise<UploadedR2Identity> {
  return db.transaction(async (tx) => {
    const [asset] = await tx
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.provider, PROVIDER), eq(mediaAssets.ownerUserId, input.ownerUserId)))
      .limit(1);
    if (!asset) throw new R2StorageError(422, "Aset unggah tidak ditemukan.");

    if (asset.lifecycle !== "ready") {
      await tx.update(mediaAssets).set({ lifecycle: "ready", updatedAt: new Date() }).where(eq(mediaAssets.id, asset.id));
      await appendAuditLog(tx, {
        actorUserId: input.ownerUserId,
        actorLabel: input.actorLabel,
        action: "media.upload.complete",
        resourceType: "mediaAsset",
        resourceId: asset.id,
        resourceLabel: asset.filename,
        after: {
          provider: PROVIDER,
          providerKey: asset.providerKey,
          url: asset.url,
          bytes: asset.bytes,
          mimeType: asset.mimeType,
          lifecycle: "ready",
          folderId: asset.folderId,
        },
        changedFields: ["lifecycle"],
        source: "r2-upload",
      });
    }

    return identity(asset);
  });
}

function identity(asset: typeof mediaAssets.$inferSelect): UploadedR2Identity {
  const providerKey = asset.providerKey ?? "";
  return {
    mediaAssetId: asset.id,
    provider: PROVIDER,
    providerKey,
    key: providerKey,
    url: asset.url,
  };
}

function objectKey(assetId: string, filename: string) {
  const extension = (filename.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const stem = filename.slice(0, Math.max(0, filename.length - (extension ? extension.length + 1 : 0)));
  const safeStem = stem.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "file";
  const date = new Date();
  const suffix = extension ? `.${extension}` : "";
  return `media/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${assetId}-${safeStem}${suffix}`;
}

function mediaPublicUrl(baseUrl: string, key: string) {
  return `${baseUrl}/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
