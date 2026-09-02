"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/server/auth/audit";
import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { getSlotDefinition, isValidSlotKey } from "@/server/cms/site-asset-manifest";
import { database } from "@/server/db/client";
import { mediaAssets, siteAssetBindings } from "@/server/db/schema";

export async function bindSiteAssetAction(formData: FormData) {
  const actor = await requirePermission("content.edit");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const slotKey = String(formData.get("slotKey") ?? "").trim();
  if (!isValidSlotKey(slotKey)) {
    throw new Error("Slot aset situs tidak valid atau tidak terdaftar dalam manifest");
  }

  const slotDef = getSlotDefinition(slotKey);
  if (!slotDef) {
    throw new Error("Definisi slot tidak ditemukan");
  }

  const rawMediaId = formData.get("mediaId")?.toString().trim();
  const mediaId = rawMediaId && rawMediaId.length > 0 ? rawMediaId : null;

  const rawAltOverride = formData.get("altOverride")?.toString().trim();
  const altOverride = rawAltOverride && rawAltOverride.length > 0 ? rawAltOverride : null;

  const rawFocalX = formData.get("focalX");
  const focalX = rawFocalX !== null && rawFocalX !== "" && !Number.isNaN(Number(rawFocalX))
    ? Math.max(0, Math.min(100, Number(rawFocalX)))
    : null;

  const rawFocalY = formData.get("focalY");
  const focalY = rawFocalY !== null && rawFocalY !== "" && !Number.isNaN(Number(rawFocalY))
    ? Math.max(0, Math.min(100, Number(rawFocalY)))
    : null;

  if (mediaId) {
    const [asset] = await database
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, mediaId))
      .limit(1);

    if (!asset || asset.lifecycle !== "ready") {
      throw new Error("Media tidak ditemukan atau belum siap digunakan");
    }

    if (slotDef.acceptType === "image" && !asset.mimeType.startsWith("image/")) {
      throw new Error("Slot ini hanya menerima file gambar");
    }

    if (slotDef.acceptType === "video" && !asset.mimeType.startsWith("video/")) {
      throw new Error("Slot ini hanya menerima file video");
    }
  }

  await database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(siteAssetBindings)
      .where(
        and(
          eq(siteAssetBindings.editionId, editionContext.id),
          eq(siteAssetBindings.slotKey, slotKey)
        )
      )
      .limit(1);

    if (existing) {
      const nextVersion = existing.version + 1;
      await tx
        .update(siteAssetBindings)
        .set({
          mediaId,
          altOverride,
          focalX,
          focalY,
          version: nextVersion,
          updatedAt: new Date(),
        })
        .where(eq(siteAssetBindings.id, existing.id));

      await appendAuditLog(tx, {
        actorUserId: actor.session.user.id,
        actorLabel: actor.session.user.email,
        action: "site_asset.bind",
        resourceType: "siteAssetBinding",
        resourceId: existing.id,
        resourceLabel: `${editionContext.name} - ${slotDef.label} (${slotKey})`,
        before: existing,
        after: {
          id: existing.id,
          editionId: editionContext.id,
          slotKey,
          mediaId,
          altOverride,
          focalX,
          focalY,
          version: nextVersion,
        },
        changedFields: ["mediaId", "altOverride", "focalX", "focalY", "version"],
        source: "admin-content",
      });
    } else {
      const newId = crypto.randomUUID();
      await tx.insert(siteAssetBindings).values({
        id: newId,
        editionId: editionContext.id,
        slotKey,
        mediaId,
        altOverride,
        focalX,
        focalY,
        version: 1,
      });

      await appendAuditLog(tx, {
        actorUserId: actor.session.user.id,
        actorLabel: actor.session.user.email,
        action: "site_asset.bind",
        resourceType: "siteAssetBinding",
        resourceId: newId,
        resourceLabel: `${editionContext.name} - ${slotDef.label} (${slotKey})`,
        after: {
          id: newId,
          editionId: editionContext.id,
          slotKey,
          mediaId,
          altOverride,
          focalX,
          focalY,
          version: 1,
        },
        changedFields: ["editionId", "slotKey", "mediaId", "altOverride", "focalX", "focalY"],
        source: "admin-content",
      });
    }
  });

  revalidatePath("/admin/content/site-assets");
}

export async function unbindSiteAssetAction(formData: FormData) {
  const actor = await requirePermission("content.edit");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const slotKey = String(formData.get("slotKey") ?? "").trim();
  if (!isValidSlotKey(slotKey)) {
    throw new Error("Slot aset situs tidak valid atau tidak terdaftar dalam manifest");
  }

  const slotDef = getSlotDefinition(slotKey);
  const slotLabel = slotDef ? slotDef.label : slotKey;

  await database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(siteAssetBindings)
      .where(
        and(
          eq(siteAssetBindings.editionId, editionContext.id),
          eq(siteAssetBindings.slotKey, slotKey)
        )
      )
      .limit(1);

    if (existing && existing.mediaId) {
      const nextVersion = existing.version + 1;
      await tx
        .update(siteAssetBindings)
        .set({
          mediaId: null,
          altOverride: null,
          focalX: null,
          focalY: null,
          version: nextVersion,
          updatedAt: new Date(),
        })
        .where(eq(siteAssetBindings.id, existing.id));

      await appendAuditLog(tx, {
        actorUserId: actor.session.user.id,
        actorLabel: actor.session.user.email,
        action: "site_asset.unbind",
        resourceType: "siteAssetBinding",
        resourceId: existing.id,
        resourceLabel: `${editionContext.name} - ${slotLabel} (${slotKey})`,
        before: existing,
        after: {
          ...existing,
          mediaId: null,
          altOverride: null,
          focalX: null,
          focalY: null,
          version: nextVersion,
        },
        changedFields: ["mediaId", "altOverride", "focalX", "focalY", "version"],
        source: "admin-content",
      });
    }
  });

  revalidatePath("/admin/content/site-assets");
}
