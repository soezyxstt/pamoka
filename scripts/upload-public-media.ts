import "dotenv/config";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client/node";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "@/server/db/schema";

const mime: Record<string, string> = {
  ".avif": "image/avif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};
const limits: Record<string, number> = {
  "image/avif": 20 * 1024 * 1024,
  "image/jpeg": 20 * 1024 * 1024,
  "image/png": 20 * 1024 * 1024,
  "image/webp": 20 * 1024 * 1024,
  "video/mp4": 512 * 1024 * 1024,
  "video/webm": 512 * 1024 * 1024,
  "application/pdf": 64 * 1024 * 1024,
};

const stableId = (value: string) => `import-${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;

async function walk(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else result.push(file);
  }
  return result;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} belum diisi`);
  return value;
}

function publicUrl(baseUrl: string, key: string) {
  return `${baseUrl}/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function objectKey(relative: string) {
  const filename = path.basename(relative).replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `imports/public-2025/${stableId(relative)}-${filename}`;
}

async function existsInR2(client: S3Client, bucket: string, key: string) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NotFound" || name === "NoSuchKey" || name === "NotFoundException") return false;
    throw error;
  }
}

async function main() {
  const url = requiredEnv("TURSO_DATABASE_URL");
  const authToken = requiredEnv("TURSO_AUTH_TOKEN");
  const endpoint = requiredEnv("R2_ENDPOINT");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requiredEnv("R2_BUCKET");
  const deliveryUrl = requiredEnv("R2_PUBLIC_URL").replace(/\/$/, "");
  const region = process.env.R2_REGION?.trim() || "auto";
  const host = new URL(url).host;
  const confirm = process.argv[process.argv.indexOf("--confirm-host") + 1];
  if (confirm !== host) throw new Error(`Gunakan --confirm-host ${host}`);

  const client = createClient({ url, authToken });
  const db = drizzle(client, { schema });
  const storage = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    const all = (await walk("public")).filter((file) => mime[path.extname(file).toLowerCase()]);
    let uploaded = 0;
    let skipped = 0;
    let reconciled = 0;
    let failed = 0;
    for (let offset = 0; offset < all.length; offset++) {
      const file = all[offset];
      const relative = "/" + path.relative("public", file).replaceAll("\\", "/");
      const mimeType = mime[path.extname(file).toLowerCase()];
      const info = await stat(file);
      if (!mimeType || !limits[mimeType] || info.size > limits[mimeType]) {
        failed++;
        console.error(`MEDIA_LIMIT_EXCEEDED ${relative}`);
        continue;
      }
      if (await db.query.mediaAssets.findFirst({ where: eq(schema.mediaAssets.filename, relative) })) {
        skipped++;
        continue;
      }

      const id = stableId(`media:${relative}`);
      const key = objectKey(relative);
      const url = publicUrl(deliveryUrl, key);
      try {
        if (!(await existsInR2(storage, bucket, key))) {
          console.log(JSON.stringify({ uploading: relative, progress: offset + 1, total: all.length }));
          await storage.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: await readFile(file),
            ContentType: mimeType,
            ContentLength: info.size,
          }));
          uploaded++;
        } else {
          reconciled++;
        }
        await db.insert(schema.mediaAssets).values({
          id,
          provider: "r2",
          providerKey: key,
          url,
          filename: relative,
          mimeType,
          bytes: info.size,
          alt: path.basename(relative, path.extname(relative)).replaceAll(/[_-]+/g, " "),
          lifecycle: "ready",
        }).onConflictDoNothing();
        console.log(JSON.stringify({ progress: offset + 1, total: all.length, uploaded, skipped, reconciled, failed, file: relative, provider: "r2" }));
      } catch (error) {
        failed++;
        console.error(`R2_UPLOAD_FAILED ${relative} ${error instanceof Error ? error.message : "unknown"}`);
      }
    }
    if (failed) throw new Error(`${failed} media gagal diproses`);
    await db.insert(schema.auditLogs).values({
      id: stableId("audit:media-import:2025:r2:v1"),
      actorLabel: "system:cms-import",
      action: "media.import.complete",
      resourceType: "mediaLibrary",
      resourceId: "public-2025",
      resourceLabel: "Public media 2025",
      afterJson: JSON.stringify({ total: all.length, uploaded, skipped, reconciled }),
      changedFieldsJson: JSON.stringify(["assets"]),
      source: "production-import",
      reason: "Operator authorized R2 production import.",
    }).onConflictDoNothing();
    console.log(JSON.stringify({ complete: true, total: all.length, uploaded, skipped, reconciled }, null, 2));
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Import media gagal");
  process.exitCode = 1;
});
