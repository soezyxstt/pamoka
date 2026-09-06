import { createClient } from "@libsql/client/node";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import * as schema from "./schema";
import {
  editions,
  events,
  galleries,
  galleryItems,
  mediaAssets,
} from "./schema";

async function createTestDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "moka-events-gallery-test-"));
  const client = createClient({ url: `file:${join(directory, "test.db")}` });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: resolve("drizzle") });
  return { client, db };
}

test("events mendukung operasi CRUD, pengurutan, dan terisolasi per edisi", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(editions).values([
      {
        id: "ed-2025",
        year: 2025,
        slug: "2025",
        name: "Pasanggiri MOKA 2025",
        lifecycle: "active",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "ed-2024",
        year: 2024,
        slug: "2024",
        name: "Pasanggiri MOKA 2024",
        lifecycle: "archived",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Insert events di ed-2025
    const [event1] = await db
      .insert(events)
      .values({
        id: "ev-audisi",
        editionId: "ed-2025",
        label: "Audisi Terbuka",
        slug: "audisi-terbuka",
        description: "Audisi awal peserta",
        displayOrder: 1,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [event2] = await db
      .insert(events)
      .values({
        id: "ev-grandfinal",
        editionId: "ed-2025",
        label: "Malam Grand Final",
        slug: "malam-grand-final",
        description: "Puncak penobatan juara",
        displayOrder: 2,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    assert.equal(event1.slug, "audisi-terbuka");
    assert.equal(event2.slug, "malam-grand-final");

    // Query events per edisi terurut
    const list2025 = await db
      .select()
      .from(events)
      .where(eq(events.editionId, "ed-2025"))
      .orderBy(events.displayOrder);

    assert.equal(list2025.length, 2);
    assert.equal(list2025[0].id, "ev-audisi");
    assert.equal(list2025[1].id, "ev-grandfinal");

    // Edisi 2024 kosong
    const list2024 = await db
      .select()
      .from(events)
      .where(eq(events.editionId, "ed-2024"));
    assert.equal(list2024.length, 0);
  } finally {
    client.close();
  }
});

test("galleries mendukung album standalone dan album milik event", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(editions).values({
      id: "ed-2025",
      year: 2025,
      slug: "2025",
      name: "Pasanggiri MOKA 2025",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(events).values({
      id: "ev-karantina",
      editionId: "ed-2025",
      label: "Masa Karantina",
      slug: "masa-karantina",
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    });

    // 1. Album Standalone
    const [standalone] = await db
      .insert(galleries)
      .values({
        id: "gal-behind-scenes",
        editionId: "ed-2025",
        title: "Behind the Scenes 2025",
        slug: "behind-the-scenes",
        description: "Momen seru di balik panggung",
        ownerType: "standalone",
        ownerId: "ed-2025",
        displayOrder: 1,
        status: "published",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // 2. Album Milik Event
    const [eventAlbum] = await db
      .insert(galleries)
      .values({
        id: "gal-karantina-day1",
        editionId: "ed-2025",
        title: "Karantina Hari Pertama",
        slug: "karantina-hari-pertama",
        description: "Pembekalan materi kebudayaan",
        ownerType: "event",
        ownerId: "ev-karantina",
        displayOrder: 2,
        status: "published",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    assert.equal(standalone.ownerType, "standalone");
    assert.equal(eventAlbum.ownerType, "event");
    assert.equal(eventAlbum.ownerId, "ev-karantina");
  } finally {
    client.close();
  }
});

test("galleryItems dimasukkan ke gallery yang sama tanpa duplikasi album", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(editions).values({
      id: "ed-2025",
      year: 2025,
      slug: "2025",
      name: "Pasanggiri MOKA 2025",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    const [gallery] = await db
      .insert(galleries)
      .values({
        id: "gal-utama",
        editionId: "ed-2025",
        title: "Dokumentasi Utama",
        slug: "dokumentasi-utama",
        ownerType: "standalone",
        ownerId: "ed-2025",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Buat media asset
    await db.insert(mediaAssets).values([
      {
        id: "media-img-1",
        provider: "uploadthing",
        url: "https://utfs.io/f/img1.webp",
        filename: "img1.webp",
        mimeType: "image/webp",
        bytes: 120000,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "media-img-2",
        provider: "uploadthing",
        url: "https://utfs.io/f/img2.webp",
        filename: "img2.webp",
        mimeType: "image/webp",
        bytes: 150000,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Masukkan item foto ke galeri
    await db.insert(galleryItems).values([
      {
        id: "item-1",
        galleryId: gallery.id,
        mediaId: "media-img-1",
        youtubeId: null,
        caption: "Foto 1",
        displayOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "item-2",
        galleryId: gallery.id,
        mediaId: "media-img-2",
        youtubeId: null,
        caption: "Foto 2",
        displayOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "item-3",
        galleryId: gallery.id,
        mediaId: null,
        youtubeId: "dQw4w9WgXcQ",
        caption: "Video Teaser",
        displayOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Pastikan total galeri tetap 1
    const allGalleries = await db.select().from(galleries);
    assert.equal(allGalleries.length, 1);

    // Pastikan item galeri berjumlah 3 dan urut
    const items = await db
      .select()
      .from(galleryItems)
      .where(eq(galleryItems.galleryId, gallery.id))
      .orderBy(galleryItems.displayOrder);

    assert.equal(items.length, 3);
    assert.equal(items[0].mediaId, "media-img-1");
    assert.equal(items[1].mediaId, "media-img-2");
    assert.equal(items[2].youtubeId, "dQw4w9WgXcQ");
  } finally {
    client.close();
  }
});

test("galleryItems mewajibkan tepat satu sumber", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-05T00:00:00.000Z");
    await db.insert(editions).values({
      id: "ed-source-check",
      year: 2026,
      slug: "source-check",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(galleries).values({
      id: "gal-source-check",
      editionId: "ed-source-check",
      title: "Uji sumber",
      slug: "uji-sumber",
      ownerType: "standalone",
      ownerId: "ed-source-check",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(mediaAssets).values({
      id: "media-source-check",
      provider: "uploadthing",
      url: "https://utfs.io/f/source.webp",
      filename: "source.webp",
      mimeType: "image/webp",
      bytes: 10,
      createdAt: now,
      updatedAt: now,
    });

    await assert.rejects(
      db.insert(galleryItems).values({
        id: "item-no-source",
        galleryId: "gal-source-check",
        mediaId: null,
        youtubeId: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    await assert.rejects(
      db.insert(galleryItems).values({
        id: "item-two-sources",
        galleryId: "gal-source-check",
        mediaId: "media-source-check",
        youtubeId: "dQw4w9WgXcQ",
        createdAt: now,
        updatedAt: now,
      }),
    );
  } finally {
    client.close();
  }
});
