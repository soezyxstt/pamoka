"use server";

import { and, desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/server/auth/audit";
import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { database } from "@/server/db/client";
import {
  contentDrafts,
  contentRevisions,
  mediaAssets,
  newsArticles,
} from "@/server/db/schema";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasContentInTipTapJson(bodyJson: string | null | undefined): boolean {
  if (!bodyJson || bodyJson.trim() === "") return false;
  try {
    const doc = JSON.parse(bodyJson) as { type?: string; content?: unknown[] };
    if (!doc || doc.type !== "doc" || !Array.isArray(doc.content)) return false;
    function checkNode(node: unknown): boolean {
      if (!node || typeof node !== "object") return false;
      const n = node as { type?: string; text?: string; attrs?: { src?: string }; content?: unknown[] };
      if (n.type === "text" && n.text && n.text.trim().length > 0) return true;
      if (n.type === "image" && n.attrs?.src) return true;
      if (Array.isArray(n.content)) {
        return n.content.some(checkNode);
      }
      return false;
    }
    return doc.content.some(checkNode);
  } catch {
    return bodyJson.trim().length > 0;
  }
}

export type SaveNewsDraftInput = {
  id?: string | null;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverMediaId?: string | null;
  bodyJson?: string | null;
  baseVersion?: number;
};

export async function saveNewsDraftAction(input: SaveNewsDraftInput) {
  const actor = await requirePermission("content.edit");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const title = (input.title ?? "").trim();
  let slug = (input.slug ?? "").trim().toLowerCase();

  if (title.length < 3) {
    throw new Error("Judul artikel minimal 3 karakter");
  }

  if (!slug) {
    slug = slugify(title);
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("Slug hanya boleh berisi huruf kecil, angka, dan tanda minus (-)");
  }

  const excerpt = input.excerpt?.trim() || null;
  const coverMediaId = input.coverMediaId?.trim() || null;
  const bodyJson = input.bodyJson?.trim() || null;

  // Validate cover media if provided
  if (coverMediaId) {
    const [coverAsset] = await database
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, coverMediaId))
      .limit(1);

    if (!coverAsset || coverAsset.lifecycle !== "ready" || !coverAsset.mimeType.startsWith("image/")) {
      throw new Error("Sampul harus berupa aset gambar yang valid dan berstatus siap");
    }
  }

  const result = await database.transaction(async (tx) => {
    // Check slug uniqueness
    if (input.id) {
      const [existingSlug] = await tx
        .select()
        .from(newsArticles)
        .where(and(eq(newsArticles.slug, slug), ne(newsArticles.id, input.id)))
        .limit(1);

      if (existingSlug) {
        throw new Error(`Slug '${slug}' sudah digunakan oleh artikel lain`);
      }
    } else {
      const [existingSlug] = await tx
        .select()
        .from(newsArticles)
        .where(eq(newsArticles.slug, slug))
        .limit(1);

      if (existingSlug) {
        throw new Error(`Slug '${slug}' sudah digunakan oleh artikel lain`);
      }
    }

    if (input.id) {
      const [current] = await tx
        .select()
        .from(newsArticles)
        .where(and(eq(newsArticles.id, input.id), eq(newsArticles.editionId, editionContext.id)))
        .limit(1);

      if (!current) {
        throw new Error("Artikel berita tidak ditemukan pada edisi ini");
      }

      const nextVersion = current.version + 1;
      const now = new Date();

      await tx
        .update(newsArticles)
        .set({
          title,
          slug,
          excerpt,
          coverMediaId,
          bodyJson,
          version: nextVersion,
          updatedAt: now,
        })
        .where(eq(newsArticles.id, input.id));

      const snapshot = {
        id: input.id,
        editionId: editionContext.id,
        title,
        slug,
        excerpt,
        coverMediaId,
        bodyJson,
        status: current.status,
        version: nextVersion,
      };

      // Upsert draft
      const [existingDraft] = await tx
        .select()
        .from(contentDrafts)
        .where(and(eq(contentDrafts.resourceType, "newsArticle"), eq(contentDrafts.resourceId, input.id)))
        .limit(1);

      if (existingDraft) {
        await tx
          .update(contentDrafts)
          .set({
            baseVersion: nextVersion,
            snapshotJson: JSON.stringify(snapshot),
            authorUserId: actor.session.user.id,
            updatedAt: now,
          })
          .where(eq(contentDrafts.id, existingDraft.id));
      } else {
        await tx.insert(contentDrafts).values({
          id: crypto.randomUUID(),
          resourceType: "newsArticle",
          resourceId: input.id,
          baseVersion: nextVersion,
          snapshotJson: JSON.stringify(snapshot),
          authorUserId: actor.session.user.id,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Record revision
      await tx.insert(contentRevisions).values({
        id: crypto.randomUUID(),
        resourceType: "newsArticle",
        resourceId: input.id,
        version: nextVersion,
        snapshotJson: JSON.stringify(snapshot),
        authorUserId: actor.session.user.id,
        reason: "Simpan draft",
        createdAt: now,
      });

      // Append audit log
      await appendAuditLog(tx, {
        actorUserId: actor.session.user.id,
        actorLabel: actor.session.user.email,
        action: "news.update",
        resourceType: "newsArticle",
        resourceId: input.id,
        resourceLabel: title,
        before: {
          title: current.title,
          slug: current.slug,
          excerpt: current.excerpt,
          coverMediaId: current.coverMediaId,
          bodyJson: current.bodyJson,
          version: current.version,
        },
        after: {
          title,
          slug,
          excerpt,
          coverMediaId,
          bodyJson,
          version: nextVersion,
        },
        changedFields: ["title", "slug", "excerpt", "coverMediaId", "bodyJson", "version"],
        source: "admin-news-editor",
      });

      return {
        articleId: input.id,
        version: nextVersion,
        isNew: false,
      };
    } else {
      // Create new article
      const newId = crypto.randomUUID();
      const now = new Date();

      await tx.insert(newsArticles).values({
        id: newId,
        editionId: editionContext.id,
        title,
        slug,
        excerpt,
        coverMediaId,
        bodyJson,
        status: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
      });

      const snapshot = {
        id: newId,
        editionId: editionContext.id,
        title,
        slug,
        excerpt,
        coverMediaId,
        bodyJson,
        status: "draft",
        version: 1,
      };

      await tx.insert(contentDrafts).values({
        id: crypto.randomUUID(),
        resourceType: "newsArticle",
        resourceId: newId,
        baseVersion: 1,
        snapshotJson: JSON.stringify(snapshot),
        authorUserId: actor.session.user.id,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(contentRevisions).values({
        id: crypto.randomUUID(),
        resourceType: "newsArticle",
        resourceId: newId,
        version: 1,
        snapshotJson: JSON.stringify(snapshot),
        authorUserId: actor.session.user.id,
        reason: "Dibuat pertama kali",
        createdAt: now,
      });

      await appendAuditLog(tx, {
        actorUserId: actor.session.user.id,
        actorLabel: actor.session.user.email,
        action: "news.create",
        resourceType: "newsArticle",
        resourceId: newId,
        resourceLabel: title,
        after: {
          id: newId,
          editionId: editionContext.id,
          title,
          slug,
          excerpt,
          coverMediaId,
          bodyJson,
          status: "draft",
          version: 1,
        },
        changedFields: ["editionId", "title", "slug", "excerpt", "coverMediaId", "bodyJson", "status", "version"],
        source: "admin-news-editor",
      });

      return {
        articleId: newId,
        version: 1,
        isNew: true,
      };
    }
  });

  revalidatePath("/admin/content/news");
  revalidatePath(`/admin/content/news/${result.articleId}`);
  revalidatePath("/admin");
  return { success: true, ...result };
}

export async function publishNewsArticleAction(input: { id: string; version: number }) {
  const actor = await requirePermission("content.publish");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const { id, version } = input;
  if (!id) {
    throw new Error("ID artikel wajib disertakan");
  }

  await database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(newsArticles)
      .where(and(eq(newsArticles.id, id), eq(newsArticles.editionId, editionContext.id)))
      .limit(1);

    if (!current) {
      throw new Error("Artikel berita tidak ditemukan pada edisi ini");
    }

    if (current.version !== version) {
      throw new Error("Versi data artikel telah berubah. Silakan muat ulang halaman sebelum menerbitkan.");
    }

    // Validate readiness for publishing
    if (!current.title || current.title.trim().length < 3) {
      throw new Error("Judul artikel minimal 3 karakter untuk diterbitkan");
    }

    if (!current.slug || !/^[a-z0-9-]+$/.test(current.slug)) {
      throw new Error("Slug artikel tidak valid");
    }

    if (!current.excerpt || current.excerpt.trim().length < 10) {
      throw new Error("Ringkasan artikel minimal 10 karakter untuk diterbitkan");
    }

    if (!current.coverMediaId) {
      throw new Error("Sampul berita wajib dipilih sebelum diterbitkan");
    }

    const [coverAsset] = await tx
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, current.coverMediaId))
      .limit(1);

    if (!coverAsset || coverAsset.lifecycle !== "ready") {
      throw new Error("Aset sampul tidak valid atau belum siap");
    }

    if (!hasContentInTipTapJson(current.bodyJson) && (!current.body || current.body.trim().length === 0)) {
      throw new Error("Isi artikel berita tidak boleh kosong");
    }

    const nextVersion = current.version + 1;
    const now = new Date();
    const publishedAt = current.publishedAt ?? now;

    await tx
      .update(newsArticles)
      .set({
        status: "published",
        publishedAt,
        version: nextVersion,
        updatedAt: now,
      })
      .where(eq(newsArticles.id, id));

    const snapshot = {
      ...current,
      status: "published",
      publishedAt,
      version: nextVersion,
    };

    await tx.insert(contentRevisions).values({
      id: crypto.randomUUID(),
      resourceType: "newsArticle",
      resourceId: id,
      version: nextVersion,
      snapshotJson: JSON.stringify(snapshot),
      authorUserId: actor.session.user.id,
      reason: "Publikasi artikel",
      createdAt: now,
    });

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "news.publish",
      resourceType: "newsArticle",
      resourceId: id,
      resourceLabel: current.title,
      before: {
        status: current.status,
        publishedAt: current.publishedAt,
        version: current.version,
      },
      after: {
        status: "published",
        publishedAt,
        version: nextVersion,
      },
      changedFields: ["status", "publishedAt", "version"],
      source: "admin-news-editor",
    });
  });

  revalidatePath("/admin/content/news");
  revalidatePath(`/admin/content/news/${id}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function unpublishNewsArticleAction(input: { id: string; version: number }) {
  const actor = await requirePermission("content.publish");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const { id, version } = input;
  if (!id) {
    throw new Error("ID artikel wajib disertakan");
  }

  await database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(newsArticles)
      .where(and(eq(newsArticles.id, id), eq(newsArticles.editionId, editionContext.id)))
      .limit(1);

    if (!current) {
      throw new Error("Artikel berita tidak ditemukan pada edisi ini");
    }

    if (current.version !== version) {
      throw new Error("Versi data artikel telah berubah. Silakan muat ulang halaman.");
    }

    const nextVersion = current.version + 1;
    const now = new Date();

    await tx
      .update(newsArticles)
      .set({
        status: "draft",
        version: nextVersion,
        updatedAt: now,
      })
      .where(eq(newsArticles.id, id));

    const snapshot = {
      ...current,
      status: "draft",
      version: nextVersion,
    };

    await tx.insert(contentRevisions).values({
      id: crypto.randomUUID(),
      resourceType: "newsArticle",
      resourceId: id,
      version: nextVersion,
      snapshotJson: JSON.stringify(snapshot),
      authorUserId: actor.session.user.id,
      reason: "Tarik publikasi ke draft",
      createdAt: now,
    });

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "news.unpublish",
      resourceType: "newsArticle",
      resourceId: id,
      resourceLabel: current.title,
      before: {
        status: current.status,
        version: current.version,
      },
      after: {
        status: "draft",
        version: nextVersion,
      },
      changedFields: ["status", "version"],
      source: "admin-news-editor",
    });
  });

  revalidatePath("/admin/content/news");
  revalidatePath(`/admin/content/news/${id}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function archiveNewsArticleAction(input: { id: string; version: number }) {
  const actor = await requirePermission("content.edit");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const { id, version } = input;
  if (!id) {
    throw new Error("ID artikel wajib disertakan");
  }

  await database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(newsArticles)
      .where(and(eq(newsArticles.id, id), eq(newsArticles.editionId, editionContext.id)))
      .limit(1);

    if (!current) {
      throw new Error("Artikel berita tidak ditemukan pada edisi ini");
    }

    if (current.version !== version) {
      throw new Error("Versi data artikel telah berubah. Silakan muat ulang halaman.");
    }

    const nextVersion = current.version + 1;
    const now = new Date();

    await tx
      .update(newsArticles)
      .set({
        status: "archived",
        version: nextVersion,
        updatedAt: now,
      })
      .where(eq(newsArticles.id, id));

    const snapshot = {
      ...current,
      status: "archived",
      version: nextVersion,
    };

    await tx.insert(contentRevisions).values({
      id: crypto.randomUUID(),
      resourceType: "newsArticle",
      resourceId: id,
      version: nextVersion,
      snapshotJson: JSON.stringify(snapshot),
      authorUserId: actor.session.user.id,
      reason: "Arsipkan artikel",
      createdAt: now,
    });

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "news.archive",
      resourceType: "newsArticle",
      resourceId: id,
      resourceLabel: current.title,
      before: {
        status: current.status,
        version: current.version,
      },
      after: {
        status: "archived",
        version: nextVersion,
      },
      changedFields: ["status", "version"],
      source: "admin-news-editor",
    });
  });

  revalidatePath("/admin/content/news");
  revalidatePath(`/admin/content/news/${id}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteNewsArticleAction(input: { id: string }) {
  const actor = await requirePermission("content.edit");
  const editionContext = await getAdminEditionContext();
  if (!editionContext) {
    throw new Error("Konteks edisi aktif tidak ditemukan");
  }

  const { id } = input;
  if (!id) {
    throw new Error("ID artikel wajib disertakan");
  }

  await database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(newsArticles)
      .where(and(eq(newsArticles.id, id), eq(newsArticles.editionId, editionContext.id)))
      .limit(1);

    if (!current) {
      throw new Error("Artikel berita tidak ditemukan pada edisi ini");
    }

    // Remove draft and revisions
    await tx
      .delete(contentDrafts)
      .where(and(eq(contentDrafts.resourceType, "newsArticle"), eq(contentDrafts.resourceId, id)));

    await tx
      .delete(contentRevisions)
      .where(and(eq(contentRevisions.resourceType, "newsArticle"), eq(contentRevisions.resourceId, id)));

    await tx.delete(newsArticles).where(eq(newsArticles.id, id));

    await appendAuditLog(tx, {
      actorUserId: actor.session.user.id,
      actorLabel: actor.session.user.email,
      action: "news.delete",
      resourceType: "newsArticle",
      resourceId: id,
      resourceLabel: current.title,
      before: current,
      changedFields: ["id"],
      source: "admin-news-editor",
    });
  });

  revalidatePath("/admin/content/news");
  revalidatePath("/admin");
  return { success: true };
}

export async function getNewsRevisionsAction(articleId: string) {
  await requirePermission("content.view");
  const rows = await database
    .select()
    .from(contentRevisions)
    .where(and(eq(contentRevisions.resourceType, "newsArticle"), eq(contentRevisions.resourceId, articleId)))
    .orderBy(desc(contentRevisions.version));

  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    reason: r.reason,
    authorUserId: r.authorUserId,
    createdAt: r.createdAt.toISOString(),
    snapshotJson: r.snapshotJson,
  }));
}
