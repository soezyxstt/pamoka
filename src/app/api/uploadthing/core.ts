import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/server/auth/config";
import { getEffectivePermissions } from "@/server/auth/authorization";
import { database } from "@/server/db/client";
import { mediaFolders } from "@/server/db/schema";
import { isAllowedMediaMimeType, mediaPolicy } from "@/server/media/policy";
import { persistUploadedMediaAsset } from "@/server/media/persistence";

const f = createUploadthing();
const folderInput = z.object({ folderId: z.string().uuid().nullable().optional() });
type UploadKind = "image" | "video" | "pdf";

function acceptsKind(mimeType: string, kind: UploadKind) {
  return isAllowedMediaMimeType(kind, mimeType);
}

const createRoute = (config: Parameters<typeof f>[0], kind: UploadKind) => f(config)
  .input(folderInput)
  .middleware(async ({ req, files, input }) => {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) throw new UploadThingError("Unauthorized");
    const permissions = await getEffectivePermissions(session.user.id);
    if (!permissions.has("media.manage")) throw new UploadThingError("Forbidden");
    if (files.some((file) => !acceptsKind(file.type, kind))) {
      throw new UploadThingError("Jenis file tidak sesuai dengan jalur unggah");
    }
    if (kind === "image" && files.some((file) => file.size > mediaPolicy.image.applicationMaxBytes)) {
      throw new UploadThingError("Ukuran gambar maksimal 20 MB");
    }
    const folderId = input.folderId ?? null;
    if (folderId) {
      const [folder] = await database.select({ id: mediaFolders.id }).from(mediaFolders).where(eq(mediaFolders.id, folderId)).limit(1);
      if (!folder) throw new UploadThingError("Folder media tidak ditemukan");
    }
    return { userId: session.user.id, email: session.user.email, kind, folderId };
  })
  .onUploadComplete(async ({ metadata, file }) => {
    return persistUploadedMediaAsset(database, {
      provider: "uploadthing",
      providerKey: file.key,
      url: file.ufsUrl,
      filename: file.name,
      mimeType: file.type,
      bytes: file.size,
      folderId: metadata.folderId,
      ownerUserId: metadata.userId,
      actorLabel: metadata.email,
      kind: metadata.kind as UploadKind,
    });
  });

export const uploadRouter = {
  image: createRoute({ image: { maxFileSize: mediaPolicy.image.maxFileSize, maxFileCount: mediaPolicy.image.maxFileCount } }, "image"),
  video: createRoute({ video: { maxFileSize: mediaPolicy.video.maxFileSize, maxFileCount: mediaPolicy.video.maxFileCount } }, "video"),
  pdf: createRoute({ pdf: { maxFileSize: mediaPolicy.pdf.maxFileSize, maxFileCount: mediaPolicy.pdf.maxFileCount } }, "pdf"),
} satisfies FileRouter;
export type UploadRouter = typeof uploadRouter;
