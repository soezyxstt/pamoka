import { asc, eq } from "drizzle-orm";

import { AdminBadge, AdminCard, AdminCardHeader, AdminEmptyState, AdminPage } from "@/components/admin/primitives";
import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { database } from "@/server/db/client";
import { editionPrograms, editions, mediaAssets } from "@/server/db/schema";
import { EditionSettingsClient } from "./edition-settings-client";

export const metadata = { title: "Identitas edisi" };

export default async function EditionSettingsPage() {
  const { effectivePermissions } = await requirePermission("content.view");
  const canManageContent = effectivePermissions.has("content.edit");
  const editionContext = await getAdminEditionContext();

  if (!editionContext) {
    return (
      <AdminPage
        eyebrow="Konten / identitas"
        title="Identitas edisi"
        description="Kelola logo, slogan, dan program unggulan untuk edisi yang sedang aktif."
      >
        <AdminCard>
          <AdminEmptyState
            icon="sparkles"
            title="Belum ada edisi dipilih"
            description="Silakan buat atau pilih edisi pada selector di header untuk mengelola identitas dan program edisi."
          />
        </AdminCard>
      </AdminPage>
    );
  }

  const [editionRow] = await database
    .select()
    .from(editions)
    .where(eq(editions.id, editionContext.id))
    .limit(1);

  if (!editionRow) {
    return (
      <AdminPage
        eyebrow="Konten / identitas"
        title="Identitas edisi"
        description="Kelola logo, slogan, dan program unggulan untuk edisi yang sedang aktif."
      >
        <AdminCard>
          <AdminEmptyState
            icon="sparkles"
            title="Edisi tidak ditemukan"
            description="Data edisi yang dipilih tidak ditemukan dalam database."
          />
        </AdminCard>
      </AdminPage>
    );
  }

  let logoAsset = null;
  if (editionRow.logoMediaId) {
    const [asset] = await database
      .select({
        id: mediaAssets.id,
        url: mediaAssets.url,
        filename: mediaAssets.filename,
        mimeType: mediaAssets.mimeType,
        bytes: mediaAssets.bytes,
        alt: mediaAssets.alt,
        decorative: mediaAssets.decorative,
        lifecycle: mediaAssets.lifecycle,
        folderId: mediaAssets.folderId,
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, editionRow.logoMediaId))
      .limit(1);

    if (asset) {
      logoAsset = asset;
    }
  }

  const programs = await database
    .select()
    .from(editionPrograms)
    .where(eq(editionPrograms.editionId, editionContext.id))
    .orderBy(asc(editionPrograms.displayOrder));

  return (
    <AdminPage
      eyebrow="Konten / identitas"
      title="Identitas edisi"
      description="Kelola logo, slogan, dan program unggulan untuk edisi yang sedang aktif."
    >
      <div className="space-y-6">
        <AdminCard>
          <AdminCardHeader
            eyebrow="Konteks edisi terpilih"
            title={`${editionRow.name} (${editionRow.year})`}
            description="Perubahan logo, slogan, dan program kerja di halaman ini khusus terikat pada edisi ini."
            action={<AdminBadge value={editionRow.lifecycle} />}
          />
        </AdminCard>

        <EditionSettingsClient
          edition={{
            id: editionRow.id,
            year: editionRow.year,
            name: editionRow.name,
            lifecycle: editionRow.lifecycle,
            slogan: editionRow.slogan,
            logoMediaId: editionRow.logoMediaId,
            version: editionRow.version,
          }}
          initialLogoAsset={logoAsset}
          initialPrograms={programs}
          canManageContent={canManageContent}
        />
      </div>
    </AdminPage>
  );
}
