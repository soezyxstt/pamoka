"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/server/auth/audit";
import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { database } from "@/server/db/client";
import { events } from "@/server/db/schema";

export async function createEventAction(input: {
  label: string;
  slug: string;
  description?: string | null;
  heroMediaId?: string | null;
  displayOrder?: number;
  active?: boolean;
}) {
  const actor = await requirePermission("events.manage");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const editionId = editionContext.id;
  const label = input.label.trim();
  const slug = input.slug.trim().toLowerCase();

  if (label.length < 2) {
    throw new Error("Nama acara minimal 2 karakter");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Format slug tidak valid");
  }

  const existingSlug = await database
    .select()
    .from(events)
    .where(and(eq(events.editionId, editionId), eq(events.slug, slug)));
  if (existingSlug.length > 0) {
    throw new Error("Slug acara sudah digunakan pada edisi ini");
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await database.transaction(async (tx) => {
    await tx.insert(events).values({
      id,
      editionId,
      label,
      slug,
      description: input.description?.trim() || null,
      heroMediaId: input.heroMediaId || null,
      displayOrder: input.displayOrder ?? 0,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    });

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "event.create",
      resourceType: "event",
      resourceId: id,
      resourceLabel: label,
      after: { editionId, label, slug, heroMediaId: input.heroMediaId },
      changedFields: ["editionId", "label", "slug", "description", "heroMediaId"],
      source: "admin-events",
    });
  });

  revalidatePath("/admin/content/events");
  return { success: true, eventId: id };
}

export async function updateEventAction(input: {
  id: string;
  label: string;
  slug: string;
  description?: string | null;
  heroMediaId?: string | null;
  displayOrder?: number;
  active?: boolean;
}) {
  const actor = await requirePermission("events.manage");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const [existing] = await database
    .select()
    .from(events)
    .where(and(eq(events.id, input.id), eq(events.editionId, editionContext.id)));
  if (!existing) {
    throw new Error("Acara tidak ditemukan");
  }

  const label = input.label.trim();
  const slug = input.slug.trim().toLowerCase();
  if (label.length < 2) {
    throw new Error("Nama acara minimal 2 karakter");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Format slug tidak valid");
  }

  const existingSlug = await database
    .select()
    .from(events)
    .where(and(eq(events.editionId, editionContext.id), eq(events.slug, slug)));
  if (existingSlug.length > 0 && existingSlug[0].id !== input.id) {
    throw new Error("Slug acara sudah digunakan oleh acara lain pada edisi ini");
  }

  const now = new Date();

  await database.transaction(async (tx) => {
    await tx
      .update(events)
      .set({
        label,
        slug,
        description: input.description !== undefined ? input.description?.trim() || null : existing.description,
        heroMediaId: input.heroMediaId !== undefined ? input.heroMediaId : existing.heroMediaId,
        displayOrder: input.displayOrder ?? existing.displayOrder,
        active: input.active ?? existing.active,
        updatedAt: now,
      })
      .where(eq(events.id, input.id));

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "event.update",
      resourceType: "event",
      resourceId: input.id,
      resourceLabel: label,
      before: existing,
      after: { label, slug, description: input.description, heroMediaId: input.heroMediaId },
      changedFields: ["label", "slug", "description", "heroMediaId", "displayOrder", "active"],
      source: "admin-events",
    });
  });

  revalidatePath("/admin/content/events");
  return { success: true };
}

export async function deleteEventAction(input: { id: string }) {
  const actor = await requirePermission("events.manage");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const [existing] = await database
    .select()
    .from(events)
    .where(and(eq(events.id, input.id), eq(events.editionId, editionContext.id)));
  if (!existing) {
    throw new Error("Acara tidak ditemukan");
  }

  await database.transaction(async (tx) => {
    await tx.delete(events).where(eq(events.id, input.id));
    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "event.delete",
      resourceType: "event",
      resourceId: input.id,
      resourceLabel: existing.label,
      before: existing,
      changedFields: ["deleted"],
      source: "admin-events",
    });
  });

  revalidatePath("/admin/content/events");
  return { success: true };
}

export async function reorderEventsAction(input: { eventIds: string[] }) {
  await requirePermission("events.manage");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const now = new Date();
  await database.transaction(async (tx) => {
    for (let i = 0; i < input.eventIds.length; i++) {
      await tx
        .update(events)
        .set({ displayOrder: i + 1, updatedAt: now })
        .where(and(eq(events.id, input.eventIds[i]), eq(events.editionId, editionContext.id)));
    }
  });

  revalidatePath("/admin/content/events");
  return { success: true };
}
