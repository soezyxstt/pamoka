import { and, asc, desc, eq, ne } from "drizzle-orm";

import { appendAuditLog } from "@/server/auth/audit";
import type { Database } from "@/server/db/queries";
import {
  editionTitles,
  participantTitleAssignments,
  participants,
  selectionStages,
} from "@/server/db/schema";

type AuditActor = { userId: string; label: string };
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function requirePositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} harus berupa bilangan bulat positif`);
  }
}

async function getTitle(tx: Transaction, editionId: string, titleId: string) {
  const [title] = await tx
    .select()
    .from(editionTitles)
    .where(and(eq(editionTitles.id, titleId), eq(editionTitles.editionId, editionId)))
    .limit(1);
  if (!title) throw new Error("Gelar tidak ditemukan pada edisi aktif");
  return title;
}

async function getAssignmentCount(tx: Transaction, titleId: string) {
  const rows = await tx
    .select({ participantId: participantTitleAssignments.participantId })
    .from(participantTitleAssignments)
    .where(eq(participantTitleAssignments.editionTitleId, titleId));
  return rows.length;
}

export async function createEditionTitle(
  db: Database,
  editionId: string,
  input: { name: string; description?: string | null; capacity: number },
  actor: AuditActor,
  now: Date,
) {
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  if (!name) throw new Error("Nama gelar wajib diisi");
  requirePositiveInteger(input.capacity, "Jumlah slot");

  return db.transaction(async (tx) => {
    const [duplicate] = await tx
      .select({ id: editionTitles.id })
      .from(editionTitles)
      .where(and(eq(editionTitles.editionId, editionId), eq(editionTitles.name, name)))
      .limit(1);
    if (duplicate) throw new Error("Nama gelar sudah digunakan pada edisi aktif");

    const [lastTitle] = await tx
      .select({ displayOrder: editionTitles.displayOrder })
      .from(editionTitles)
      .where(eq(editionTitles.editionId, editionId))
      .orderBy(desc(editionTitles.displayOrder))
      .limit(1);

    const id = crypto.randomUUID();
    const displayOrder = (lastTitle?.displayOrder ?? -1) + 1;
    await tx.insert(editionTitles).values({
      id,
      editionId,
      name,
      description,
      capacity: input.capacity,
      displayOrder,
      active: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "edition_title.create",
      resourceType: "editionTitle",
      resourceId: id,
      resourceLabel: name,
      after: { editionId, name, description, capacity: input.capacity, displayOrder, active: true, version: 1 },
      changedFields: ["editionId", "name", "description", "capacity", "displayOrder", "active", "version"],
      source: "admin-selection",
    });
    return { id };
  });
}

export async function updateEditionTitle(
  db: Database,
  editionId: string,
  input: { titleId: string; expectedVersion: number; name: string; description?: string | null; capacity: number },
  actor: AuditActor,
  now: Date,
) {
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  if (!name) throw new Error("Nama gelar wajib diisi");
  requirePositiveInteger(input.capacity, "Jumlah slot");

  return db.transaction(async (tx) => {
    const before = await getTitle(tx, editionId, input.titleId);
    if (before.version !== input.expectedVersion) throw new Error("Gelar telah diubah. Muat ulang halaman.");
    const assignmentCount = await getAssignmentCount(tx, before.id);
    if (input.capacity < assignmentCount) {
      throw new Error(`Jumlah slot tidak boleh kurang dari ${assignmentCount} gelar yang sudah terisi`);
    }
    const [duplicate] = await tx
      .select({ id: editionTitles.id })
      .from(editionTitles)
      .where(and(
        eq(editionTitles.editionId, editionId),
        eq(editionTitles.name, name),
        ne(editionTitles.id, before.id),
      ))
      .limit(1);
    if (duplicate) throw new Error("Nama gelar sudah digunakan pada edisi aktif");

    const nextVersion = before.version + 1;
    const updated = await tx
      .update(editionTitles)
      .set({ name, description, capacity: input.capacity, version: nextVersion, updatedAt: now })
      .where(and(eq(editionTitles.id, before.id), eq(editionTitles.version, input.expectedVersion)))
      .returning({ id: editionTitles.id });
    if (updated.length !== 1) throw new Error("Gelar telah diubah. Muat ulang halaman.");
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "edition_title.update",
      resourceType: "editionTitle",
      resourceId: before.id,
      resourceLabel: name,
      before,
      after: { ...before, name, description, capacity: input.capacity, version: nextVersion },
      changedFields: ["name", "description", "capacity", "version"],
      source: "admin-selection",
    });
    return { version: nextVersion };
  });
}

export async function reorderEditionTitles(
  db: Database,
  editionId: string,
  items: Array<{ id: string; expectedVersion: number }>,
  actor: AuditActor,
  now: Date,
) {
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error("Urutan gelar tidak valid");
  return db.transaction(async (tx) => {
    const current = await tx
      .select()
      .from(editionTitles)
      .where(eq(editionTitles.editionId, editionId))
      .orderBy(asc(editionTitles.displayOrder), asc(editionTitles.id));
    if (current.length !== items.length || current.some((title) => !items.some((item) => item.id === title.id))) {
      throw new Error("Daftar gelar telah berubah. Muat ulang halaman.");
    }
    for (const [displayOrder, item] of items.entries()) {
      const title = current.find((candidate) => candidate.id === item.id)!;
      if (title.version !== item.expectedVersion) throw new Error("Gelar telah diubah. Muat ulang halaman.");
      const updated = await tx
        .update(editionTitles)
        .set({ displayOrder, version: title.version + 1, updatedAt: now })
        .where(and(eq(editionTitles.id, title.id), eq(editionTitles.version, item.expectedVersion)))
        .returning({ id: editionTitles.id });
      if (updated.length !== 1) throw new Error("Gelar telah diubah. Muat ulang halaman.");
    }
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "edition_title.reorder",
      resourceType: "editionTitle",
      resourceId: editionId,
      resourceLabel: "Urutan gelar",
      before: { order: current.map((title) => title.id) },
      after: { order: items.map((item) => item.id) },
      changedFields: ["displayOrder", "version"],
      source: "admin-selection",
    });
    return { success: true };
  });
}

export async function setEditionTitleActive(
  db: Database,
  editionId: string,
  input: { titleId: string; expectedVersion: number; active: boolean },
  actor: AuditActor,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const before = await getTitle(tx, editionId, input.titleId);
    if (before.version !== input.expectedVersion) throw new Error("Gelar telah diubah. Muat ulang halaman.");
    const nextVersion = before.version + 1;
    const updated = await tx
      .update(editionTitles)
      .set({ active: input.active, version: nextVersion, updatedAt: now })
      .where(and(eq(editionTitles.id, before.id), eq(editionTitles.version, input.expectedVersion)))
      .returning({ id: editionTitles.id });
    if (updated.length !== 1) throw new Error("Gelar telah diubah. Muat ulang halaman.");
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "edition_title.active.update",
      resourceType: "editionTitle",
      resourceId: before.id,
      resourceLabel: before.name,
      before: { active: before.active, version: before.version },
      after: { active: input.active, version: nextVersion },
      changedFields: ["active", "version"],
      source: "admin-selection",
    });
    return { version: nextVersion };
  });
}

export async function deleteEditionTitle(
  db: Database,
  editionId: string,
  input: { titleId: string; expectedVersion: number },
  actor: AuditActor,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const before = await getTitle(tx, editionId, input.titleId);
    if (before.version !== input.expectedVersion) throw new Error("Gelar telah diubah. Muat ulang halaman.");
    if (await getAssignmentCount(tx, before.id)) throw new Error("Gelar yang sudah diberikan tidak dapat dihapus");
    const deleted = await tx
      .delete(editionTitles)
      .where(and(eq(editionTitles.id, before.id), eq(editionTitles.version, input.expectedVersion)))
      .returning({ id: editionTitles.id });
    if (deleted.length !== 1) throw new Error("Gelar telah diubah. Muat ulang halaman.");
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "edition_title.delete",
      resourceType: "editionTitle",
      resourceId: before.id,
      resourceLabel: before.name,
      before,
      changedFields: ["deleted"],
      source: "admin-selection",
      requestMetadata: { deletedAt: now.getTime() },
    });
    return { success: true };
  });
}

export async function assignEditionTitle(
  db: Database,
  editionId: string,
  input: { titleId: string; participantId: string; expectedTitleVersion: number },
  actor: AuditActor,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const title = await getTitle(tx, editionId, input.titleId);
    if (title.version !== input.expectedTitleVersion) throw new Error("Gelar telah diubah. Muat ulang halaman.");
    if (!title.active) throw new Error("Gelar nonaktif tidak dapat diberikan");
    const [participant] = await tx
      .select({
        id: participants.id,
        name: participants.name,
        editionId: participants.editionId,
        currentStageId: participants.currentStageId,
        finalStage: selectionStages.finalStage,
      })
      .from(participants)
      .leftJoin(selectionStages, eq(participants.currentStageId, selectionStages.id))
      .where(and(eq(participants.id, input.participantId), eq(participants.editionId, editionId)))
      .limit(1);
    if (!participant) throw new Error("Peserta tidak ditemukan pada edisi aktif");
    if (!participant.currentStageId || !participant.finalStage) {
      throw new Error("Gelar hanya dapat diberikan kepada peserta tahap final");
    }
    const [existing] = await tx
      .select({ participantId: participantTitleAssignments.participantId })
      .from(participantTitleAssignments)
      .where(and(
        eq(participantTitleAssignments.editionTitleId, title.id),
        eq(participantTitleAssignments.participantId, participant.id),
      ))
      .limit(1);
    if (existing) throw new Error("Peserta sudah menerima gelar ini");
    const assignmentCount = await getAssignmentCount(tx, title.id);
    if (assignmentCount >= title.capacity) throw new Error("Jumlah slot gelar sudah penuh");

    const nextVersion = title.version + 1;
    const locked = await tx
      .update(editionTitles)
      .set({ version: nextVersion, updatedAt: now })
      .where(and(eq(editionTitles.id, title.id), eq(editionTitles.version, input.expectedTitleVersion)))
      .returning({ id: editionTitles.id });
    if (locked.length !== 1) throw new Error("Gelar telah diubah. Muat ulang halaman.");
    await tx.insert(participantTitleAssignments).values({
      editionTitleId: title.id,
      participantId: participant.id,
      assignedAt: now,
      assignedByUserId: actor.userId,
    });
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "edition_title.assign",
      resourceType: "editionTitle",
      resourceId: title.id,
      resourceLabel: title.name,
      before: { assignmentCount, version: title.version },
      after: { assignmentCount: assignmentCount + 1, participantId: participant.id, version: nextVersion },
      changedFields: ["assignments", "version"],
      source: "admin-selection",
    });
    return { version: nextVersion };
  });
}

export async function unassignEditionTitle(
  db: Database,
  editionId: string,
  input: { titleId: string; participantId: string; expectedTitleVersion: number },
  actor: AuditActor,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const title = await getTitle(tx, editionId, input.titleId);
    if (title.version !== input.expectedTitleVersion) throw new Error("Gelar telah diubah. Muat ulang halaman.");
    const [participant] = await tx
      .select({ id: participants.id, name: participants.name })
      .from(participants)
      .where(and(eq(participants.id, input.participantId), eq(participants.editionId, editionId)))
      .limit(1);
    if (!participant) throw new Error("Peserta tidak ditemukan pada edisi aktif");
    const [existing] = await tx
      .select({ participantId: participantTitleAssignments.participantId })
      .from(participantTitleAssignments)
      .where(and(
        eq(participantTitleAssignments.editionTitleId, title.id),
        eq(participantTitleAssignments.participantId, participant.id),
      ))
      .limit(1);
    if (!existing) throw new Error("Peserta belum menerima gelar ini");

    const assignmentCount = await getAssignmentCount(tx, title.id);
    const nextVersion = title.version + 1;
    const locked = await tx
      .update(editionTitles)
      .set({ version: nextVersion, updatedAt: now })
      .where(and(eq(editionTitles.id, title.id), eq(editionTitles.version, input.expectedTitleVersion)))
      .returning({ id: editionTitles.id });
    if (locked.length !== 1) throw new Error("Gelar telah diubah. Muat ulang halaman.");
    await tx
      .delete(participantTitleAssignments)
      .where(and(
        eq(participantTitleAssignments.editionTitleId, title.id),
        eq(participantTitleAssignments.participantId, participant.id),
      ));
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "edition_title.unassign",
      resourceType: "editionTitle",
      resourceId: title.id,
      resourceLabel: title.name,
      before: { assignmentCount, participantId: participant.id, version: title.version },
      after: { assignmentCount: assignmentCount - 1, version: nextVersion },
      changedFields: ["assignments", "version"],
      source: "admin-selection",
    });
    return { version: nextVersion };
  });
}
