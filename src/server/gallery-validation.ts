export function normalizeYoutubeId(value?: string | null) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const match = raw.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
  );
  const id = match?.[1] ?? raw;
  if (!/^[\w-]{11}$/.test(id)) {
    throw new Error("Format ID YouTube tidak valid");
  }
  return id;
}

export function assertCompleteGalleryItemOrder(inputIds: string[], existingIds: string[]) {
  const uniqueInputIds = new Set(inputIds);
  const existingIdSet = new Set(existingIds);
  if (
    uniqueInputIds.size !== inputIds.length ||
    inputIds.length !== existingIds.length ||
    inputIds.some((id) => !existingIdSet.has(id))
  ) {
    throw new Error("Urutan item tidak lengkap. Silakan muat ulang.");
  }
}
