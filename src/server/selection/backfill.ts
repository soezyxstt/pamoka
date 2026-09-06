import { createHash } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import type { Database } from "@/server/db/queries";
import {
  auditLogs,
  participantStageEntries,
  participants,
  selectionStages,
} from "@/server/db/schema";

const stagePriority = new Map([
  ["pendaftaran", 0],
  ["audisi", 1],
  ["semifinal", 2],
  ["semifinalis", 2],
  ["final", 3],
  ["finalis", 3],
]);

function stableId(value: string) {
  return `selection-${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "tahap";
}

function stageLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export type SelectionBackfillResult = {
  editions: number;
  stagesCreated: number;
  participantsLinked: number;
  entriesCreated: number;
};

export async function backfillDynamicSelection(
  db: Database,
  options: { now: Date; source?: string },
): Promise<SelectionBackfillResult> {
  const source = options.source ?? "selection-backfill";

  return db.transaction(async (tx) => {
    const legacyParticipants = await tx
      .select({
        id: participants.id,
        editionId: participants.editionId,
        stage: participants.stage,
      })
      .from(participants)
      .orderBy(asc(participants.editionId), asc(participants.displayOrder), asc(participants.id));

    const grouped = new Map<string, Map<string, string[]>>();
    for (const participant of legacyParticipants) {
      const editionStages = grouped.get(participant.editionId) ?? new Map<string, string[]>();
      const participantIds = editionStages.get(participant.stage) ?? [];
      participantIds.push(participant.id);
      editionStages.set(participant.stage, participantIds);
      grouped.set(participant.editionId, editionStages);
    }

    let stagesCreated = 0;
    let participantsLinked = 0;
    let entriesCreated = 0;

    for (const [editionId, stageGroups] of grouped) {
      const orderedStages = [...stageGroups.entries()].sort(([left], [right]) => {
        const priorityDifference = (stagePriority.get(left.toLowerCase()) ?? 50) - (stagePriority.get(right.toLowerCase()) ?? 50);
        return priorityDifference || left.localeCompare(right, "id");
      });

      for (const [displayOrder, [legacyStage, participantIds]] of orderedStages.entries()) {
        const slug = normalizeSlug(legacyStage);
        const stageId = stableId(`${editionId}:${slug}`);
        const existing = await tx
          .select({ id: selectionStages.id })
          .from(selectionStages)
          .where(and(eq(selectionStages.editionId, editionId), eq(selectionStages.slug, slug)))
          .limit(1);

        if (existing.length === 0) {
          await tx.insert(selectionStages).values({
            id: stageId,
            editionId,
            name: stageLabel(legacyStage),
            slug,
            displayOrder,
            targetParticipantCount: participantIds.length,
            lifecycle: "draft",
            finalStage: ["final", "finalis"].includes(legacyStage.toLowerCase()),
            createdAt: options.now,
            updatedAt: options.now,
          });
          stagesCreated += 1;
        }

        const resolvedStageId = existing[0]?.id ?? stageId;
        for (const participantId of participantIds) {
          const entryId = stableId(`${participantId}:${resolvedStageId}`);
          const insertedEntry = await tx
            .insert(participantStageEntries)
            .values({
              id: entryId,
              participantId,
              stageId: resolvedStageId,
              decision: "pending",
              reason: "Migrasi data lama, perlu ditinjau",
              createdAt: options.now,
              updatedAt: options.now,
            })
            .onConflictDoNothing()
            .returning({ id: participantStageEntries.id });
          entriesCreated += insertedEntry.length;

          const updatedParticipant = await tx
            .update(participants)
            .set({
              currentStageId: resolvedStageId,
              selectionStatus: "active",
              updatedAt: options.now,
            })
            .where(and(eq(participants.id, participantId), eq(participants.editionId, editionId)))
            .returning({ id: participants.id });
          participantsLinked += updatedParticipant.length;
        }
      }
    }

    const result = {
      editions: grouped.size,
      stagesCreated,
      participantsLinked,
      entriesCreated,
    };
    const auditId = stableId(`audit:${source}`);
    await tx
      .insert(auditLogs)
      .values({
        id: auditId,
        actorLabel: "system:selection-backfill",
        action: "selection.backfill",
        resourceType: "selection",
        resourceId: "dynamic-selection",
        resourceLabel: "Backfill alur seleksi",
        afterJson: JSON.stringify(result),
        changedFieldsJson: JSON.stringify(["selectionStages", "participantStageEntries", "participants.currentStageId"]),
        source,
        reason: "Menghubungkan data tahap lama tanpa mengubah field kompatibilitas",
        createdAt: options.now,
      })
      .onConflictDoNothing();

    return result;
  });
}
