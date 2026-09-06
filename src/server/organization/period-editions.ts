export type PeriodEditionCandidate = {
  id: string;
  name: string;
  year: number;
  organizationPeriodId: string | null;
  version: number;
};

export function validatePeriodEditionSelection(
  editions: PeriodEditionCandidate[],
  periodId: string,
  selectedEditionIds: string[],
  confirmedReassignmentIds: string[]
) {
  const editionById = new Map(editions.map((edition) => [edition.id, edition]));
  const selectedIds = new Set(selectedEditionIds);
  const confirmedIds = new Set(confirmedReassignmentIds);
  const missingEditionIds = selectedEditionIds.filter((id) => !editionById.has(id));
  if (missingEditionIds.length > 0) {
    throw new Error("Satu atau beberapa edisi tidak ditemukan");
  }

  const selectedEditions = selectedEditionIds.map((id) => editionById.get(id)!);
  const conflicts = selectedEditions.filter(
    (edition) =>
      edition.organizationPeriodId !== null && edition.organizationPeriodId !== periodId
  );
  const conflictIds = new Set(conflicts.map((edition) => edition.id));
  const missingConfirmations = conflicts.filter((edition) => !confirmedIds.has(edition.id));
  if (missingConfirmations.length > 0) {
    const labels = missingConfirmations.map((edition) => `${edition.name} (${edition.year})`).join(", ");
    throw new Error(`Konfirmasi pemindahan diperlukan untuk ${labels}`);
  }

  if (confirmedReassignmentIds.some((id) => !selectedIds.has(id) || !conflictIds.has(id))) {
    throw new Error("Konfirmasi pemindahan tidak sesuai data terkini. Silakan muat ulang halaman.");
  }

  return { selectedEditions, conflicts };
}
