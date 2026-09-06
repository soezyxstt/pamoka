"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/authorization";
import { database } from "@/server/db/client";
import { getAdminEditionContext } from "@/server/cms/context";
import {
  closeVotingCampaign,
  createVotingCampaign,
  saveVotingTally,
  setVotingResultVisibility,
  startVotingCampaign,
  updateVotingCampaignStage,
} from "@/server/voting-operations";

function parseWibDateTime(value: FormDataEntryValue | null) {
  const raw = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return new Date(Number.NaN);
  return new Date(`${raw}:00+07:00`);
}

function actorFromSession(actor: Awaited<ReturnType<typeof requirePermission>>) {
  return { userId: actor.session.user.id, label: actor.session.user.email };
}

async function requireEditionId() {
  const edition = await getAdminEditionContext();
  if (!edition) throw new Error("Konteks edisi aktif tidak ditemukan");
  return edition.id;
}

export async function createCampaignAction(formData: FormData) {
  const actor = await requirePermission("voting.manage");
  const editionId = await requireEditionId();
  await createVotingCampaign(
    database,
    editionId,
    {
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      eligibilityStageId: String(formData.get("eligibilityStageId") ?? ""),
      startsAt: parseWibDateTime(formData.get("startsAt")),
      endsAt: parseWibDateTime(formData.get("endsAt")),
      pricePerPoint: Number(formData.get("pricePerPoint")),
    },
    actorFromSession(actor),
    new Date(),
  );
  revalidatePath("/admin");
  revalidatePath("/admin/voting");
}

export async function updateCampaignStageAction(input: {
  campaignId: string;
  stageId: string;
  expectedVersion: number;
}) {
  const actor = await requirePermission("voting.manage");
  const editionId = await requireEditionId();
  const result = await updateVotingCampaignStage(
    database,
    editionId,
    input,
    actorFromSession(actor),
    new Date(),
  );
  revalidatePath("/admin/voting");
  return result;
}

export async function startCampaignAction(input: {
  campaignId: string;
  expectedVersion: number;
  confirmation: string;
  reason: string;
}) {
  const actor = await requirePermission("voting.manage");
  const editionId = await requireEditionId();
  const result = await startVotingCampaign(
    database,
    editionId,
    input,
    actorFromSession(actor),
    new Date(),
  );
  revalidatePath("/admin");
  revalidatePath("/admin/voting");
  return result;
}

export async function closeCampaignAction(input: {
  campaignId: string;
  expectedVersion: number;
  confirmation: string;
  reason: string;
}) {
  const actor = await requirePermission("voting.manage");
  const editionId = await requireEditionId();
  const result = await closeVotingCampaign(
    database,
    editionId,
    input,
    actorFromSession(actor),
    new Date(),
  );
  revalidatePath("/admin");
  revalidatePath("/admin/voting");
  return result;
}

export async function setResultVisibilityAction(input: {
  campaignId: string;
  expectedVersion: number;
  visibility: "hidden" | "visible";
  reason: string;
}) {
  const actor = await requirePermission("voting.manage");
  const editionId = await requireEditionId();
  const result = await setVotingResultVisibility(
    database,
    editionId,
    input,
    actorFromSession(actor),
    new Date(),
  );
  revalidatePath("/admin/voting");
  return result;
}

export async function saveTallyAction(formData: FormData) {
  const actor = await requirePermission("voting.tally");
  const editionId = await requireEditionId();
  await saveVotingTally(
    database,
    editionId,
    {
      campaignId: String(formData.get("campaignId") ?? ""),
      participantId: String(formData.get("participantId") ?? ""),
      localDate: String(formData.get("localDate") ?? ""),
      amount: Number(formData.get("amount")),
      expectedVersion: Number(formData.get("version") ?? 0),
      reason: String(formData.get("reason") ?? ""),
    },
    actorFromSession(actor),
    new Date(),
  );
  revalidatePath("/admin/voting");
}
