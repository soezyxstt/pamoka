import { and, asc, desc, eq, gt, inArray, lt, ne } from "drizzle-orm";

import { appendAuditLog } from "@/server/auth/audit";
import type { Database } from "@/server/db/queries";
import {
  categories,
  participantStageEntries,
  participantTitleAssignments,
  participants,
  selectionStages,
  votingCampaignParticipants,
  votingCampaigns,
  type StageDecision,
} from "@/server/db/schema";

type AuditActor = { userId: string; label: string };

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "tahap";
}

function requirePositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} harus berupa bilangan bulat positif`);
}

async function getStage(tx: Parameters<Parameters<Database["transaction"]>[0]>[0], editionId: string, stageId: string) {
  const [stage] = await tx
    .select()
    .from(selectionStages)
    .where(and(eq(selectionStages.id, stageId), eq(selectionStages.editionId, editionId)))
    .limit(1);
  if (!stage) throw new Error("Tahap tidak ditemukan pada edisi aktif");
  return stage;
}

export async function createApplicant(
  db: Database,
  editionId: string,
  input: { categoryId: string; name: string; slug?: string; number: number; bio?: string | null },
  actor: AuditActor,
  now: Date,
) {
  const name = input.name.trim();
  const slug = slugify(input.slug?.trim() || name);
  requirePositiveInteger(input.number, "Nomor peserta");
  if (!name || !input.categoryId) throw new Error("Nama dan kategori wajib diisi");

  return db.transaction(async (tx) => {
    const [category] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, input.categoryId), eq(categories.editionId, editionId), eq(categories.active, true)))
      .limit(1);
    if (!category) throw new Error("Kategori harus berasal dari edisi aktif");

    const [firstStage] = await tx
      .select()
      .from(selectionStages)
      .where(eq(selectionStages.editionId, editionId))
      .orderBy(asc(selectionStages.displayOrder), asc(selectionStages.id))
      .limit(1);
    if (!firstStage) throw new Error("Buat tahap pertama sebelum menambah pendaftar");
    if (firstStage.lifecycle === "closed") throw new Error("Tahap pertama sudah ditutup");

    const [sameSlug] = await tx
      .select({ id: participants.id })
      .from(participants)
      .where(and(eq(participants.editionId, editionId), eq(participants.slug, slug)))
      .limit(1);
    if (sameSlug) throw new Error("Slug peserta sudah digunakan pada edisi ini");

    const [sameNumber] = await tx
      .select({ id: participants.id })
      .from(participants)
      .where(and(
        eq(participants.editionId, editionId),
        eq(participants.categoryId, input.categoryId),
        eq(participants.number, input.number),
      ))
      .limit(1);
    if (sameNumber) throw new Error("Nomor peserta sudah digunakan pada kategori ini");

    const participantId = crypto.randomUUID();
    const entryId = crypto.randomUUID();
    await tx.insert(participants).values({
      id: participantId,
      editionId,
      categoryId: input.categoryId,
      stage: firstStage.slug,
      currentStageId: firstStage.id,
      selectionStatus: "registered",
      number: input.number,
      name,
      slug,
      bio: input.bio?.trim() || null,
      displayOrder: input.number,
      active: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(participantStageEntries).values({
      id: entryId,
      participantId,
      stageId: firstStage.id,
      decision: "pending",
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "participant.create",
      resourceType: "participant",
      resourceId: participantId,
      resourceLabel: `${input.number} ${name}`,
      after: { editionId, categoryId: input.categoryId, currentStageId: firstStage.id, selectionStatus: "registered", number: input.number, name, slug },
      changedFields: ["editionId", "categoryId", "currentStageId", "selectionStatus", "number", "name", "slug"],
      source: "admin-selection",
    });
    return { id: participantId, stageId: firstStage.id };
  });
}

export async function createSelectionStage(
  db: Database,
  editionId: string,
  input: { name: string; targetParticipantCount: number; finalStage: boolean },
  actor: AuditActor,
  now: Date,
) {
  const name = input.name.trim();
  const slug = slugify(name);
  if (!name) throw new Error("Nama tahap wajib diisi");
  requirePositiveInteger(input.targetParticipantCount, "Target peserta");

  return db.transaction(async (tx) => {
    const [sameSlug] = await tx
      .select({ id: selectionStages.id })
      .from(selectionStages)
      .where(and(eq(selectionStages.editionId, editionId), eq(selectionStages.slug, slug)))
      .limit(1);
    if (sameSlug) throw new Error("Nama tahap sudah digunakan");
    if (input.finalStage) {
      const [existingFinal] = await tx
        .select({ id: selectionStages.id })
        .from(selectionStages)
        .where(and(eq(selectionStages.editionId, editionId), eq(selectionStages.finalStage, true)))
        .limit(1);
      if (existingFinal) throw new Error("Edisi ini sudah memiliki tahap final");
    }

    const [lastStage] = await tx
      .select({ displayOrder: selectionStages.displayOrder })
      .from(selectionStages)
      .where(eq(selectionStages.editionId, editionId))
      .orderBy(desc(selectionStages.displayOrder))
      .limit(1);
    const id = crypto.randomUUID();
    const displayOrder = (lastStage?.displayOrder ?? -1) + 1;
    await tx.insert(selectionStages).values({
      id,
      editionId,
      name,
      slug,
      displayOrder,
      targetParticipantCount: input.targetParticipantCount,
      lifecycle: "draft",
      finalStage: input.finalStage,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "selection_stage.create",
      resourceType: "selectionStage",
      resourceId: id,
      resourceLabel: name,
      after: { editionId, name, slug, displayOrder, targetParticipantCount: input.targetParticipantCount, finalStage: input.finalStage },
      changedFields: ["editionId", "name", "slug", "displayOrder", "targetParticipantCount", "finalStage"],
      source: "admin-selection",
    });
    return { id };
  });
}

export async function updateSelectionStage(
  db: Database,
  editionId: string,
  input: { stageId: string; expectedVersion: number; name: string; targetParticipantCount: number; finalStage: boolean },
  actor: AuditActor,
  now: Date,
) {
  const name = input.name.trim();
  if (!name) throw new Error("Nama tahap wajib diisi");
  requirePositiveInteger(input.targetParticipantCount, "Target peserta");

  return db.transaction(async (tx) => {
    const before = await getStage(tx, editionId, input.stageId);
    if (before.version !== input.expectedVersion) throw new Error("Tahap telah diubah. Muat ulang halaman.");

    const entries = await tx
      .select({ id: participantStageEntries.id })
      .from(participantStageEntries)
      .where(eq(participantStageEntries.stageId, before.id));
    if (input.targetParticipantCount < entries.length) throw new Error("Target tidak boleh kurang dari peserta yang sudah masuk");
    if (input.finalStage && !before.finalStage) {
      const [existingFinal] = await tx
        .select({ id: selectionStages.id })
        .from(selectionStages)
        .where(and(
          eq(selectionStages.editionId, editionId),
          eq(selectionStages.finalStage, true),
          ne(selectionStages.id, before.id),
        ))
        .limit(1);
      if (existingFinal) throw new Error("Edisi ini sudah memiliki tahap final");
    }
    if (before.finalStage && !input.finalStage) {
      const [titleAssignment] = await tx
        .select({ participantId: participantTitleAssignments.participantId })
        .from(participantTitleAssignments)
        .innerJoin(participants, eq(participants.id, participantTitleAssignments.participantId))
        .where(and(eq(participants.editionId, editionId), eq(participants.currentStageId, before.id)))
        .limit(1);
      const [campaign] = await tx
        .select({ id: votingCampaigns.id })
        .from(votingCampaigns)
        .where(and(eq(votingCampaigns.editionId, editionId), eq(votingCampaigns.eligibilityStageId, before.id)))
        .limit(1);
      const [snapshot] = await tx
        .select({ participantId: votingCampaignParticipants.participantId })
        .from(votingCampaignParticipants)
        .where(eq(votingCampaignParticipants.sourceStageId, before.id))
        .limit(1);
      if (titleAssignment || campaign || snapshot) throw new Error("Tahap final yang sudah dipakai tidak dapat diubah");
    }

    const updated = await tx
      .update(selectionStages)
      .set({ name, targetParticipantCount: input.targetParticipantCount, finalStage: input.finalStage, version: before.version + 1, updatedAt: now })
      .where(and(eq(selectionStages.id, before.id), eq(selectionStages.version, input.expectedVersion)))
      .returning({ id: selectionStages.id });
    if (updated.length !== 1) throw new Error("Tahap telah diubah. Muat ulang halaman.");
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "selection_stage.update",
      resourceType: "selectionStage",
      resourceId: before.id,
      resourceLabel: name,
      before,
      after: { ...before, name, targetParticipantCount: input.targetParticipantCount, finalStage: input.finalStage, version: before.version + 1 },
      changedFields: ["name", "targetParticipantCount", "finalStage", "version"],
      source: "admin-selection",
    });
    return { version: before.version + 1 };
  });
}

export async function reorderSelectionStages(
  db: Database,
  editionId: string,
  items: Array<{ id: string; expectedVersion: number }>,
  actor: AuditActor,
  now: Date,
) {
  if (items.length === 0 || new Set(items.map((item) => item.id)).size !== items.length) throw new Error("Urutan tahap tidak valid");
  return db.transaction(async (tx) => {
    const stages = await tx.select().from(selectionStages).where(eq(selectionStages.editionId, editionId));
    if (stages.length !== items.length || stages.some((stage) => !items.some((item) => item.id === stage.id))) throw new Error("Urutan harus memuat seluruh tahap edisi aktif");
    const entries = await tx
      .select({ id: participantStageEntries.id })
      .from(participantStageEntries)
      .where(inArray(participantStageEntries.stageId, items.map((item) => item.id)))
      .limit(1);
    if (entries.length > 0) throw new Error("Tahap yang sudah dipakai tidak dapat dipindahkan");

    for (const [displayOrder, item] of items.entries()) {
      const updated = await tx
        .update(selectionStages)
        .set({ displayOrder, version: item.expectedVersion + 1, updatedAt: now })
        .where(and(eq(selectionStages.id, item.id), eq(selectionStages.editionId, editionId), eq(selectionStages.version, item.expectedVersion)))
        .returning({ id: selectionStages.id });
      if (updated.length !== 1) throw new Error("Urutan tahap telah berubah. Muat ulang halaman.");
    }
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "selection_stage.reorder",
      resourceType: "selectionStage",
      resourceId: editionId,
      resourceLabel: "Urutan tahap",
      before: { order: [...stages].sort((a, b) => a.displayOrder - b.displayOrder).map((stage) => stage.id) },
      after: { order: items.map((item) => item.id) },
      changedFields: ["displayOrder", "version"],
      source: "admin-selection",
    });
  });
}

export async function openSelectionStage(
  db: Database,
  editionId: string,
  input: { stageId: string; expectedVersion: number },
  actor: AuditActor,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const stage = await getStage(tx, editionId, input.stageId);
    if (stage.version !== input.expectedVersion) throw new Error("Tahap telah diubah. Muat ulang halaman.");
    if (stage.lifecycle !== "draft") throw new Error("Hanya tahap draft yang dapat dibuka");
    const [activeStage] = await tx
      .select({ id: selectionStages.id })
      .from(selectionStages)
      .where(and(eq(selectionStages.editionId, editionId), eq(selectionStages.lifecycle, "active")))
      .limit(1);
    if (activeStage) throw new Error("Tutup tahap aktif sebelum membuka tahap lain");
    const [previousStage] = await tx
      .select()
      .from(selectionStages)
      .where(and(eq(selectionStages.editionId, editionId), lt(selectionStages.displayOrder, stage.displayOrder)))
      .orderBy(desc(selectionStages.displayOrder))
      .limit(1);
    if (previousStage && previousStage.lifecycle !== "closed") throw new Error("Tahap sebelumnya harus ditutup terlebih dahulu");

    const updated = await tx
      .update(selectionStages)
      .set({ lifecycle: "active", version: stage.version + 1, updatedAt: now })
      .where(and(eq(selectionStages.id, stage.id), eq(selectionStages.version, input.expectedVersion)))
      .returning({ id: selectionStages.id });
    if (updated.length !== 1) throw new Error("Tahap telah diubah. Muat ulang halaman.");
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "selection_stage.open",
      resourceType: "selectionStage",
      resourceId: stage.id,
      resourceLabel: stage.name,
      before: { lifecycle: stage.lifecycle, version: stage.version },
      after: { lifecycle: "active", version: stage.version + 1 },
      changedFields: ["lifecycle", "version"],
      source: "admin-selection",
    });
    return { version: stage.version + 1 };
  });
}

export async function setStageDecisions(
  db: Database,
  editionId: string,
  input: { stageId: string; decision: Exclude<StageDecision, "pending">; entries: Array<{ id: string; expectedVersion: number }>; reason?: string },
  actor: AuditActor,
  now: Date,
) {
  if (!input.entries.length || new Set(input.entries.map((entry) => entry.id)).size !== input.entries.length) throw new Error("Pilih setidaknya satu peserta");
  if (!(["advanced", "eliminated"] as const).includes(input.decision)) throw new Error("Keputusan tidak valid");
  return db.transaction(async (tx) => {
    const stage = await getStage(tx, editionId, input.stageId);
    if (stage.lifecycle !== "active") throw new Error("Keputusan hanya dapat dibuat pada tahap aktif");
    const rows = await tx
      .select({ entry: participantStageEntries, participantEditionId: participants.editionId })
      .from(participantStageEntries)
      .innerJoin(participants, eq(participants.id, participantStageEntries.participantId))
      .where(inArray(participantStageEntries.id, input.entries.map((entry) => entry.id)));
    if (rows.length !== input.entries.length || rows.some((row) => row.entry.stageId !== stage.id || row.participantEditionId !== editionId)) throw new Error("Peserta harus berasal dari tahap dan edisi aktif");
    for (const row of rows) {
      const expected = input.entries.find((entry) => entry.id === row.entry.id)?.expectedVersion;
      if (expected !== row.entry.version) throw new Error("Keputusan peserta telah berubah. Muat ulang halaman.");
    }

    const [nextStage] = await tx
      .select()
      .from(selectionStages)
      .where(and(eq(selectionStages.editionId, editionId), gt(selectionStages.displayOrder, stage.displayOrder)))
      .orderBy(asc(selectionStages.displayOrder))
      .limit(1);
    if (input.decision === "advanced" && nextStage) {
      const currentAdvanced = await tx
        .select({ id: participantStageEntries.id })
        .from(participantStageEntries)
        .where(and(eq(participantStageEntries.stageId, stage.id), eq(participantStageEntries.decision, "advanced")));
      const selectedAdvanced = rows.filter((row) => row.entry.decision === "advanced").length;
      const proposedAdvanced = currentAdvanced.length - selectedAdvanced + rows.length;
      if (proposedAdvanced > nextStage.targetParticipantCount) throw new Error("Jumlah peserta lolos melebihi target tahap berikutnya");
    }

    for (const row of rows) {
      const updated = await tx
        .update(participantStageEntries)
        .set({ decision: input.decision, decidedAt: now, decidedByUserId: actor.userId, reason: input.reason?.trim() || null, version: row.entry.version + 1, updatedAt: now })
        .where(and(eq(participantStageEntries.id, row.entry.id), eq(participantStageEntries.version, row.entry.version)))
        .returning({ id: participantStageEntries.id });
      if (updated.length !== 1) throw new Error("Keputusan peserta telah berubah. Muat ulang halaman.");
      await tx
        .update(participants)
        .set({ selectionStatus: input.decision === "advanced" ? "active" : "eliminated", updatedAt: now })
        .where(and(eq(participants.id, row.entry.participantId), eq(participants.editionId, editionId)));
    }
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "participant_stage_entry.bulk_decision",
      resourceType: "selectionStage",
      resourceId: stage.id,
      resourceLabel: stage.name,
      before: { entries: rows.map((row) => ({ id: row.entry.id, decision: row.entry.decision, version: row.entry.version })) },
      after: { entries: rows.map((row) => ({ id: row.entry.id, decision: input.decision, version: row.entry.version + 1 })) },
      changedFields: ["decision", "decidedAt", "decidedByUserId", "reason", "version", "selectionStatus"],
      source: "admin-selection",
      reason: input.reason?.trim() || undefined,
    });
    return { updated: rows.length };
  });
}

export async function rollbackStageDecision(
  db: Database,
  editionId: string,
  input: { entryId: string; expectedVersion: number; reason: string },
  actor: AuditActor,
  now: Date,
) {
  const reason = input.reason.trim();
  if (reason.length < 5) throw new Error("Alasan rollback minimal 5 karakter");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ entry: participantStageEntries, stage: selectionStages, participantEditionId: participants.editionId })
      .from(participantStageEntries)
      .innerJoin(selectionStages, eq(selectionStages.id, participantStageEntries.stageId))
      .innerJoin(participants, eq(participants.id, participantStageEntries.participantId))
      .where(eq(participantStageEntries.id, input.entryId))
      .limit(1);
    if (!row || row.stage.editionId !== editionId || row.participantEditionId !== editionId) throw new Error("Keputusan tidak ditemukan pada edisi aktif");
    if (row.stage.lifecycle !== "active") throw new Error("Rollback hanya tersedia pada tahap aktif");
    if (row.entry.version !== input.expectedVersion) throw new Error("Keputusan peserta telah berubah. Muat ulang halaman.");
    if (row.entry.decision === "pending") throw new Error("Keputusan peserta masih pending");

    const downstream = await tx
      .select({ id: participantStageEntries.id })
      .from(participantStageEntries)
      .innerJoin(selectionStages, eq(selectionStages.id, participantStageEntries.stageId))
      .where(and(eq(participantStageEntries.participantId, row.entry.participantId), gt(selectionStages.displayOrder, row.stage.displayOrder)))
      .limit(1);
    const snapshot = await tx.select({ participantId: votingCampaignParticipants.participantId }).from(votingCampaignParticipants).where(eq(votingCampaignParticipants.participantId, row.entry.participantId)).limit(1);
    const title = await tx.select({ participantId: participantTitleAssignments.participantId }).from(participantTitleAssignments).where(eq(participantTitleAssignments.participantId, row.entry.participantId)).limit(1);
    if (downstream.length || snapshot.length || title.length) throw new Error("Keputusan tidak dapat dirollback karena peserta sudah dipakai pada proses berikutnya");

    const [previousStage] = await tx
      .select({ id: selectionStages.id })
      .from(selectionStages)
      .where(and(eq(selectionStages.editionId, editionId), lt(selectionStages.displayOrder, row.stage.displayOrder)))
      .limit(1);
    const updated = await tx
      .update(participantStageEntries)
      .set({ decision: "pending", decidedAt: null, decidedByUserId: null, reason, version: row.entry.version + 1, updatedAt: now })
      .where(and(eq(participantStageEntries.id, row.entry.id), eq(participantStageEntries.version, input.expectedVersion)))
      .returning({ id: participantStageEntries.id });
    if (updated.length !== 1) throw new Error("Keputusan peserta telah berubah. Muat ulang halaman.");
    await tx
      .update(participants)
      .set({ selectionStatus: previousStage ? "active" : "registered", updatedAt: now })
      .where(and(eq(participants.id, row.entry.participantId), eq(participants.editionId, editionId)));
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "participant_stage_entry.rollback",
      resourceType: "participantStageEntry",
      resourceId: row.entry.id,
      resourceLabel: row.stage.name,
      before: { decision: row.entry.decision, version: row.entry.version },
      after: { decision: "pending", version: row.entry.version + 1 },
      changedFields: ["decision", "decidedAt", "decidedByUserId", "reason", "version", "selectionStatus"],
      source: "admin-selection",
      reason,
    });
    return { version: row.entry.version + 1 };
  });
}

export async function closeSelectionStage(
  db: Database,
  editionId: string,
  input: { stageId: string; expectedVersion: number; allowUnderTarget: boolean; reason?: string },
  actor: AuditActor,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const stage = await getStage(tx, editionId, input.stageId);
    if (stage.version !== input.expectedVersion) throw new Error("Tahap telah diubah. Muat ulang halaman.");
    if (stage.lifecycle !== "active") throw new Error("Hanya tahap aktif yang dapat ditutup");
    const entries = await tx.select().from(participantStageEntries).where(eq(participantStageEntries.stageId, stage.id));
    if (entries.some((entry) => entry.decision === "pending")) throw new Error("Selesaikan seluruh keputusan peserta sebelum menutup tahap");
    const advanced = entries.filter((entry) => entry.decision === "advanced");
    const [nextStage] = await tx
      .select()
      .from(selectionStages)
      .where(and(eq(selectionStages.editionId, editionId), gt(selectionStages.displayOrder, stage.displayOrder)))
      .orderBy(asc(selectionStages.displayOrder))
      .limit(1);
    if (!stage.finalStage && !nextStage) throw new Error("Buat tahap berikutnya atau tandai tahap ini sebagai final");
    if (nextStage) {
      if (advanced.length > nextStage.targetParticipantCount) throw new Error("Jumlah peserta lolos melebihi target tahap berikutnya");
      if (advanced.length < nextStage.targetParticipantCount && (!input.allowUnderTarget || (input.reason?.trim().length ?? 0) < 5)) {
        throw new Error("Konfirmasi dan alasan diperlukan untuk menutup di bawah target");
      }
    }

    const stageUpdate = await tx
      .update(selectionStages)
      .set({ lifecycle: "closed", version: stage.version + 1, updatedAt: now })
      .where(and(eq(selectionStages.id, stage.id), eq(selectionStages.version, input.expectedVersion)))
      .returning({ id: selectionStages.id });
    if (stageUpdate.length !== 1) throw new Error("Tahap telah diubah. Muat ulang halaman.");

    const advancedParticipantIds = advanced.map((entry) => entry.participantId);
    if (stage.finalStage) {
      if (advancedParticipantIds.length) {
        await tx.update(participants).set({ selectionStatus: "completed", updatedAt: now }).where(and(eq(participants.editionId, editionId), inArray(participants.id, advancedParticipantIds)));
      }
    } else if (nextStage) {
      if (nextStage.lifecycle === "closed") throw new Error("Tahap berikutnya sudah ditutup");
      if (nextStage.lifecycle === "draft") {
        const nextStageUpdate = await tx
          .update(selectionStages)
          .set({ lifecycle: "active", version: nextStage.version + 1, updatedAt: now })
          .where(and(eq(selectionStages.id, nextStage.id), eq(selectionStages.version, nextStage.version)))
          .returning({ id: selectionStages.id });
        if (nextStageUpdate.length !== 1) throw new Error("Tahap berikutnya telah diubah. Muat ulang halaman.");
      }
      if (advanced.length) {
        await tx.insert(participantStageEntries).values(advanced.map((entry) => ({
          id: crypto.randomUUID(),
          participantId: entry.participantId,
          stageId: nextStage.id,
          decision: "pending" as const,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })));
        await tx
          .update(participants)
          .set({ currentStageId: nextStage.id, selectionStatus: "active", updatedAt: now })
          .where(and(eq(participants.editionId, editionId), inArray(participants.id, advancedParticipantIds)));
      }
    }
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "selection_stage.close",
      resourceType: "selectionStage",
      resourceId: stage.id,
      resourceLabel: stage.name,
      before: { lifecycle: stage.lifecycle, version: stage.version },
      after: { lifecycle: "closed", version: stage.version + 1, advancedParticipantIds, nextStageId: nextStage?.id ?? null },
      changedFields: ["lifecycle", "version", "participantStageEntries", "currentStageId", "selectionStatus"],
      source: "admin-selection",
      reason: input.reason?.trim() || undefined,
    });
    return { version: stage.version + 1, advanced: advanced.length, nextStageId: nextStage?.id ?? null };
  });
}

export async function reopenSelectionStage(
  db: Database,
  editionId: string,
  input: { stageId: string; expectedVersion: number; reason: string },
  actor: AuditActor,
  now: Date,
) {
  const reason = input.reason.trim();
  if (reason.length < 5) throw new Error("Alasan buka kembali minimal 5 karakter");
  return db.transaction(async (tx) => {
    const stage = await getStage(tx, editionId, input.stageId);
    if (stage.version !== input.expectedVersion) throw new Error("Tahap telah diubah. Muat ulang halaman.");
    if (stage.lifecycle !== "closed") throw new Error("Hanya tahap tertutup yang dapat dibuka kembali");
    if (stage.finalStage) throw new Error("Tahap final yang selesai tidak dapat dibuka kembali dari alur seleksi");

    const [nextStage] = await tx
      .select()
      .from(selectionStages)
      .where(and(eq(selectionStages.editionId, editionId), gt(selectionStages.displayOrder, stage.displayOrder)))
      .orderBy(asc(selectionStages.displayOrder))
      .limit(1);
    if (!nextStage || nextStage.lifecycle !== "active") throw new Error("Tahap berikutnya tidak berada pada kondisi yang dapat dipulihkan");

    const nextEntries = await tx.select().from(participantStageEntries).where(eq(participantStageEntries.stageId, nextStage.id));
    if (nextEntries.some((entry) => entry.decision !== "pending")) throw new Error("Tahap berikutnya sudah memiliki keputusan dan tidak dapat dipulihkan");
    const nextParticipantIds = nextEntries.map((entry) => entry.participantId);
    if (nextParticipantIds.length) {
      const [snapshot] = await tx.select({ participantId: votingCampaignParticipants.participantId }).from(votingCampaignParticipants).where(inArray(votingCampaignParticipants.participantId, nextParticipantIds)).limit(1);
      const [title] = await tx.select({ participantId: participantTitleAssignments.participantId }).from(participantTitleAssignments).where(inArray(participantTitleAssignments.participantId, nextParticipantIds)).limit(1);
      if (snapshot || title) throw new Error("Peserta tahap berikutnya sudah digunakan pada proses lanjutan");
    }
    const [laterEntry] = await tx
      .select({ id: participantStageEntries.id })
      .from(participantStageEntries)
      .innerJoin(selectionStages, eq(selectionStages.id, participantStageEntries.stageId))
      .where(and(eq(selectionStages.editionId, editionId), gt(selectionStages.displayOrder, nextStage.displayOrder)))
      .limit(1);
    if (laterEntry) throw new Error("Alur seleksi sudah berlanjut melewati tahap berikutnya");

    const reopened = await tx
      .update(selectionStages)
      .set({ lifecycle: "active", version: stage.version + 1, updatedAt: now })
      .where(and(eq(selectionStages.id, stage.id), eq(selectionStages.version, input.expectedVersion)))
      .returning({ id: selectionStages.id });
    const resetNext = await tx
      .update(selectionStages)
      .set({ lifecycle: "draft", version: nextStage.version + 1, updatedAt: now })
      .where(and(eq(selectionStages.id, nextStage.id), eq(selectionStages.version, nextStage.version)))
      .returning({ id: selectionStages.id });
    if (reopened.length !== 1 || resetNext.length !== 1) throw new Error("Tahap telah diubah. Muat ulang halaman.");

    if (nextParticipantIds.length) {
      await tx.delete(participantStageEntries).where(and(eq(participantStageEntries.stageId, nextStage.id), inArray(participantStageEntries.participantId, nextParticipantIds)));
      await tx
        .update(participants)
        .set({ currentStageId: stage.id, selectionStatus: "active", updatedAt: now })
        .where(and(eq(participants.editionId, editionId), inArray(participants.id, nextParticipantIds)));
    }
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "selection_stage.reopen",
      resourceType: "selectionStage",
      resourceId: stage.id,
      resourceLabel: stage.name,
      before: { lifecycle: "closed", nextStageId: nextStage.id, nextLifecycle: "active", participantIds: nextParticipantIds },
      after: { lifecycle: "active", nextStageId: nextStage.id, nextLifecycle: "draft" },
      changedFields: ["lifecycle", "participantStageEntries", "currentStageId", "selectionStatus", "version"],
      source: "admin-selection",
      reason,
    });
    return { version: stage.version + 1, restoredParticipants: nextParticipantIds.length };
  });
}

export async function deleteSelectionStage(
  db: Database,
  editionId: string,
  input: { stageId: string; expectedVersion: number },
  actor: AuditActor,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const stage = await getStage(tx, editionId, input.stageId);
    if (stage.version !== input.expectedVersion) throw new Error("Tahap telah diubah. Muat ulang halaman.");
    const [entry] = await tx.select({ id: participantStageEntries.id }).from(participantStageEntries).where(eq(participantStageEntries.stageId, stage.id)).limit(1);
    const [currentParticipant] = await tx.select({ id: participants.id }).from(participants).where(eq(participants.currentStageId, stage.id)).limit(1);
    const [campaign] = await tx.select({ id: votingCampaigns.id }).from(votingCampaigns).where(eq(votingCampaigns.eligibilityStageId, stage.id)).limit(1);
    const [snapshot] = await tx.select({ participantId: votingCampaignParticipants.participantId }).from(votingCampaignParticipants).where(eq(votingCampaignParticipants.sourceStageId, stage.id)).limit(1);
    if (entry || currentParticipant || campaign || snapshot) throw new Error("Tahap yang sudah digunakan tidak dapat dihapus");

    const deleted = await tx
      .delete(selectionStages)
      .where(and(eq(selectionStages.id, stage.id), eq(selectionStages.editionId, editionId), eq(selectionStages.version, input.expectedVersion)))
      .returning({ id: selectionStages.id });
    if (deleted.length !== 1) throw new Error("Tahap telah diubah. Muat ulang halaman.");
    const remaining = await tx.select().from(selectionStages).where(eq(selectionStages.editionId, editionId)).orderBy(asc(selectionStages.displayOrder));
    for (const [displayOrder, item] of remaining.entries()) {
      await tx.update(selectionStages).set({ displayOrder, version: item.version + 1, updatedAt: now }).where(eq(selectionStages.id, item.id));
    }
    await appendAuditLog(tx, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "selection_stage.delete",
      resourceType: "selectionStage",
      resourceId: stage.id,
      resourceLabel: stage.name,
      before: stage,
      after: null,
      changedFields: ["selectionStage", "displayOrder"],
      source: "admin-selection",
    });
  });
}
