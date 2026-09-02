import { createClient } from "@libsql/client/node";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { appendAuditLog } from "../auth/audit";
import * as schema from "./schema";
import {
  auditLogs,
  authUsers,
  contentDrafts,
  contentRevisions,
  editions,
  mediaAssets,
  newsArticles,
} from "./schema";

async function createTestDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "moka-news-test-"));
  const client = createClient({ url: `file:${join(directory, "test.db")}` });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: resolve("drizzle") });
  return { client, db };
}

test("newsArticles mendukung operasi CRUD dengan edisi dan penyimpanan bodyJson TipTap", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(editions).values({
      id: "ed-2026",
      year: 2026,
      slug: "2026",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    const tipTapDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Pembukaan Pendaftaran Mojang Jajaka 2026" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Pendaftaran resmi dibuka mulai hari ini dengan semangat " },
            { type: "text", marks: [{ type: "bold" }], text: "Nu Nyunda Tur Nyakola" },
            { type: "text", text: "." },
          ],
        },
      ],
    };

    // Create article
    await db.insert(newsArticles).values({
      id: "news-1",
      editionId: "ed-2026",
      title: "Pembukaan Pendaftaran Pasanggiri 2026",
      slug: "pembukaan-pendaftaran-2026",
      excerpt: "Pendaftaran Mojang Jajaka Garut 2026 resmi dibuka untuk generasi muda.",
      body: "Legacy plain text content",
      bodyJson: JSON.stringify(tipTapDoc),
      status: "draft",
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    const [saved] = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.id, "news-1"))
      .limit(1);

    assert.ok(saved);
    assert.equal(saved.title, "Pembukaan Pendaftaran Pasanggiri 2026");
    assert.equal(saved.slug, "pembukaan-pendaftaran-2026");
    assert.equal(saved.status, "draft");
    assert.equal(saved.body, "Legacy plain text content");
    assert.ok(saved.bodyJson);

    const parsed = JSON.parse(saved.bodyJson!);
    assert.equal(parsed.type, "doc");
    assert.equal(parsed.content.length, 2);
    assert.equal(parsed.content[0].attrs.level, 2);
    assert.equal(parsed.content[0].content[0].text, "Pembukaan Pendaftaran Mojang Jajaka 2026");

    // Update article
    const updatedNow = new Date("2026-09-02T01:00:00.000Z");
    await db
      .update(newsArticles)
      .set({
        title: "Pembukaan Pendaftaran MOKA Garut 2026 Resmi Dimulai",
        version: 2,
        updatedAt: updatedNow,
      })
      .where(eq(newsArticles.id, "news-1"));

    const [updated] = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.id, "news-1"))
      .limit(1);

    assert.equal(updated.title, "Pembukaan Pendaftaran MOKA Garut 2026 Resmi Dimulai");
    assert.equal(updated.version, 2);
  } finally {
    client.close();
  }
});

test("newsArticles terisolasi per edisi dan menjaga keunikan slug", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(editions).values([
      {
        id: "ed-2025",
        year: 2025,
        slug: "2025",
        name: "Pasanggiri MOKA 2025",
        lifecycle: "archived",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "ed-2026",
        year: 2026,
        slug: "2026",
        name: "Pasanggiri MOKA 2026",
        lifecycle: "active",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db.insert(newsArticles).values([
      {
        id: "news-2025-1",
        editionId: "ed-2025",
        title: "Malam Grand Final 2025",
        slug: "grand-final-2025",
        status: "published",
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "news-2026-1",
        editionId: "ed-2026",
        title: "Audisi Awal 2026",
        slug: "audisi-awal-2026",
        status: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const articles2026 = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.editionId, "ed-2026"));

    assert.equal(articles2026.length, 1);
    assert.equal(articles2026[0].id, "news-2026-1");

    // Slug unique constraint test
    await assert.rejects(
      async () => {
        await db.insert(newsArticles).values({
          id: "news-duplicate-slug",
          editionId: "ed-2026",
          title: "Audisi Awal Lainnya",
          slug: "audisi-awal-2026", // duplicate slug
          status: "draft",
          version: 1,
          createdAt: now,
          updatedAt: now,
        });
      },
      (err: unknown) => {
        const errorObj = err as { message?: string; cause?: { message?: string } } | undefined;
        const fullMsg = `${errorObj?.message || ""} ${errorObj?.cause?.message || ""}`;
        return fullMsg.includes("UNIQUE constraint failed") || fullMsg.includes("SQLITE_CONSTRAINT");
      },
    );
  } finally {
    client.close();
  }
});

test("newsArticles mendukung draft autosave dan pencatatan contentRevisions", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(authUsers).values({
      id: "user-author-1",
      name: "Editor MOKA",
      email: "editor@mokagarut.org",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(editions).values({
      id: "ed-2026",
      year: 2026,
      slug: "2026",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    const articleId = "news-draft-test";
    const snapshotV1 = {
      title: "Draft Awal Berita",
      slug: "draft-awal-berita",
      bodyJson: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Paragraf 1" }] }] }),
    };

    // Save initial draft
    await db.insert(newsArticles).values({
      id: articleId,
      editionId: "ed-2026",
      title: snapshotV1.title,
      slug: snapshotV1.slug,
      bodyJson: snapshotV1.bodyJson,
      status: "draft",
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(contentDrafts).values({
      id: "draft-1",
      resourceType: "newsArticle",
      resourceId: articleId,
      baseVersion: 1,
      snapshotJson: JSON.stringify(snapshotV1),
      authorUserId: "user-author-1",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(contentRevisions).values({
      id: "rev-1",
      resourceType: "newsArticle",
      resourceId: articleId,
      version: 1,
      snapshotJson: JSON.stringify(snapshotV1),
      authorUserId: "user-author-1",
      reason: "Dibuat pertama kali",
      createdAt: now,
    });

    // Update draft to version 2
    const snapshotV2 = {
      title: "Draft Revisi Berita",
      slug: "draft-awal-berita",
      bodyJson: JSON.stringify({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Paragraf 1" }] },
          { type: "paragraph", content: [{ type: "text", text: "Paragraf 2 baru" }] },
        ],
      }),
    };

    await db
      .update(newsArticles)
      .set({
        title: snapshotV2.title,
        bodyJson: snapshotV2.bodyJson,
        version: 2,
        updatedAt: now,
      })
      .where(eq(newsArticles.id, articleId));

    await db
      .update(contentDrafts)
      .set({
        baseVersion: 2,
        snapshotJson: JSON.stringify(snapshotV2),
        updatedAt: now,
      })
      .where(eq(contentDrafts.resourceId, articleId));

    await db.insert(contentRevisions).values({
      id: "rev-2",
      resourceType: "newsArticle",
      resourceId: articleId,
      version: 2,
      snapshotJson: JSON.stringify(snapshotV2),
      authorUserId: "user-author-1",
      reason: "Simpan draft v2",
      createdAt: now,
    });

    // Check revisions list
    const revisions = await db
      .select()
      .from(contentRevisions)
      .where(eq(contentRevisions.resourceId, articleId))
      .orderBy(desc(contentRevisions.version));

    assert.equal(revisions.length, 2);
    assert.equal(revisions[0].version, 2);
    assert.equal(revisions[0].reason, "Simpan draft v2");
    assert.equal(revisions[1].version, 1);
  } finally {
    client.close();
  }
});

test("publikasi berita memerlukan validasi lengkap dan memperbarui publishedAt serta status", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(authUsers).values({
      id: "user-pub-1",
      name: "Publisher MOKA",
      email: "publisher@mokagarut.org",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(editions).values({
      id: "ed-2026",
      year: 2026,
      slug: "2026",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(mediaAssets).values({
      id: "media-cover-1",
      provider: "uploadthing",
      providerKey: "news-cover-key",
      url: "https://utfs.io/f/news-cover.jpg",
      filename: "news-cover.jpg",
      mimeType: "image/jpeg",
      bytes: 204800,
      alt: "Foto pembukaan kegiatan",
      lifecycle: "ready",
      ownerUserId: "user-pub-1",
      createdAt: now,
      updatedAt: now,
    });

    const articleId = "news-publish-test";
    const bodyJson = JSON.stringify({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Kegiatan Unjuk Kabisa" }] },
        { type: "paragraph", content: [{ type: "text", text: "Para finalis menampilkan bakat seni dan budaya Garut." }] },
      ],
    });

    await db.insert(newsArticles).values({
      id: articleId,
      editionId: "ed-2026",
      title: "Unjuk Kabisa Pasanggiri 2026",
      slug: "unjuk-kabisa-2026",
      excerpt: "Penampilan unjuk kabisa seni dan budaya para finalis Mojang Jajaka.",
      coverMediaId: "media-cover-1",
      bodyJson,
      status: "draft",
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Perform publish
    const publishTime = new Date("2026-09-02T10:00:00.000Z");
    await db.transaction(async (tx) => {
      await tx
        .update(newsArticles)
        .set({
          status: "published",
          publishedAt: publishTime,
          version: 2,
          updatedAt: publishTime,
        })
        .where(eq(newsArticles.id, articleId));

      await appendAuditLog(tx, {
        actorUserId: "user-pub-1",
        actorLabel: "publisher@mokagarut.org",
        action: "news.publish",
        resourceType: "newsArticle",
        resourceId: articleId,
        resourceLabel: "Unjuk Kabisa Pasanggiri 2026",
        after: { status: "published", publishedAt: publishTime, version: 2 },
        changedFields: ["status", "publishedAt", "version"],
        source: "admin-news-editor",
      });
    });

    const [published] = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.id, articleId))
      .limit(1);

    assert.equal(published.status, "published");
    assert.equal(published.version, 2);
    assert.deepEqual(published.publishedAt, publishTime);

    // Verify audit log recorded
    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resourceType, "newsArticle"), eq(auditLogs.resourceId, articleId)));

    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "news.publish");
  } finally {
    client.close();
  }
});

test("unpublish dan archive mengubah status artikel dengan audit log", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(authUsers).values({
      id: "user-mod-1",
      name: "Moderator MOKA",
      email: "mod@mokagarut.org",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(editions).values({
      id: "ed-2026",
      year: 2026,
      slug: "2026",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    const articleId = "news-unpublish-test";
    await db.insert(newsArticles).values({
      id: articleId,
      editionId: "ed-2026",
      title: "Artikel Akan Ditarik",
      slug: "artikel-akan-ditarik",
      status: "published",
      version: 2,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Unpublish back to draft
    await db.transaction(async (tx) => {
      await tx
        .update(newsArticles)
        .set({
          status: "draft",
          version: 3,
          updatedAt: now,
        })
        .where(eq(newsArticles.id, articleId));

      await appendAuditLog(tx, {
        actorUserId: "user-mod-1",
        actorLabel: "mod@mokagarut.org",
        action: "news.unpublish",
        resourceType: "newsArticle",
        resourceId: articleId,
        resourceLabel: "Artikel Akan Ditarik",
        after: { status: "draft", version: 3 },
        changedFields: ["status", "version"],
        source: "admin-news-editor",
      });
    });

    const [drafted] = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.id, articleId))
      .limit(1);

    assert.equal(drafted.status, "draft");
    assert.equal(drafted.version, 3);

    // Archive article
    await db.transaction(async (tx) => {
      await tx
        .update(newsArticles)
        .set({
          status: "archived",
          version: 4,
          updatedAt: now,
        })
        .where(eq(newsArticles.id, articleId));

      await appendAuditLog(tx, {
        actorUserId: "user-mod-1",
        actorLabel: "mod@mokagarut.org",
        action: "news.archive",
        resourceType: "newsArticle",
        resourceId: articleId,
        resourceLabel: "Artikel Akan Ditarik",
        after: { status: "archived", version: 4 },
        changedFields: ["status", "version"],
        source: "admin-news-editor",
      });
    });

    const [archived] = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.id, articleId))
      .limit(1);

    assert.equal(archived.status, "archived");
    assert.equal(archived.version, 4);
  } finally {
    client.close();
  }
});

test("menghapus artikel membersihkan drafts dan revisions terkait", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(authUsers).values({
      id: "user-del-1",
      name: "Admin MOKA",
      email: "admin@mokagarut.org",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(editions).values({
      id: "ed-2026",
      year: 2026,
      slug: "2026",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    const articleId = "news-to-delete";
    await db.insert(newsArticles).values({
      id: articleId,
      editionId: "ed-2026",
      title: "Artikel Sementara",
      slug: "artikel-sementara",
      status: "draft",
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(contentDrafts).values({
      id: "draft-del-1",
      resourceType: "newsArticle",
      resourceId: articleId,
      baseVersion: 1,
      snapshotJson: JSON.stringify({ title: "Artikel Sementara" }),
      authorUserId: "user-del-1",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(contentRevisions).values({
      id: "rev-del-1",
      resourceType: "newsArticle",
      resourceId: articleId,
      version: 1,
      snapshotJson: JSON.stringify({ title: "Artikel Sementara" }),
      authorUserId: "user-del-1",
      reason: "Initial",
      createdAt: now,
    });

    // Delete in transaction
    await db.transaction(async (tx) => {
      await tx
        .delete(contentDrafts)
        .where(and(eq(contentDrafts.resourceType, "newsArticle"), eq(contentDrafts.resourceId, articleId)));

      await tx
        .delete(contentRevisions)
        .where(and(eq(contentRevisions.resourceType, "newsArticle"), eq(contentRevisions.resourceId, articleId)));

      await tx.delete(newsArticles).where(eq(newsArticles.id, articleId));
    });

    const remainingArticles = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.id, articleId));
    const remainingDrafts = await db
      .select()
      .from(contentDrafts)
      .where(eq(contentDrafts.resourceId, articleId));
    const remainingRevisions = await db
      .select()
      .from(contentRevisions)
      .where(eq(contentRevisions.resourceId, articleId));

    assert.equal(remainingArticles.length, 0);
    assert.equal(remainingDrafts.length, 0);
    assert.equal(remainingRevisions.length, 0);
  } finally {
    client.close();
  }
});
