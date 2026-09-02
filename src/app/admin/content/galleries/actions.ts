"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/server/auth/audit";
import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { database } from "@/server/db/client";
import { events, galleries, galleryItems, mediaAssets } from "@/server/db/schema";

export async function createGalleryAction(input: {
  title: string;
  slug: string;
  description?: string | null;
  coverMediaId?: string | null;
  ownerType: "standalone" | "event";
  ownerId?: string | null;
  displayOrder?: number;
  status?: "draft" | "published";
}) {
  const actor = await requirePermission("gallery.manage");
  const edition = await getAdminEditionContext();
  if (!edition) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const title = input.title.trim();
  const slug = input.slug.trim().toLowerCase();
  if (title.length < 2) {
    throw new Error("Judul galeri minimal 2 karakter");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Format slug tidak valid");
  }

  let finalOwnerId = input.ownerId?.trim() || "";
  if (input.ownerType === "event") {
    if (!finalOwnerId) {
      throw new Error("Acara wajib dipilih untuk album galeri bertipe acara");
    }
    const [targetEvent] = await database
      .select()
      .from(events)
      .where(and(eq(events.id, finalOwnerId), eq(events.editionId, edition.id)));
    if (!targetEvent) {
      throw new Error("Acara yang dipilih tidak ditemukan pada edisi ini");
    }
  } else {
    finalOwnerId = edition.id;
  }

  const existingSlug = await database
    .select()
    .from(galleries)
    .where(and(eq(galleries.editionId, edition.id), eq(galleries.slug, slug)));
  if (existingSlug.length > 0) {
    throw new Error("Slug galeri sudah digunakan pada edisi ini");
  }

  const galleryId = crypto.randomUUID();
  const now = new Date();

  await database.transaction(async (tx) => {
    await tx.insert(galleries).values({
      id: galleryId,
      editionId: edition.id,
      title,
      slug,
      description: input.description?.trim() || null,
      coverMediaId: input.coverMediaId || null,
      ownerType: input.ownerType,
      ownerId: finalOwnerId,
      displayOrder: input.displayOrder ?? 0,
      status: input.status ?? "published",
      active: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "gallery.create",
      resourceType: "gallery",
      resourceId: galleryId,
      resourceLabel: title,
      after: {
        title,
        slug,
        ownerType: input.ownerType,
        ownerId: finalOwnerId,
        editionId: edition.id,
      },
      changedFields: ["title", "slug", "ownerType", "ownerId", "editionId"],
      source: "admin-galleries",
    });
  });

  revalidatePath("/admin/content/galleries");
  return { success: true, galleryId };
}

export async function updateGalleryAction(input: {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  coverMediaId?: string | null;
  ownerType: "standalone" | "event";
  ownerId?: string | null;
  displayOrder?: number;
  status?: "draft" | "published";
  active?: boolean;
  version: number;
}) {
  const actor = await requirePermission("gallery.manage");
  const edition = await getAdminEditionContext();
  if (!edition) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const [existing] = await database
    .select()
    .from(galleries)
    .where(and(eq(galleries.id, input.id), eq(galleries.editionId, edition.id)));
  if (!existing) {
    throw new Error("Galeri tidak ditemukan");
  }
  if (existing.version !== input.version) {
    throw new Error("Data galeri telah diperbarui oleh pengguna lain. Silakan muat ulang.");
  }

  const title = input.title.trim();
  const slug = input.slug.trim().toLowerCase();
  if (title.length < 2) {
    throw new Error("Judul galeri minimal 2 karakter");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Format slug tidak valid");
  }

  let finalOwnerId = input.ownerId?.trim() || "";
  if (input.ownerType === "event") {
    if (!finalOwnerId) {
      throw new Error("Acara wajib dipilih untuk album galeri bertipe acara");
    }
    const [targetEvent] = await database
      .select()
      .from(events)
      .where(and(eq(events.id, finalOwnerId), eq(events.editionId, edition.id)));
    if (!targetEvent) {
      throw new Error("Acara yang dipilih tidak ditemukan pada edisi ini");
    }
  } else {
    finalOwnerId = edition.id;
  }

  const existingSlug = await database
    .select()
    .from(galleries)
    .where(and(eq(galleries.editionId, edition.id), eq(galleries.slug, slug)));
  if (existingSlug.length > 0 && existingSlug[0].id !== input.id) {
    throw new Error("Slug galeri sudah digunakan oleh album lain pada edisi ini");
  }

  const now = new Date();

  await database.transaction(async (tx) => {
    await tx
      .update(galleries)
      .set({
        title,
        slug,
        description: input.description !== undefined ? input.description?.trim() || null : existing.description,
        coverMediaId: input.coverMediaId !== undefined ? input.coverMediaId : existing.coverMediaId,
        ownerType: input.ownerType,
        ownerId: finalOwnerId,
        displayOrder: input.displayOrder ?? existing.displayOrder,
        status: input.status ?? existing.status,
        active: input.active ?? existing.active,
        version: existing.version + 1,
        updatedAt: now,
      })
      .where(eq(galleries.id, input.id));

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "gallery.update",
      resourceType: "gallery",
      resourceId: input.id,
      resourceLabel: title,
      before: existing,
      after: {
        title,
        slug,
        description: input.description,
        coverMediaId: input.coverMediaId,
        ownerType: input.ownerType,
        ownerId: finalOwnerId,
      },
      changedFields: ["title", "slug", "description", "coverMediaId", "ownerType", "ownerId", "version"],
      source: "admin-galleries",
    });
  });

  revalidatePath("/admin/content/galleries");
  revalidatePath(`/admin/content/galleries/${input.id}`);
  return { success: true };
}

export async function deleteGalleryAction(input: { id: string }) {
  const actor = await requirePermission("gallery.manage");
  const edition = await getAdminEditionContext();
  if (!edition) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const [existing] = await database
    .select()
    .from(galleries)
    .where(and(eq(galleries.id, input.id), eq(galleries.editionId, edition.id)));
  if (!existing) {
    throw new Error("Galeri tidak ditemukan");
  }

  await database.transaction(async (tx) => {
    await tx.delete(galleries).where(eq(galleries.id, input.id));
    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "gallery.delete",
      resourceType: "gallery",
      resourceId: input.id,
      resourceLabel: existing.title,
      before: existing,
      changedFields: ["deleted"],
      source: "admin-galleries",
    });
  });

  revalidatePath("/admin/content/galleries");
  return { success: true };
}

export async function addGalleryItemsAction(input: {
  galleryId: string;
  mediaIds?: string[];
  youtubeId?: string | null;
  caption?: string | null;
}) {
  const actor = await requirePermission("gallery.manage");
  const [gallery] = await database
    .select()
    .from(galleries)
    .where(eq(galleries.id, input.galleryId));
  if (!gallery) {
    throw new Error("Galeri tidak ditemukan");
  }

  const now = new Date();

  // Ambil item terakhir untuk displayOrder
  const existingItems = await database
    .select()
    .from(galleryItems)
    .where(eq(galleryItems.galleryId, input.galleryId))
    .orderBy(asc(galleryItems.displayOrder));

  let startOrder = existingItems.length > 0 ? existingItems[existingItems.length - 1].displayOrder + 1 : 1;

  await database.transaction(async (tx) => {
    // 1. YouTube video insertion (single)
    if (input.youtubeId && input.youtubeId.trim()) {
      const cleanYoutubeId = input.youtubeId.trim();
      const itemId = crypto.randomUUID();
      await tx.insert(galleryItems).values({
        id: itemId,
        galleryId: input.galleryId,
        mediaId: null,
        youtubeId: cleanYoutubeId,
        caption: input.caption?.trim() || null,
        displayOrder: startOrder++,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 2. Batch Media assets insertion
    if (input.mediaIds && input.mediaIds.length > 0) {
      for (const mediaId of input.mediaIds) {
        if (!mediaId) continue;
        const itemId = crypto.randomUUID();
        await tx.insert(galleryItems).values({
          id: itemId,
          galleryId: input.galleryId,
          mediaId,
          youtubeId: null,
          caption: input.caption?.trim() || null,
          displayOrder: startOrder++,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "gallery.items.add",
      resourceType: "gallery",
      resourceId: input.galleryId,
      resourceLabel: gallery.title,
      after: {
        mediaCount: input.mediaIds?.length ?? 0,
        youtubeId: input.youtubeId,
      },
      changedFields: ["items"],
      source: "admin-galleries",
    });
  });

  revalidatePath(`/admin/content/galleries/${input.galleryId}`);
  return { success: true };
}

export async function updateGalleryItemAction(input: {
  itemId: string;
  caption?: string | null;
  active?: boolean;
}) {
  await requirePermission("gallery.manage");
  const [item] = await database
    .select()
    .from(galleryItems)
    .where(eq(galleryItems.id, input.itemId));
  if (!item) {
    throw new Error("Item galeri tidak ditemukan");
  }

  const now = new Date();
  await database
    .update(galleryItems)
    .set({
      caption: input.caption !== undefined ? input.caption?.trim() || null : item.caption,
      active: input.active !== undefined ? input.active : item.active,
      updatedAt: now,
    })
    .where(eq(galleryItems.id, input.itemId));

  revalidatePath(`/admin/content/galleries/${item.galleryId}`);
  return { success: true };
}

export async function deleteGalleryItemAction(input: { itemId: string }) {
  const actor = await requirePermission("gallery.manage");
  const [item] = await database
    .select()
    .from(galleryItems)
    .where(eq(galleryItems.id, input.itemId));
  if (!item) {
    throw new Error("Item galeri tidak ditemukan");
  }

  await database.transaction(async (tx) => {
    await tx.delete(galleryItems).where(eq(galleryItems.id, input.itemId));
    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "gallery.item.delete",
      resourceType: "gallery",
      resourceId: item.galleryId,
      before: item,
      changedFields: ["items"],
      source: "admin-galleries",
    });
  });

  revalidatePath(`/admin/content/galleries/${item.galleryId}`);
  return { success: true };
}

export async function reorderGalleryItemsAction(input: {
  galleryId: string;
  itemIds: string[];
}) {
  await requirePermission("gallery.manage");
  const now = new Date();

  await database.transaction(async (tx) => {
    for (let i = 0; i < input.itemIds.length; i++) {
      await tx
        .update(galleryItems)
        .set({ displayOrder: i + 1, updatedAt: now })
        .where(
          and(
            eq(galleryItems.id, input.itemIds[i]),
            eq(galleryItems.galleryId, input.galleryId),
          ),
        );
    }
  });

  revalidatePath(`/admin/content/galleries/${input.galleryId}`);
  return { success: true };
}
