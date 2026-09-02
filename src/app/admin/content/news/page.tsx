import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminBadge, AdminPage } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { database } from "@/server/db/client";
import { mediaAssets, newsArticles } from "@/server/db/schema";
import { NewsListClient } from "./news-list-client";

export const metadata = { title: "Berita" };

export default async function NewsPage() {
  const actor = await requirePermission("content.view");
  const currentEdition = await getAdminEditionContext();

  const rows = await database
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      slug: newsArticles.slug,
      excerpt: newsArticles.excerpt,
      status: newsArticles.status,
      version: newsArticles.version,
      publishedAt: newsArticles.publishedAt,
      createdAt: newsArticles.createdAt,
      coverUrl: mediaAssets.url,
      coverAlt: mediaAssets.alt,
    })
    .from(newsArticles)
    .leftJoin(mediaAssets, eq(newsArticles.coverMediaId, mediaAssets.id))
    .where(currentEdition ? eq(newsArticles.editionId, currentEdition.id) : undefined)
    .orderBy(desc(newsArticles.createdAt));

  const articles = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    status: r.status,
    version: r.version,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    coverUrl: r.coverUrl,
    coverAlt: r.coverAlt,
  }));

  const canEdit =
    actor.effectivePermissions.has("content.edit") ||
    actor.effectivePermissions.has("news.manage");

  return (
    <AdminPage
      eyebrow="Studio / editorial"
      title="Berita"
      description={
        currentEdition
          ? `Kelola dan publikasikan artikel berita untuk ${currentEdition.name} (${currentEdition.year}).`
          : "Kelola artikel berita, draft konten, dan publikasi."
      }
      action={
        currentEdition ? (
          <div className="flex items-center gap-2">
            <AdminBadge value={currentEdition.lifecycle} />
            {canEdit && (
              <Link href="/admin/content/news/new">
                <Button size="sm" className="h-8 gap-1.5 bg-dgb text-xs font-semibold text-white hover:bg-dgb-600">
                  <Plus size={14} /> Tulis berita baru
                </Button>
              </Link>
            )}
          </div>
        ) : null
      }
    >
      <NewsListClient
        initialArticles={articles}
        editionName={currentEdition?.name ?? "Edisi Aktif"}
        canEdit={canEdit}
      />
    </AdminPage>
  );
}
