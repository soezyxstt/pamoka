import { and, count, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";

import type { Database } from "@/server/db/queries";
import { editions, mediaAssets, mediaFolders } from "@/server/db/schema";

export const DEFAULT_MEDIA_PAGE_SIZE = 50;
export const MAX_MEDIA_PAGE_SIZE = 100;

export type MediaAssetTypeFilter = "image" | "video" | "pdf" | "all";
export type MediaFolderScope = "all" | "edition" | "global";

export type ListMediaAssetsInput = {
  type?: MediaAssetTypeFilter;
  folderId?: string | null | "all";
  folderScope?: MediaFolderScope;
  editionId?: string | null;
  search?: string;
  page?: number;
  limit?: number;
  assetIds?: readonly string[];
};

type MediaAssetRow = typeof mediaAssets.$inferSelect;

function normalizePage(value: number | undefined) {
  if (!Number.isInteger(value) || value === undefined || value < 0) return 0;
  return value;
}

function normalizeLimit(value: number | undefined) {
  if (!Number.isInteger(value) || value === undefined || value < 1) return DEFAULT_MEDIA_PAGE_SIZE;
  return Math.min(value, MAX_MEDIA_PAGE_SIZE);
}

function typeCondition(type: MediaAssetTypeFilter | undefined) {
  if (!type || type === "all") return null;
  if (type === "image") return like(mediaAssets.mimeType, "image/%");
  if (type === "video") return like(mediaAssets.mimeType, "video/%");
  return eq(mediaAssets.mimeType, "application/pdf");
}

function serializeAsset(asset: typeof mediaAssets.$inferSelect) {
  return {
    ...asset,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt ? asset.updatedAt.toISOString() : null,
  };
}

function serializeFolder(folder: typeof mediaFolders.$inferSelect) {
  return {
    ...folder,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt ? folder.updatedAt.toISOString() : null,
  };
}

export type SerializedMediaAsset = ReturnType<typeof serializeAsset>;
export type SerializedMediaFolder = ReturnType<typeof serializeFolder>;

export async function listMediaAssets(db: Database, filters: ListMediaAssetsInput = {}) {
  const page = normalizePage(filters.page);
  const limit = normalizeLimit(filters.limit);
  const folderRows = await db.select().from(mediaFolders).orderBy(mediaFolders.name);

  const browseConditions = [eq(mediaAssets.lifecycle, "ready")];
  const typeFilter = typeCondition(filters.type);
  if (typeFilter) browseConditions.push(typeFilter);

  const folderScope = filters.folderScope ?? "all";
  const editionFolderIds = filters.editionId
    ? folderRows.filter((folder) => folder.editionId === filters.editionId).map((folder) => folder.id)
    : [];
  const globalFolderIds = folderRows.filter((folder) => !folder.editionId).map((folder) => folder.id);

  if (folderScope === "edition") {
    browseConditions.push(
      filters.editionId && editionFolderIds.length > 0
        ? inArray(mediaAssets.folderId, editionFolderIds)
        : sql`1 = 0`,
    );
  } else if (folderScope === "global") {
    browseConditions.push(
      globalFolderIds.length > 0
        ? or(isNull(mediaAssets.folderId), inArray(mediaAssets.folderId, globalFolderIds))!
        : isNull(mediaAssets.folderId),
    );
  }

  if (filters.folderId !== undefined && filters.folderId !== "all") {
    browseConditions.push(
      filters.folderId === null ? isNull(mediaAssets.folderId) : eq(mediaAssets.folderId, filters.folderId),
    );
  }

  const search = filters.search?.trim().slice(0, 120);
  if (search) {
    const pattern = `%${search}%`;
    browseConditions.push(or(like(mediaAssets.filename, pattern), like(mediaAssets.alt, pattern))!);
  }

  const browseWhere = and(...browseConditions);
  const selectedAssetIds = [...new Set((filters.assetIds ?? []).filter(Boolean))].slice(0, 20);
  const selectedWhere = selectedAssetIds.length
    ? and(
        eq(mediaAssets.lifecycle, "ready"),
        typeFilter ?? sql`1 = 1`,
        inArray(mediaAssets.id, selectedAssetIds),
      )
    : null;

  const [assetRows, totalRows, selectedRows, editionRows] = await Promise.all([
    db
      .select()
      .from(mediaAssets)
      .where(browseWhere)
      .orderBy(desc(mediaAssets.createdAt), desc(mediaAssets.id))
      .limit(limit)
      .offset(page * limit),
    db.select({ value: count() }).from(mediaAssets).where(browseWhere),
    selectedWhere
      ? db.select().from(mediaAssets).where(selectedWhere).orderBy(desc(mediaAssets.createdAt), desc(mediaAssets.id))
      : Promise.resolve([] as MediaAssetRow[]),
    db
      .select({ id: editions.id, year: editions.year, name: editions.name })
      .from(editions)
      .orderBy(desc(editions.year)),
  ]);

  const selectedById = new Map(selectedRows.map((asset) => [asset.id, asset]));
  const total = Number(totalRows[0]?.value ?? 0);

  return {
    assets: assetRows.map(serializeAsset),
    selectedAssets: selectedAssetIds.flatMap((assetId) => {
      const asset = selectedById.get(assetId);
      return asset ? [serializeAsset(asset)] : [];
    }),
    folders: folderRows.map(serializeFolder),
    editions: editionRows,
    page,
    limit,
    total,
    hasMore: (page + 1) * limit < total,
  };
}
