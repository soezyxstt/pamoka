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
      provider: "uploadthing",
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
        provider: "uploadthing",
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
        provider: "uploadthing",
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
        provider: "uploadthing",
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
