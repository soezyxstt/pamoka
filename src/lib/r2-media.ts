import { parseUploadedMediaIdentity, type UploadedMediaIdentity } from "@/server/media/upload-validation";

type UploadKind = "image" | "video" | "pdf";

type PreparedFile = {
  assetId: string;
  url: string;
  headers: Record<string, string>;
};

async function readJson(response: Response) {
  return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

function responseMessage(payload: Record<string, unknown> | null) {
  return typeof payload?.message === "string" ? payload.message : null;
}

export async function uploadR2MediaFiles(kind: UploadKind, files: File[], folderId: string | null): Promise<UploadedMediaIdentity[]> {
  const prepareResponse = await fetch("/api/media/upload", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "prepare",
      kind,
      folderId,
      files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
    }),
  });
  const preparePayload = await readJson(prepareResponse);
  if (!prepareResponse.ok || !Array.isArray(preparePayload?.files)) throw new Error(responseMessage(preparePayload) ?? "Pendaftaran unggah ditolak.");
  const prepared = preparePayload.files as PreparedFile[];
  if (prepared.length !== files.length || prepared.some((item) => typeof item?.assetId !== "string" || typeof item?.url !== "string" || typeof item?.headers !== "object")) {
    throw new Error("Respons URL unggah tidak lengkap.");
  }

  for (const [index, item] of prepared.entries()) {
    const file = files[index];
    if (!file) throw new Error("Urutan file unggah tidak valid.");
    const uploadResponse = await fetch(item.url, { method: "PUT", headers: item.headers, body: file });
    if (!uploadResponse.ok) throw new Error(`Unggah ${file.name} ke R2 gagal.`);
  }

  const completeResponse = await fetch("/api/media/upload", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete", assetIds: prepared.map((item) => item.assetId) }),
  });
  const completePayload = await readJson(completeResponse);
  if (!completeResponse.ok || !Array.isArray(completePayload?.assets)) throw new Error(responseMessage(completePayload) ?? "Verifikasi unggah R2 gagal.");
  const identities = completePayload.assets
    .map((asset) => parseUploadedMediaIdentity(asset))
    .filter((asset): asset is UploadedMediaIdentity => asset !== null);
  if (identities.length !== completePayload.assets.length) throw new Error("Identitas aset R2 belum lengkap.");

  return identities;
}
