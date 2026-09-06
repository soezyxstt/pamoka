"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { database } from "@/server/db/client";
import {
  assignEditionTitle,
  createEditionTitle,
  deleteEditionTitle,
  reorderEditionTitles,
  setEditionTitleActive,
  unassignEditionTitle,
  updateEditionTitle,
} from "@/server/selection/title-operations";

async function getTitleContext() {
  const actor = await requirePermission("participants.manage");
  const edition = await getAdminEditionContext();
  if (!edition) throw new Error("Pilih edisi aktif terlebih dahulu");
  return {
    edition,
    actor: { userId: actor.session.user.id, label: actor.session.user.email },
  };
}

function integerFrom(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${label} tidak valid`);
  return parsed;
}

function revalidateTitles(participantId?: string) {
  revalidatePath("/admin/content/participants");
  revalidatePath("/admin/content/participants/titles");
  if (participantId) revalidatePath(`/admin/content/participants/${participantId}`);
}

export async function createEditionTitleAction(formData: FormData) {
  const { edition, actor } = await getTitleContext();
  const result = await createEditionTitle(database, edition.id, {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    capacity: integerFrom(formData.get("capacity"), "Jumlah slot"),
  }, actor, new Date());
  revalidateTitles();
  return result;
}

export async function updateEditionTitleAction(formData: FormData) {
  const { edition, actor } = await getTitleContext();
  const result = await updateEditionTitle(database, edition.id, {
    titleId: String(formData.get("titleId") ?? "").trim(),
    expectedVersion: integerFrom(formData.get("expectedVersion"), "Versi gelar"),
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    capacity: integerFrom(formData.get("capacity"), "Jumlah slot"),
  }, actor, new Date());
  revalidateTitles();
  return result;
}

export async function reorderEditionTitlesAction(items: Array<{ id: string; expectedVersion: number }>) {
  const { edition, actor } = await getTitleContext();
  const result = await reorderEditionTitles(database, edition.id, items, actor, new Date());
  revalidateTitles();
  return result;
}

export async function setEditionTitleActiveAction(formData: FormData) {
  const { edition, actor } = await getTitleContext();
  const result = await setEditionTitleActive(database, edition.id, {
    titleId: String(formData.get("titleId") ?? "").trim(),
    expectedVersion: integerFrom(formData.get("expectedVersion"), "Versi gelar"),
    active: formData.get("active") === "true",
  }, actor, new Date());
  revalidateTitles();
  return result;
}

export async function deleteEditionTitleAction(formData: FormData) {
  const { edition, actor } = await getTitleContext();
  const result = await deleteEditionTitle(database, edition.id, {
    titleId: String(formData.get("titleId") ?? "").trim(),
    expectedVersion: integerFrom(formData.get("expectedVersion"), "Versi gelar"),
  }, actor, new Date());
  revalidateTitles();
  return result;
}

export async function assignEditionTitleAction(formData: FormData) {
  const { edition, actor } = await getTitleContext();
  const participantId = String(formData.get("participantId") ?? "").trim();
  const result = await assignEditionTitle(database, edition.id, {
    titleId: String(formData.get("titleId") ?? "").trim(),
    participantId,
    expectedTitleVersion: integerFrom(formData.get("expectedTitleVersion"), "Versi gelar"),
  }, actor, new Date());
  revalidateTitles(participantId);
  return result;
}

export async function unassignEditionTitleAction(formData: FormData) {
  const { edition, actor } = await getTitleContext();
  const participantId = String(formData.get("participantId") ?? "").trim();
  const result = await unassignEditionTitle(database, edition.id, {
    titleId: String(formData.get("titleId") ?? "").trim(),
    participantId,
    expectedTitleVersion: integerFrom(formData.get("expectedTitleVersion"), "Versi gelar"),
  }, actor, new Date());
  revalidateTitles(participantId);
  return result;
}
