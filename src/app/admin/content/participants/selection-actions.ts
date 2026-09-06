"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { database } from "@/server/db/client";
import {
  closeSelectionStage,
  createApplicant,
  createSelectionStage,
  deleteSelectionStage,
  openSelectionStage,
  reopenSelectionStage,
  reorderSelectionStages,
  rollbackStageDecision,
  setStageDecisions,
  updateSelectionStage,
} from "@/server/selection/operations";

async function getSelectionContext() {
  const actor = await requirePermission("participants.manage");
  const edition = await getAdminEditionContext();
  if (!edition) throw new Error("Pilih edisi aktif terlebih dahulu");
  return {
    actor: { userId: actor.session.user.id, label: actor.session.user.email },
    edition,
  };
}

function integerFrom(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${label} tidak valid`);
  return parsed;
}

function booleanFrom(value: FormDataEntryValue | null) {
  return value === "true" || value === "1" || value === "on";
}

function revalidateSelection(stageId?: string) {
  revalidatePath("/admin/content/participants");
  revalidatePath("/admin/content/participants/new");
  revalidatePath("/admin/content/participants/stages");
  if (stageId) revalidatePath(`/admin/content/participants/stages/${stageId}`);
}

export async function createApplicantAction(formData: FormData) {
  const { actor, edition } = await getSelectionContext();
  const result = await createApplicant(database, edition.id, {
    categoryId: String(formData.get("categoryId") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    number: integerFrom(formData.get("number"), "Nomor peserta"),
    bio: String(formData.get("bio") ?? "").trim() || null,
  }, actor, new Date());
  revalidateSelection(result.stageId);
  return result;
}

export async function createSelectionStageAction(formData: FormData) {
  const { actor, edition } = await getSelectionContext();
  const result = await createSelectionStage(database, edition.id, {
    name: String(formData.get("name") ?? "").trim(),
    targetParticipantCount: integerFrom(formData.get("targetParticipantCount"), "Target peserta"),
    finalStage: booleanFrom(formData.get("finalStage")),
  }, actor, new Date());
  revalidateSelection(result.id);
  return result;
}

export async function updateSelectionStageAction(formData: FormData) {
  const { actor, edition } = await getSelectionContext();
  const stageId = String(formData.get("stageId") ?? "").trim();
  const result = await updateSelectionStage(database, edition.id, {
    stageId,
    expectedVersion: integerFrom(formData.get("expectedVersion"), "Versi tahap"),
    name: String(formData.get("name") ?? "").trim(),
    targetParticipantCount: integerFrom(formData.get("targetParticipantCount"), "Target peserta"),
    finalStage: booleanFrom(formData.get("finalStage")),
  }, actor, new Date());
  revalidateSelection(stageId);
  return result;
}

export async function reorderSelectionStagesAction(items: Array<{ id: string; expectedVersion: number }>) {
  const { actor, edition } = await getSelectionContext();
  await reorderSelectionStages(database, edition.id, items, actor, new Date());
  revalidateSelection();
  return { success: true };
}

export async function openSelectionStageAction(formData: FormData) {
  const { actor, edition } = await getSelectionContext();
  const stageId = String(formData.get("stageId") ?? "").trim();
  const result = await openSelectionStage(database, edition.id, {
    stageId,
    expectedVersion: integerFrom(formData.get("expectedVersion"), "Versi tahap"),
  }, actor, new Date());
  revalidateSelection(stageId);
  return result;
}

export async function setStageDecisionsAction(input: {
  stageId: string;
  decision: "advanced" | "eliminated";
  entries: Array<{ id: string; expectedVersion: number }>;
  reason?: string;
}) {
  const { actor, edition } = await getSelectionContext();
  const result = await setStageDecisions(database, edition.id, input, actor, new Date());
  revalidateSelection(input.stageId);
  return result;
}

export async function rollbackStageDecisionAction(formData: FormData) {
  const { actor, edition } = await getSelectionContext();
  const entryId = String(formData.get("entryId") ?? "").trim();
  const stageId = String(formData.get("stageId") ?? "").trim();
  const result = await rollbackStageDecision(database, edition.id, {
    entryId,
    expectedVersion: integerFrom(formData.get("expectedVersion"), "Versi keputusan"),
    reason: String(formData.get("reason") ?? "").trim(),
  }, actor, new Date());
  revalidateSelection(stageId);
  return result;
}

export async function closeSelectionStageAction(formData: FormData) {
  const { actor, edition } = await getSelectionContext();
  const stageId = String(formData.get("stageId") ?? "").trim();
  const result = await closeSelectionStage(database, edition.id, {
    stageId,
    expectedVersion: integerFrom(formData.get("expectedVersion"), "Versi tahap"),
    allowUnderTarget: booleanFrom(formData.get("allowUnderTarget")),
    reason: String(formData.get("reason") ?? "").trim() || undefined,
  }, actor, new Date());
  revalidateSelection(stageId);
  if (result.nextStageId) revalidateSelection(result.nextStageId);
  return result;
}

export async function reopenSelectionStageAction(formData: FormData) {
  const { actor, edition } = await getSelectionContext();
  const stageId = String(formData.get("stageId") ?? "").trim();
  const result = await reopenSelectionStage(database, edition.id, {
    stageId,
    expectedVersion: integerFrom(formData.get("expectedVersion"), "Versi tahap"),
    reason: String(formData.get("reason") ?? "").trim(),
  }, actor, new Date());
  revalidateSelection(stageId);
  return result;
}

export async function deleteSelectionStageAction(formData: FormData) {
  const { actor, edition } = await getSelectionContext();
  const stageId = String(formData.get("stageId") ?? "").trim();
  await deleteSelectionStage(database, edition.id, {
    stageId,
    expectedVersion: integerFrom(formData.get("expectedVersion"), "Versi tahap"),
  }, actor, new Date());
  revalidateSelection();
  return { success: true };
}
