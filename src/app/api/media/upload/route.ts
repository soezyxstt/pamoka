import { NextResponse } from "next/server";

import { AuthorizationError, requirePermission } from "@/server/auth/authorization";
import { database } from "@/server/db/client";
import { completeR2Uploads, prepareR2Uploads, R2StorageError } from "@/server/media/r2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { session } = await requirePermission("media.manage");
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || typeof payload.action !== "string") return NextResponse.json({ message: "Aksi unggah tidak valid." }, { status: 422 });

    if (payload.action === "prepare") {
      const files = payload.files;
      const folderId = payload.folderId;
      if (!Array.isArray(files) || (folderId !== null && folderId !== undefined && typeof folderId !== "string")) {
        return NextResponse.json({ message: "Payload persiapan unggah tidak valid." }, { status: 422 });
      }
      const prepared = await prepareR2Uploads(database, {
        kind: typeof payload.kind === "string" ? payload.kind : "",
        files,
        folderId: typeof folderId === "string" ? folderId : null,
        ownerUserId: session.user.id,
        actorLabel: session.user.email,
      });
      return NextResponse.json({ files: prepared });
    }

    if (payload.action === "complete") {
      if (!Array.isArray(payload.assetIds)) return NextResponse.json({ message: "Payload penyelesaian unggah tidak valid." }, { status: 422 });
      const assets = await completeR2Uploads(database, {
        assetIds: payload.assetIds,
        ownerUserId: session.user.id,
        actorLabel: session.user.email,
      });
      return NextResponse.json({ assets });
    }

    return NextResponse.json({ message: "Aksi unggah tidak dikenal." }, { status: 422 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ message: error.message }, { status: error.status });
    if (error instanceof R2StorageError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("R2 media upload failed", error);
    return NextResponse.json({ message: "R2 tidak dapat memproses unggah." }, { status: 502 });
  }
}
