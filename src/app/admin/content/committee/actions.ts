"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/server/auth/audit";
import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { database } from "@/server/db/client";
import {
  committeeAssignments,
  committeeUnits,
  mediaAssets,
  people,
  type CommitteeUnitRow,
} from "@/server/db/schema";

function slugify(text: string): string {
  const cleaned = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "profil";
}

// ---------------------------------------------------------------------------
// Unit Tree Helper / Validation
// ---------------------------------------------------------------------------

function checkCommitteeTreeCycleAndDepth(
  units: CommitteeUnitRow[],
  targetUnitId: string | null,
  newParentId: string | null
) {
  if (!newParentId) return; // Root unit (depth 1) is always valid

  if (targetUnitId && newParentId === targetUnitId) {
    throw new Error("Unit tidak dapat menjadi induk bagi dirinya sendiri");
  }

  const unitMap = new Map<string, CommitteeUnitRow>();
  const childrenMap = new Map<string, string[]>();

  for (const u of units) {
    unitMap.set(u.id, u);
    if (u.parentId) {
      const list = childrenMap.get(u.parentId) ?? [];
      list.push(u.id);
      childrenMap.set(u.parentId, list);
    }
  }

  const parent = unitMap.get(newParentId);
  if (!parent) {
    throw new Error("Unit induk tidak ditemukan");
  }

  // Check cycle by walking up ancestors of newParentId
  let ancestorWalk: CommitteeUnitRow | undefined = parent;
  let parentDepth = 1;
  const visited = new Set<string>([parent.id]);

  while (ancestorWalk?.parentId) {
    if (targetUnitId && ancestorWalk.parentId === targetUnitId) {
      throw new Error("Terdeteksi hubungan melingkar: unit turunan tidak bisa menjadi induk");
    }
    if (visited.has(ancestorWalk.parentId)) {
      throw new Error("Terdeteksi struktur melingkar pada hierarki unit");
    }
    visited.add(ancestorWalk.parentId);
    parentDepth++;
    ancestorWalk = unitMap.get(ancestorWalk.parentId);
  }

  // Calculate max subtree height if updating existing unit
  let subtreeHeight = 0;
  if (targetUnitId) {
    function getSubtreeHeight(id: string): number {
      const children = childrenMap.get(id) ?? [];
      if (children.length === 0) return 0;
      let maxH = 0;
      for (const chId of children) {
        const h = 1 + getSubtreeHeight(chId);
        if (h > maxH) maxH = h;
      }
      return maxH;
    }
    subtreeHeight = getSubtreeHeight(targetUnitId);
  }

  const totalDepth = parentDepth + 1 + subtreeHeight;
  if (totalDepth > 4) {
    throw new Error(`Struktur panitia maksimal 4 tingkat kedalaman (tingkat saat ini: ${totalDepth})`);
  }
}

// ---------------------------------------------------------------------------
// 1. MANAJEMEN UNIT PANITIA (MAX 4 LEVEL, CYCLE PREVENTION)
// ---------------------------------------------------------------------------

export async function createCommitteeUnitAction(formData: FormData) {
  const actor = await requirePermission("content.edit");
  const edition = await getAdminEditionContext();
  if (!edition) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const parentIdRaw = formData.get("parentId")?.toString().trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const displayOrderRaw = formData.get("displayOrder");
  const activeRaw = formData.get("active");

  if (!name) {
    throw new Error("Nama unit panitia wajib diisi");
  }

  const displayOrder = Number.isInteger(Number(displayOrderRaw))
    ? Math.max(0, Number(displayOrderRaw))
    : 0;
  const active = activeRaw === "false" || activeRaw === "0" ? false : true;

  const id = crypto.randomUUID();
  const now = new Date();

  await database.transaction(async (tx) => {
    const existingUnits = await tx
      .select()
      .from(committeeUnits)
      .where(eq(committeeUnits.editionId, edition.id));

    if (parentIdRaw) {
      const parentUnit = existingUnits.find((u) => u.id === parentIdRaw);
      if (!parentUnit) {
        throw new Error("Unit induk tidak ditemukan pada edisi ini");
      }
      checkCommitteeTreeCycleAndDepth(existingUnits, null, parentIdRaw);
    }

    await tx.insert(committeeUnits).values({
      id,
      editionId: edition.id,
      parentId: parentIdRaw,
      name,
      displayOrder,
      active,
      createdAt: now,
      updatedAt: now,
    });

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "committee.unit.create",
      resourceType: "committee_unit",
      resourceId: id,
      resourceLabel: `${edition.name} - ${name}`,
      after: {
        id,
        editionId: edition.id,
        parentId: parentIdRaw,
        name,
        displayOrder,
        active,
      },
      changedFields: ["editionId", "parentId", "name", "displayOrder", "active"],
      source: "admin-committee",
    });
  });

  revalidatePath("/admin/content/committee");
  revalidatePath("/admin");
  return { success: true, id };
}

export async function updateCommitteeUnitAction(formData: FormData) {
  const actor = await requirePermission("content.edit");
  const edition = await getAdminEditionContext();
  if (!edition) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const parentIdRaw = formData.get("parentId")?.toString().trim() || null;
  const displayOrderRaw = formData.get("displayOrder");
  const activeRaw = formData.get("active");

  if (!id) {
    throw new Error("ID unit panitia wajib disertakan");
  }

  if (!name) {
    throw new Error("Nama unit panitia wajib diisi");
  }

  const displayOrder = Number.isInteger(Number(displayOrderRaw))
    ? Math.max(0, Number(displayOrderRaw))
    : 0;
  const active = activeRaw === "false" || activeRaw === "0" ? false : true;

  await database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(committeeUnits)
      .where(and(eq(committeeUnits.id, id), eq(committeeUnits.editionId, edition.id)))
      .limit(1);

    if (!current) {
      throw new Error("Unit panitia tidak ditemukan pada edisi terpilih");
    }

    const existingUnits = await tx
      .select()
      .from(committeeUnits)
      .where(eq(committeeUnits.editionId, edition.id));

    if (parentIdRaw) {
      const parentUnit = existingUnits.find((u) => u.id === parentIdRaw);
      if (!parentUnit) {
        throw new Error("Unit induk tidak ditemukan pada edisi ini");
      }
      checkCommitteeTreeCycleAndDepth(existingUnits, id, parentIdRaw);
    }

    await tx
      .update(committeeUnits)
      .set({
        name,
        parentId: parentIdRaw,
        displayOrder,
        active,
        updatedAt: new Date(),
      })
      .where(eq(committeeUnits.id, id));

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "committee.unit.update",
      resourceType: "committee_unit",
      resourceId: id,
      resourceLabel: `${edition.name} - ${name}`,
      before: {
        name: current.name,
        parentId: current.parentId,
        displayOrder: current.displayOrder,
        active: current.active,
      },
      after: {
        name,
        parentId: parentIdRaw,
        displayOrder,
        active,
      },
      changedFields: ["name", "parentId", "displayOrder", "active"],
      source: "admin-committee",
    });
  });

  revalidatePath("/admin/content/committee");
  return { success: true };
}

export async function deleteCommitteeUnitAction(formData: FormData) {
  const actor = await requirePermission("content.edit");
  const edition = await getAdminEditionContext();
  if (!edition) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("ID unit panitia wajib disertakan");
  }

  await database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(committeeUnits)
      .where(and(eq(committeeUnits.id, id), eq(committeeUnits.editionId, edition.id)))
      .limit(1);

    if (!current) {
      throw new Error("Unit panitia tidak ditemukan pada edisi terpilih");
    }

    await tx.delete(committeeUnits).where(eq(committeeUnits.id, id));

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "committee.unit.delete",
      resourceType: "committee_unit",
      resourceId: id,
      resourceLabel: `${edition.name} - ${current.name}`,
      before: current,
      changedFields: ["id"],
      source: "admin-committee",
    });
  });

  revalidatePath("/admin/content/committee");
  revalidatePath("/admin");
  return { success: true };
}

export async function reorderCommitteeUnitsAction(items: { id: string; displayOrder: number }[]) {
  const actor = await requirePermission("content.edit");
  const edition = await getAdminEditionContext();
  if (!edition) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { success: true };
  }

  await database.transaction(async (tx) => {
    const ids = items.map((i) => i.id);
    const existing = await tx
      .select()
      .from(committeeUnits)
      .where(and(inArray(committeeUnits.id, ids), eq(committeeUnits.editionId, edition.id)));

    const existingMap = new Map(existing.map((u) => [u.id, u]));

    for (const item of items) {
      if (existingMap.has(item.id)) {
        await tx
          .update(committeeUnits)
          .set({
            displayOrder: item.displayOrder,
            updatedAt: new Date(),
          })
          .where(eq(committeeUnits.id, item.id));
      }
    }

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "committee.unit.reorder",
      resourceType: "committee_unit",
      resourceId: edition.id,
      resourceLabel: `Reorder unit panitia ${edition.name}`,
      after: { items },
      changedFields: ["displayOrder"],
      source: "admin-committee",
    });
  });

  revalidatePath("/admin/content/committee");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 2. PENUGASAN PANITIA (ASSIGNMENT)
// ---------------------------------------------------------------------------

export async function assignCommitteeMemberAction(formData: FormData) {
  const actor = await requirePermission("content.edit");
  const edition = await getAdminEditionContext();
  if (!edition) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const unitId = String(formData.get("unitId") ?? "").trim();
  const personId = String(formData.get("personId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const displayOrderRaw = formData.get("displayOrder");
  const activeRaw = formData.get("active");

  if (!unitId || !personId || !title) {
    throw new Error("Unit panitia, profil orang, dan jabatan wajib diisi");
  }

  const displayOrder = Number.isInteger(Number(displayOrderRaw))
    ? Math.max(0, Number(displayOrderRaw))
    : 0;
  const active = activeRaw === "false" || activeRaw === "0" ? false : true;

  const id = crypto.randomUUID();
  const now = new Date();

  await database.transaction(async (tx) => {
    // Validasi unit milik edisi yang sama
    const [unit] = await tx
      .select()
      .from(committeeUnits)
      .where(and(eq(committeeUnits.id, unitId), eq(committeeUnits.editionId, edition.id)))
      .limit(1);

    if (!unit) {
      throw new Error("Unit panitia tidak valid untuk edisi terpilih");
    }

    // Validasi orang ada di direktori orang
    const [person] = await tx
      .select()
      .from(people)
      .where(eq(people.id, personId))
      .limit(1);

    if (!person) {
      throw new Error("Profil orang tidak ditemukan");
    }

    await tx.insert(committeeAssignments).values({
      id,
      editionId: edition.id,
      unitId,
      personId,
      title,
      displayOrder,
      active,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "committee.assignment.create",
      resourceType: "committee_assignment",
      resourceId: id,
      resourceLabel: `${edition.name} - ${person.name} (${title})`,
      after: {
        id,
        editionId: edition.id,
        unitId,
        personId,
        title,
        displayOrder,
        active,
        version: 1,
      },
      changedFields: ["editionId", "unitId", "personId", "title", "displayOrder", "active"],
      source: "admin-committee",
    });
  });

  revalidatePath("/admin/content/committee");
  revalidatePath("/admin");
  return { success: true, id };
}

export async function updateCommitteeAssignmentAction(formData: FormData) {
  const actor = await requirePermission("content.edit");
  const edition = await getAdminEditionContext();
  if (!edition) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const id = String(formData.get("id") ?? "").trim();
  const unitId = String(formData.get("unitId") ?? "").trim();
  const personIdRaw = formData.get("personId")?.toString().trim();
  const title = String(formData.get("title") ?? "").trim();
  const displayOrderRaw = formData.get("displayOrder");
  const activeRaw = formData.get("active");
  const version = Number(formData.get("version") ?? 1);

  if (!id || !title) {
    throw new Error("ID penugasan dan jabatan wajib diisi");
  }

  const displayOrder = Number.isInteger(Number(displayOrderRaw))
    ? Math.max(0, Number(displayOrderRaw))
    : 0;
  const active = activeRaw === "false" || activeRaw === "0" ? false : true;

  await database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(committeeAssignments)
      .where(and(eq(committeeAssignments.id, id), eq(committeeAssignments.editionId, edition.id)))
      .limit(1);

    if (!current) {
      throw new Error("Penugasan panitia tidak ditemukan pada edisi terpilih");
    }

    if (current.version !== version) {
      throw new Error("Versi data telah diperbarui oleh pengguna lain. Silakan muat ulang halaman.");
    }

    const targetUnitId = unitId || current.unitId;
    const targetPersonId = personIdRaw || current.personId;

    // Validasi unit target milik edisi terpilih
    const [unit] = await tx
      .select()
      .from(committeeUnits)
      .where(and(eq(committeeUnits.id, targetUnitId), eq(committeeUnits.editionId, edition.id)))
      .limit(1);

    if (!unit) {
      throw new Error("Unit panitia tidak valid untuk edisi terpilih");
    }

    const [person] = await tx
      .select()
      .from(people)
      .where(eq(people.id, targetPersonId))
      .limit(1);

    if (!person) {
      throw new Error("Profil orang tidak ditemukan");
    }

    const nextVersion = current.version + 1;

    await tx
      .update(committeeAssignments)
      .set({
        unitId: targetUnitId,
        personId: targetPersonId,
        title,
        displayOrder,
        active,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(committeeAssignments.id, id));

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "committee.assignment.update",
      resourceType: "committee_assignment",
      resourceId: id,
      resourceLabel: `${edition.name} - ${person.name} (${title})`,
      before: {
        unitId: current.unitId,
        personId: current.personId,
        title: current.title,
        displayOrder: current.displayOrder,
        active: current.active,
        version: current.version,
      },
      after: {
        unitId: targetUnitId,
        personId: targetPersonId,
        title,
        displayOrder,
        active,
        version: nextVersion,
      },
      changedFields: ["unitId", "personId", "title", "displayOrder", "active", "version"],
      source: "admin-committee",
    });
  });

  revalidatePath("/admin/content/committee");
  return { success: true };
}

export async function removeCommitteeAssignmentAction(formData: FormData) {
  const actor = await requirePermission("content.edit");
  const edition = await getAdminEditionContext();
  if (!edition) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("ID penugasan panitia wajib disertakan");
  }

  await database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(committeeAssignments)
      .where(and(eq(committeeAssignments.id, id), eq(committeeAssignments.editionId, edition.id)))
      .limit(1);

    if (!current) {
      throw new Error("Penugasan panitia tidak ditemukan pada edisi terpilih");
    }

    await tx.delete(committeeAssignments).where(eq(committeeAssignments.id, id));

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "committee.assignment.delete",
      resourceType: "committee_assignment",
      resourceId: id,
      resourceLabel: `${edition.name} - ${current.title}`,
      before: current,
      changedFields: ["id"],
      source: "admin-committee",
    });
  });

  revalidatePath("/admin/content/committee");
  revalidatePath("/admin");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 3. QUICK PERSON ACTION (MODAL BUAT PROFIL ORANG ON-THE-FLY)
// ---------------------------------------------------------------------------

export async function createQuickPersonAction(formData: FormData) {
  const actor = await requirePermission("content.edit");

  const name = String(formData.get("name") ?? "").trim();
  const shortBio = formData.get("shortBio")?.toString().trim() || null;
  const portraitMediaIdRaw = formData.get("portraitMediaId")?.toString().trim() || null;

  if (!name) {
    throw new Error("Nama lengkap profil wajib diisi");
  }

  const baseSlug = slugify(name);
  const portraitMediaId = portraitMediaIdRaw && portraitMediaIdRaw.length > 0 ? portraitMediaIdRaw : null;

  let portraitUrl: string | null = null;
  if (portraitMediaId) {
    const [asset] = await database
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, portraitMediaId))
      .limit(1);

    if (!asset || asset.lifecycle !== "ready" || !asset.mimeType.startsWith("image/")) {
      throw new Error("Foto profil harus berupa gambar yang valid dan siap digunakan");
    }
    portraitUrl = asset.url;
  }

  const personId = crypto.randomUUID();
  const now = new Date();

  await database.transaction(async (tx) => {
    let finalSlug = baseSlug;
    const existingSlug = await tx
      .select({ id: people.id, slug: people.slug })
      .from(people)
      .where(eq(people.slug, finalSlug))
      .limit(1);

    if (existingSlug.length > 0) {
      finalSlug = `${baseSlug}-${personId.slice(0, 4)}`;
    }

    await tx.insert(people).values({
      id: personId,
      name,
      slug: finalSlug,
      shortBio,
      portraitMediaId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "person.create",
      resourceType: "person",
      resourceId: personId,
      resourceLabel: `${name} (Quick create)`,
      after: {
        id: personId,
        name,
        slug: finalSlug,
        shortBio,
        portraitMediaId,
        version: 1,
      },
      changedFields: ["name", "slug", "shortBio", "portraitMediaId"],
      source: "admin-committee",
    });
  });

  revalidatePath("/admin/content/committee");
  revalidatePath("/admin/organization");
  return {
    success: true,
    person: {
      id: personId,
      name,
      slug: baseSlug,
      shortBio,
      portraitMediaId,
      portraitUrl,
    },
  };
}
