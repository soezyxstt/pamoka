"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/server/auth/audit";
import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { database } from "@/server/db/client";
import { editionPrograms, editions, mediaAssets } from "@/server/db/schema";

export async function updateEditionSettingsAction(formData: FormData) {
  const actor = await requirePermission("content.edit");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const rawLogoMediaId = formData.get("logoMediaId")?.toString().trim();
  const logoMediaId = rawLogoMediaId && rawLogoMediaId.length > 0 ? rawLogoMediaId : null;
  const rawSlogan = formData.get("slogan")?.toString().trim();
  const slogan = rawSlogan && rawSlogan.length > 0 ? rawSlogan : null;
  const version = Number(formData.get("version") ?? 1);

  if (logoMediaId) {
    const [asset] = await database
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, logoMediaId))
      .limit(1);

    if (!asset || asset.lifecycle !== "ready" || !asset.mimeType.startsWith("image/")) {
      throw new Error("Logo harus berupa gambar yang valid dan siap digunakan");
    }
  }

  await database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(editions)
      .where(eq(editions.id, editionContext.id))
      .limit(1);

    if (!current) {
      throw new Error("Edisi tidak ditemukan");
    }

    if (current.version !== version) {
      throw new Error("Versi data telah diperbarui oleh pengguna lain. Silakan muat ulang halaman.");
    }

    const nextVersion = current.version + 1;
    await tx
      .update(editions)
      .set({
        logoMediaId,
        slogan,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(editions.id, editionContext.id));

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "edition.settings.update",
      resourceType: "edition",
      resourceId: editionContext.id,
      resourceLabel: editionContext.name,
      before: {
        logoMediaId: current.logoMediaId,
        slogan: current.slogan,
        version: current.version,
      },
      after: {
        logoMediaId,
        slogan,
        version: nextVersion,
      },
      changedFields: ["logoMediaId", "slogan", "version"],
      source: "admin-content",
    });
  });

  revalidatePath("/admin/content/edition-settings");
  revalidatePath("/admin");
}

export async function saveEditionProgramAction(formData: FormData) {
  const actor = await requirePermission("content.edit");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const id = formData.get("id")?.toString().trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const rawDesc = formData.get("description")?.toString().trim();
  const description = rawDesc && rawDesc.length > 0 ? rawDesc : null;
  const displayOrder = Number(formData.get("displayOrder") ?? 0);
  const active = formData.get("active") === "true" || formData.get("active") === "on";

  if (!title) {
    throw new Error("Judul program wajib diisi");
  }

  await database.transaction(async (tx) => {
    if (id) {
      const [current] = await tx
        .select()
        .from(editionPrograms)
        .where(and(eq(editionPrograms.id, id), eq(editionPrograms.editionId, editionContext.id)))
        .limit(1);

      if (!current) {
        throw new Error("Program tidak ditemukan pada edisi ini");
      }

      await tx
        .update(editionPrograms)
        .set({
          title,
          description,
          displayOrder,
          active,
          updatedAt: new Date(),
        })
        .where(eq(editionPrograms.id, id));

      await appendAuditLog(tx, {
        actorUserId: actor.session.user.id,
        actorLabel: actor.session.user.email,
        action: "edition.program.update",
        resourceType: "editionProgram",
        resourceId: id,
        resourceLabel: title,
        before: current,
        after: { id, editionId: editionContext.id, title, description, displayOrder, active },
        changedFields: ["title", "description", "displayOrder", "active"],
        source: "admin-content",
      });
    } else {
      const newId = crypto.randomUUID();
      await tx.insert(editionPrograms).values({
        id: newId,
        editionId: editionContext.id,
        title,
        description,
        displayOrder,
        active,
      });

      await appendAuditLog(tx, {
        actorUserId: actor.session.user.id,
        actorLabel: actor.session.user.email,
        action: "edition.program.create",
        resourceType: "editionProgram",
        resourceId: newId,
        resourceLabel: title,
        after: { id: newId, editionId: editionContext.id, title, description, displayOrder, active },
        changedFields: ["editionId", "title", "description", "displayOrder", "active"],
        source: "admin-content",
      });
    }
  });

  revalidatePath("/admin/content/edition-settings");
}

export async function deleteEditionProgramAction(formData: FormData) {
  const actor = await requirePermission("content.edit");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("ID program wajib disertakan");
  }

  await database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(editionPrograms)
      .where(and(eq(editionPrograms.id, id), eq(editionPrograms.editionId, editionContext.id)))
      .limit(1);

    if (!current) {
      throw new Error("Program tidak ditemukan pada edisi ini");
    }

    await tx.delete(editionPrograms).where(eq(editionPrograms.id, id));

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "edition.program.delete",
      resourceType: "editionProgram",
      resourceId: id,
      resourceLabel: current.title,
      before: current,
      changedFields: ["id"],
      source: "admin-content",
    });
  });

  revalidatePath("/admin/content/edition-settings");
}

export async function reorderEditionProgramsAction(programIds: string[]) {
  const actor = await requirePermission("content.edit");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  if (!programIds.length) return;

  await database.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(editionPrograms)
      .where(
        and(
          eq(editionPrograms.editionId, editionContext.id),
          inArray(editionPrograms.id, programIds)
        )
      );

    const existingMap = new Map(existing.map((p) => [p.id, p]));

    for (let index = 0; index < programIds.length; index++) {
      const progId = programIds[index];
      if (existingMap.has(progId)) {
        await tx
          .update(editionPrograms)
          .set({ displayOrder: index, updatedAt: new Date() })
          .where(eq(editionPrograms.id, progId));
      }
    }

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "edition.program.reorder",
      resourceType: "editionProgram",
      resourceId: editionContext.id,
      resourceLabel: `Urutan program edisi ${editionContext.name}`,
      after: { programIds },
      changedFields: ["displayOrder"],
      source: "admin-content",
    });
  });

  revalidatePath("/admin/content/edition-settings");
}
