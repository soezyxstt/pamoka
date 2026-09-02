import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import type { Database } from "@/server/db/queries";
import { editions } from "@/server/db/schema";

export const ADMIN_EDITION_COOKIE_NAME = "pamoka_admin_edition_id";

export type AdminEditionContext = {
  id: string;
  year: number;
  slug: string;
  name: string;
  lifecycle: string;
};

async function getDatabase(): Promise<Database> {
  const { database } = await import("@/server/db/client");
  return database;
}

/**
 * Resolves the admin edition context from a provided cookie ID or falls back to
 * active lifecycle edition, or newest edition by year.
 */
export async function resolveAdminEditionContext(
  db: Database,
  cookieEditionId?: string | null,
): Promise<AdminEditionContext | null> {
  if (cookieEditionId) {
    const [matchingEdition] = await db
      .select({
        id: editions.id,
        year: editions.year,
        slug: editions.slug,
        name: editions.name,
        lifecycle: editions.lifecycle,
      })
      .from(editions)
      .where(eq(editions.id, cookieEditionId))
      .limit(1);

    if (matchingEdition) {
      return matchingEdition;
    }
  }

  // Fallback 1: Active edition ordered by newest year
  const [activeEdition] = await db
    .select({
      id: editions.id,
      year: editions.year,
      slug: editions.slug,
      name: editions.name,
      lifecycle: editions.lifecycle,
    })
    .from(editions)
    .where(eq(editions.lifecycle, "active"))
    .orderBy(desc(editions.year))
    .limit(1);

  if (activeEdition) {
    return activeEdition;
  }

  // Fallback 2: Latest edition by year
  const [latestEdition] = await db
    .select({
      id: editions.id,
      year: editions.year,
      slug: editions.slug,
      name: editions.name,
      lifecycle: editions.lifecycle,
    })
    .from(editions)
    .orderBy(desc(editions.year))
    .limit(1);

  return latestEdition ?? null;
}

/**
 * Returns the currently active AdminEditionContext based on request cookies and database state.
 */
export async function getAdminEditionContext(): Promise<AdminEditionContext | null> {
  const cookieStore = await cookies();
  const cookieId = cookieStore.get(ADMIN_EDITION_COOKIE_NAME)?.value ?? null;
  const db = await getDatabase();
  return resolveAdminEditionContext(db, cookieId);
}

/**
 * Returns all available editions for admin selection.
 */
export async function getAdminEditions(): Promise<AdminEditionContext[]> {
  const db = await getDatabase();
  return db
    .select({
      id: editions.id,
      year: editions.year,
      slug: editions.slug,
      name: editions.name,
      lifecycle: editions.lifecycle,
    })
    .from(editions)
    .orderBy(desc(editions.year));
}
