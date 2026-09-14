import { and, eq } from "drizzle-orm";

import { appendAuditLog } from "@/server/auth/audit";
import type { Database } from "@/server/db/queries";
import { mediaAssets } from "@/server/db/schema";

export type PersistUploadedMediaAssetInput = {
  provider: "r2";
  providerKey: string;
  url: string;
  filename: string;
  mimeType: string;
  bytes: number;
  folderId: string | null;
  ownerUserId: string;
  actorLabel: string;
  kind: "image" | "video" | "pdf";
};

export type PersistedMediaAssetIdentity = {
  mediaAssetId: string;
  provider: string;
  providerKey: string;
  key: string;
  url: string;
};

export async function persistUploadedMediaAsset(
  db: Database,
  input: PersistUploadedMediaAssetInput,
): Promise<PersistedMediaAssetIdentity> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: mediaAssets.id, provider: mediaAssets.provider, providerKey: mediaAssets.providerKey, url: mediaAssets.url })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.provider, input.provider), eq(mediaAssets.providerKey, input.providerKey)))
      .limit(1);
    if (existing) {
      return {
        mediaAssetId: existing.id,
        provider: existing.provider,
        providerKey: existing.providerKey ?? input.providerKey,
        key: existing.providerKey ?? input.providerKey,
        url: existing.url,
      };
    }

    const mediaAssetId = crypto.randomUUID();
    await tx.insert(mediaAssets).values({
      id: mediaAssetId,
      provider: input.provider,
      providerKey: input.providerKey,
      url: input.url,
      filename: input.filename,
      mimeType: input.mimeType,
      bytes: input.bytes,
      lifecycle: "ready",
      folderId: input.folderId,
      ownerUserId: input.ownerUserId,
    });
    await appendAuditLog(tx, {
      actorUserId: input.ownerUserId,
      actorLabel: input.actorLabel,
      action: "media.upload.complete",
      resourceType: "mediaAsset",
      resourceId: mediaAssetId,
      resourceLabel: input.filename,
      after: {
        kind: input.kind,
        provider: input.provider,
        providerKey: input.providerKey,
        url: input.url,
        bytes: input.bytes,
        mimeType: input.mimeType,
        lifecycle: "ready",
        folderId: input.folderId,
      },
      changedFields: ["provider", "providerKey", "url", "lifecycle", "folderId"],
      source: "r2-upload",
    });
    return {
      mediaAssetId,
      provider: input.provider,
      providerKey: input.providerKey,
      key: input.providerKey,
      url: input.url,
    };
  });
}
