import { createClient } from "@libsql/client/node";
import { and, eq, isNull, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { appendAuditLog } from "../auth/audit";
import { listMediaAssets } from "../media/queries";
import { persistUploadedMediaAsset } from "../media/persistence";
import { mediaSizeLabel, parseUploadedMediaIdentity, validateMediaFiles } from "../media/upload-validation";
import { auditLogs, authUsers, editions, mediaAssets, mediaFolders } from "./schema";
import * as schema from "./schema";

async function createTestDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "moka-media-test-"));
  const client = createClient({ url: `file:${join(directory, "test.db")}` });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: resolve("drizzle") });
  return { client, db };
}

test("mediaFolders mendukung editionId untuk folder edisi dan null untuk folder global", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");
    await db.insert(editions).values({
      id: "ed-2025",
      year: 2025,
      slug: "2025",
      name: "Pasanggiri 2025",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    // Insert global folder
    await db.insert(mediaFolders).values({
      id: "folder-global",
      name: "Brand Global",
      slug: "brand-global",
      editionId: null,
      createdAt: now,
      updatedAt: now,
    });

    // Insert edition-scoped folder
    await db.insert(mediaFolders).values({
      id: "folder-2025-finalis",
      name: "Finalis 2025",
      slug: "finalis-2025",
      editionId: "ed-2025",
      createdAt: now,
      updatedAt: now,
    });

    const globalFolder = await db.query.mediaFolders.findFirst({
      where: eq(mediaFolders.id, "folder-global"),
    });
    assert.ok(globalFolder);
    assert.equal(globalFolder.editionId, null);
    assert.equal(globalFolder.name, "Brand Global");

    const editionFolder = await db.query.mediaFolders.findFirst({
      where: eq(mediaFolders.id, "folder-2025-finalis"),
    });
    assert.ok(editionFolder);
    assert.equal(editionFolder.editionId, "ed-2025");
    assert.equal(editionFolder.name, "Finalis 2025");
  } finally {
    client.close();
  }
});

test("update metadata mediaAsset memperbarui alt dan decorative secara transaksional dengan audit log", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");
    await db.insert(authUsers).values({
      id: "user-1",
      name: "Admin Pamoka",
      email: "admin@pamoka.id",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(mediaAssets).values({
      id: "asset-1",
      provider: "r2",
      providerKey: "key-1",
      url: "https://example.com/photo.webp",
      filename: "photo.webp",
      mimeType: "image/webp",
      bytes: 204800,
      alt: "Foto awal",
      decorative: false,
      lifecycle: "ready",
      createdAt: now,
      updatedAt: now,
    });

    // Update metadata to decorative: true
    await db.transaction(async (tx) => {
      const [before] = await tx.select().from(mediaAssets).where(eq(mediaAssets.id, "asset-1")).limit(1);
      assert.ok(before);

      const after = { alt: null, decorative: true };
      await tx.update(mediaAssets).set({ ...after, updatedAt: new Date() }).where(eq(mediaAssets.id, "asset-1"));

      await appendAuditLog(tx, {
        actorUserId: "user-1",
        actorLabel: "admin@pamoka.id",
        action: "media.asset.metadata.update",
        resourceType: "mediaAsset",
        resourceId: "asset-1",
        resourceLabel: before.filename,
        before: { alt: before.alt, decorative: before.decorative },
        after,
        changedFields: ["alt", "decorative"],
        source: "admin-media",
      });
    });

    const updated = await db.query.mediaAssets.findFirst({
      where: eq(mediaAssets.id, "asset-1"),
    });
    assert.ok(updated);
    assert.equal(updated.alt, null);
    assert.equal(updated.decorative, true);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, "asset-1"));
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.action, "media.asset.metadata.update");
    assert.equal(logs[0]?.actorLabel, "admin@pamoka.id");
  } finally {
    client.close();
  }
});

test("filter query media asset membedakan jenis MIME dan folder", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");
    await db.insert(mediaFolders).values({
      id: "f-1",
      name: "Galeri",
      slug: "galeri",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(mediaAssets).values([
      {
        id: "img-1",
        provider: "r2",
        url: "https://example.com/img1.jpg",
        filename: "img1.jpg",
        mimeType: "image/jpeg",
        bytes: 1000,
        lifecycle: "ready",
        folderId: "f-1",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "vid-1",
        provider: "r2",
        url: "https://example.com/video.mp4",
        filename: "video.mp4",
        mimeType: "video/mp4",
        bytes: 50000,
        lifecycle: "ready",
        folderId: "f-1",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "pdf-1",
        provider: "r2",
        url: "https://example.com/doc.pdf",
        filename: "doc.pdf",
        mimeType: "application/pdf",
        bytes: 20000,
        lifecycle: "ready",
        folderId: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Image filter
    const images = await db.select().from(mediaAssets).where(and(eq(mediaAssets.lifecycle, "ready"), like(mediaAssets.mimeType, "image/%")));
    assert.equal(images.length, 1);
    assert.equal(images[0]?.id, "img-1");

    // Video filter
    const videos = await db.select().from(mediaAssets).where(and(eq(mediaAssets.lifecycle, "ready"), like(mediaAssets.mimeType, "video/%")));
    assert.equal(videos.length, 1);
    assert.equal(videos[0]?.id, "vid-1");

    // PDF filter
    const pdfs = await db.select().from(mediaAssets).where(and(eq(mediaAssets.lifecycle, "ready"), eq(mediaAssets.mimeType, "application/pdf")));
    assert.equal(pdfs.length, 1);
    assert.equal(pdfs[0]?.id, "pdf-1");

    // Root folder filter
    const rootAssets = await db.select().from(mediaAssets).where(and(eq(mediaAssets.lifecycle, "ready"), isNull(mediaAssets.folderId)));
    assert.equal(rootAssets.length, 1);
    assert.equal(rootAssets[0]?.id, "pdf-1");
  } finally {
    client.close();
  }
});

test("listMediaAssets menerapkan scope edisi dan pagination di query production", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const base = new Date("2026-09-02T00:00:00.000Z");
    const date = (minutes: number) => new Date(base.getTime() + minutes * 60_000);

    await db.insert(editions).values([
      { id: "ed-2024", year: 2024, slug: "2024", name: "Pasanggiri 2024", lifecycle: "archived", createdAt: base, updatedAt: base },
      { id: "ed-2025", year: 2025, slug: "2025", name: "Pasanggiri 2025", lifecycle: "active", createdAt: base, updatedAt: base },
    ]);
    await db.insert(mediaFolders).values([
      { id: "folder-global", name: "Brand", slug: "brand", editionId: null, createdAt: base, updatedAt: base },
      { id: "folder-2024", name: "2024", slug: "2024", editionId: "ed-2024", createdAt: base, updatedAt: base },
      { id: "folder-2025", name: "2025", slug: "2025", editionId: "ed-2025", createdAt: base, updatedAt: base },
    ]);
    await db.insert(mediaAssets).values([
      { id: "asset-root", provider: "r2", providerKey: "key-root", url: "https://example.com/root.webp", filename: "root.webp", mimeType: "image/webp", bytes: 1, lifecycle: "ready", folderId: null, createdAt: date(1), updatedAt: date(1) },
      { id: "asset-global", provider: "r2", providerKey: "key-global", url: "https://example.com/global.webp", filename: "global.webp", mimeType: "image/webp", bytes: 1, lifecycle: "ready", folderId: "folder-global", createdAt: date(2), updatedAt: date(2) },
      { id: "asset-2024", provider: "r2", providerKey: "key-2024", url: "https://example.com/2024.webp", filename: "2024.webp", mimeType: "image/webp", bytes: 1, lifecycle: "ready", folderId: "folder-2024", createdAt: date(3), updatedAt: date(3) },
      { id: "asset-2025-new", provider: "r2", providerKey: "key-2025-new", url: "https://example.com/2025-new.webp", filename: "2025-new.webp", mimeType: "image/webp", bytes: 1, lifecycle: "ready", folderId: "folder-2025", createdAt: date(4), updatedAt: date(4) },
      { id: "asset-2025-old", provider: "r2", providerKey: "key-2025-old", url: "https://example.com/2025-old.webp", filename: "2025-old.webp", mimeType: "image/webp", bytes: 1, lifecycle: "ready", folderId: "folder-2025", createdAt: date(0), updatedAt: date(0) },
      { id: "asset-2025-video", provider: "r2", providerKey: "key-2025-video", url: "https://example.com/2025.mp4", filename: "2025.mp4", mimeType: "video/mp4", bytes: 1, lifecycle: "ready", folderId: "folder-2025", createdAt: date(5), updatedAt: date(5) },
      { id: "asset-2025-draft", provider: "r2", providerKey: "key-2025-draft", url: "https://example.com/2025-draft.webp", filename: "2025-draft.webp", mimeType: "image/webp", bytes: 1, lifecycle: "draft", folderId: "folder-2025", createdAt: date(6), updatedAt: date(6) },
    ]);

    const firstPage = await listMediaAssets(db, { folderScope: "edition", editionId: "ed-2025", type: "image", limit: 1, page: 0 });
    assert.equal(firstPage.total, 2);
    assert.equal(firstPage.hasMore, true);
    assert.deepEqual(firstPage.assets.map((asset) => asset.id), ["asset-2025-new"]);

    const secondPage = await listMediaAssets(db, { folderScope: "edition", editionId: "ed-2025", type: "image", limit: 1, page: 1 });
    assert.equal(secondPage.hasMore, false);
    assert.deepEqual(secondPage.assets.map((asset) => asset.id), ["asset-2025-old"]);

    const globalScope = await listMediaAssets(db, { folderScope: "global", editionId: "ed-2025", limit: 10 });
    assert.deepEqual(new Set(globalScope.assets.map((asset) => asset.id)), new Set(["asset-root", "asset-global"]));

    const selectedOutsideBrowse = await listMediaAssets(db, {
      folderScope: "edition",
      editionId: "ed-2025",
      type: "image",
      limit: 1,
      assetIds: ["asset-global"],
    });
    assert.deepEqual(selectedOutsideBrowse.assets.map((asset) => asset.id), ["asset-2025-new"]);
    assert.deepEqual(selectedOutsideBrowse.selectedAssets.map((asset) => asset.id), ["asset-global"]);

    const searched = await listMediaAssets(db, {
      folderScope: "edition",
      editionId: "ed-2025",
      type: "image",
      search: "old",
      page: -1,
      limit: 0,
    });
    assert.equal(searched.page, 0);
    assert.equal(searched.limit, 50);
    assert.equal(searched.total, 1);
    assert.deepEqual(searched.assets.map((asset) => asset.id), ["asset-2025-old"]);

    const videos = await listMediaAssets(db, { folderScope: "edition", editionId: "ed-2025", type: "video", limit: 10 });
    assert.deepEqual(videos.assets.map((asset) => asset.id), ["asset-2025-video"]);

    const nonReadySelected = await listMediaAssets(db, {
      folderScope: "edition",
      editionId: "ed-2025",
      type: "image",
      limit: 10,
      assetIds: ["asset-2025-draft"],
    });
    assert.equal(nonReadySelected.total, 2);
    assert.deepEqual(nonReadySelected.selectedAssets, []);

    const noEditionScope = await listMediaAssets(db, { folderScope: "edition", editionId: null, limit: 10 });
    assert.equal(noEditionScope.total, 0);
  } finally {
    client.close();
  }
});

test("persistUploadedMediaAsset mengembalikan identitas stabil dan audit hanya sekali saat callback diulang", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");
    await db.insert(authUsers).values({
      id: "upload-user",
      name: "Media Admin",
      email: "media-admin@pamoka.id",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    const input = {
      provider: "r2" as const,
      providerKey: "ut-key-1",
      url: "https://media.pamoka.test/f/photo.webp",
      filename: "photo.webp",
      mimeType: "image/webp",
      bytes: 2048,
      folderId: null,
      ownerUserId: "upload-user",
      actorLabel: "media-admin@pamoka.id",
      kind: "image" as const,
    };
    const first = await persistUploadedMediaAsset(db, input);
    const second = await persistUploadedMediaAsset(db, input);

    assert.equal(first.mediaAssetId, second.mediaAssetId);
    assert.equal(first.providerKey, "ut-key-1");
    assert.equal(first.url, input.url);
    const assets = await db.select().from(mediaAssets).where(eq(mediaAssets.providerKey, input.providerKey));
    assert.equal(assets.length, 1);
    assert.equal(assets[0]?.id, first.mediaAssetId);
    assert.equal(assets[0]?.lifecycle, "ready");
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, first.mediaAssetId));
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.action, "media.upload.complete");
  } finally {
    client.close();
  }
});

test("validasi upload production menerapkan MIME dan cap finite untuk semua tipe media", () => {
  const image = validateMediaFiles([
    { name: "ok.webp", type: "image/webp", size: 1024 },
    { name: "bad.pdf", type: "application/pdf", size: 1024 },
    { name: "large.webp", type: "image/webp", size: 20 * 1024 * 1024 + 1 },
    { name: "empty.webp", type: "image/webp", size: 0 },
  ], "image");
  assert.deepEqual(image.accepted.map((file) => file.name), ["ok.webp"]);
  assert.deepEqual(image.rejected.map((item) => [item.file.name, item.reason]), [["bad.pdf", "mime"], ["large.webp", "size"], ["empty.webp", "size"]]);

  const video = validateMediaFiles([
    { name: "ok.mp4", type: "video/mp4", size: 512 * 1024 * 1024 },
    { name: "large.mp4", type: "video/mp4", size: 512 * 1024 * 1024 + 1 },
    { name: "nan.mp4", type: "video/mp4", size: Number.NaN },
    { name: "infinity.mp4", type: "video/mp4", size: Number.POSITIVE_INFINITY },
  ], "video");
  assert.deepEqual(video.accepted.map((file) => file.name), ["ok.mp4"]);
  assert.deepEqual(video.rejected.map((item) => [item.file.name, item.reason]), [["large.mp4", "size"], ["nan.mp4", "size"], ["infinity.mp4", "size"]]);

  const pdf = validateMediaFiles([
    { name: "ok.pdf", type: "application/pdf", size: 64 * 1024 * 1024 },
    { name: "large.pdf", type: "application/pdf", size: 64 * 1024 * 1024 + 1 },
  ], "pdf");
  assert.deepEqual(pdf.accepted.map((file) => file.name), ["ok.pdf"]);
  assert.deepEqual(pdf.rejected.map((item) => [item.file.name, item.reason]), [["large.pdf", "size"]]);

  const capped = validateMediaFiles(Array.from({ length: 11 }, (_, index) => ({ name: `image-${index}.webp`, type: "image/webp", size: 100 })), "image");
  assert.equal(capped.accepted.length, 10);
  assert.deepEqual(capped.truncated.map((file) => file.name), ["image-10.webp"]);
  assert.equal(mediaSizeLabel("pdf"), "64 MB");

  assert.deepEqual(parseUploadedMediaIdentity({ mediaAssetId: "asset-1", provider: "r2", providerKey: "key-1", url: " https://media.pamoka.test/f/asset-1 " }), {
    mediaAssetId: "asset-1",
    provider: "r2",
    providerKey: "key-1",
    url: "https://media.pamoka.test/f/asset-1",
  });
  assert.equal(parseUploadedMediaIdentity({ mediaAssetId: "", provider: "r2", providerKey: "key-1", url: "https://media.pamoka.test/f/asset-1" }), null);
  assert.equal(parseUploadedMediaIdentity({ mediaAssetId: "asset-1", provider: "other", providerKey: "key-1", url: "https://example.com/asset-1" }), null);
});
