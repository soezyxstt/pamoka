import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdminEditionContext } from "../cms/context";
import { editions } from "./schema";
import * as schema from "./schema";

async function createTestDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "moka-edition-test-"));
  const client = createClient({ url: `file:${join(directory, "test.db")}` });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: resolve("drizzle") });
  return { client, db };
}

test("resolveAdminEditionContext mengembalikan edisi sesuai cookie jika valid", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");
    await db.insert(editions).values([
      { id: "ed-2024", year: 2024, slug: "2024", name: "Pasanggiri 2024", lifecycle: "archived", createdAt: now, updatedAt: now },
      { id: "ed-2025", year: 2025, slug: "2025", name: "Pasanggiri 2025", lifecycle: "active", createdAt: now, updatedAt: now },
      { id: "ed-2026", year: 2026, slug: "2026", name: "Pasanggiri 2026", lifecycle: "draft", createdAt: now, updatedAt: now },
    ]);

    const result = await resolveAdminEditionContext(db, "ed-2024");
    assert.ok(result);
    assert.equal(result.id, "ed-2024");
    assert.equal(result.year, 2024);
    assert.equal(result.name, "Pasanggiri 2024");
    assert.equal(result.lifecycle, "archived");
  } finally {
    client.close();
  }
});

test("resolveAdminEditionContext fallback ke edisi aktif jika cookie tidak valid atau kosong", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");
    await db.insert(editions).values([
      { id: "ed-2024", year: 2024, slug: "2024", name: "Pasanggiri 2024", lifecycle: "archived", createdAt: now, updatedAt: now },
      { id: "ed-2025", year: 2025, slug: "2025", name: "Pasanggiri 2025", lifecycle: "active", createdAt: now, updatedAt: now },
      { id: "ed-2026", year: 2026, slug: "2026", name: "Pasanggiri 2026", lifecycle: "draft", createdAt: now, updatedAt: now },
    ]);

    // Test with invalid cookie ID
    const fallbackInvalid = await resolveAdminEditionContext(db, "random-non-existent-id");
    assert.ok(fallbackInvalid);
    assert.equal(fallbackInvalid.id, "ed-2025");
    assert.equal(fallbackInvalid.lifecycle, "active");

    // Test with null cookie ID
    const fallbackNull = await resolveAdminEditionContext(db, null);
    assert.ok(fallbackNull);
    assert.equal(fallbackNull.id, "ed-2025");
    assert.equal(fallbackNull.lifecycle, "active");
  } finally {
    client.close();
  }
});

test("resolveAdminEditionContext fallback ke edisi terbaru berdasarkan tahun jika belum ada edisi aktif", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");
    await db.insert(editions).values([
      { id: "ed-2024", year: 2024, slug: "2024", name: "Pasanggiri 2024", lifecycle: "archived", createdAt: now, updatedAt: now },
      { id: "ed-2026", year: 2026, slug: "2026", name: "Pasanggiri 2026", lifecycle: "draft", createdAt: now, updatedAt: now },
    ]);

    const result = await resolveAdminEditionContext(db, null);
    assert.ok(result);
    assert.equal(result.id, "ed-2026");
    assert.equal(result.year, 2026);
  } finally {
    client.close();
  }
});

test("resolveAdminEditionContext mengembalikan null jika database edisi kosong", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const result = await resolveAdminEditionContext(db, null);
    assert.equal(result, null);
  } finally {
    client.close();
  }
});
