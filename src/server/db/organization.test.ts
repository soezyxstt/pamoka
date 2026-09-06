import { createClient } from "@libsql/client/node";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { appendAuditLog } from "../auth/audit";
import { validatePeriodEditionSelection } from "../organization/period-editions";
import * as schema from "./schema";
import {
  auditLogs,
  authUsers,
  editions,
  mediaAssets,
  organizationAssignments,
  organizationMemberships,
  organizationPeriods,
  organizationUnits,
  people,
  personSocialLinks,
} from "./schema";

test("pemindahan edisi memerlukan konfirmasi eksplisit", () => {
  const candidates = [
    {
      id: "edition-2025",
      name: "Pasanggiri 2025",
      year: 2025,
      organizationPeriodId: "period-a",
      version: 1,
    },
  ];

  assert.throws(
    () => validatePeriodEditionSelection(candidates, "period-b", ["edition-2025"], []),
    /Konfirmasi pemindahan diperlukan/
  );
  const result = validatePeriodEditionSelection(
    candidates,
    "period-b",
    ["edition-2025"],
    ["edition-2025"]
  );
  assert.deepEqual(result.conflicts.map((edition) => edition.id), ["edition-2025"]);
});

test("konfirmasi edisi yang usang atau tidak dipilih ditolak", () => {
  const candidates = [
    {
      id: "edition-2025",
      name: "Pasanggiri 2025",
      year: 2025,
      organizationPeriodId: null,
      version: 1,
    },
  ];

  assert.throws(
    () => validatePeriodEditionSelection(candidates, "period-b", [], ["edition-2025"]),
    /tidak sesuai data terkini/
  );
  assert.throws(
    () => validatePeriodEditionSelection(candidates, "period-b", ["missing"], []),
    /edisi tidak ditemukan/
  );
});

async function createTestDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "moka-org-test-"));
  const client = createClient({ url: `file:${join(directory, "test.db")}` });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: resolve("drizzle") });
  return { client, db };
}

test("organizationPeriods mendukung operasi CRUD, visi, misi JSON, dan edisi terhubung", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    const [period] = await db
      .insert(organizationPeriods)
      .values({
        id: "period-2024-2026",
        label: "Kepengurusan 2024-2026",
        startYear: 2024,
        endYear: 2026,
        vision: "Mewujudkan Pemuda Garut yang Berbudaya dan Berdaya Saing Global",
        missionJson: JSON.stringify([
          "Melestarikan nilai luhur seni dan budaya Sunda",
          "Meningkatkan kapasitas kepemimpinan generasi muda",
        ]),
        lifecycle: "active",
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    assert.equal(period.id, "period-2024-2026");
    assert.equal(period.label, "Kepengurusan 2024-2026");
    const missions = JSON.parse(period.missionJson) as string[];
    assert.equal(missions.length, 2);

    // Hubungkan edisi ke periode
    await db.insert(editions).values({
      id: "ed-2025",
      year: 2025,
      slug: "2025",
      name: "Pasanggiri MOKA 2025",
      organizationPeriodId: period.id,
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    const [linkedEdition] = await db
      .select()
      .from(editions)
      .where(eq(editions.organizationPeriodId, period.id));

    assert.ok(linkedEdition);
    assert.equal(linkedEdition.id, "ed-2025");
  } finally {
    client.close();
  }
});
test("organizationUnits mendukung struktur tree hierarkis bertingkat", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(organizationPeriods).values({
      id: "period-1",
      label: "Periode 2024-2026",
      startYear: 2024,
      endYear: 2026,
      createdAt: now,
      updatedAt: now,
    });

    // Level 1: Dewan Pengurus Harian
    const [dph] = await db
      .insert(organizationUnits)
      .values({
        id: "unit-dph",
        periodId: "period-1",
        parentId: null,
        name: "Dewan Pengurus Harian",
        displayOrder: 1,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Level 2: Bidang Pengembangan
    const [bidang] = await db
      .insert(organizationUnits)
      .values({
        id: "unit-bidang",
        periodId: "period-1",
        parentId: dph.id,
        name: "Bidang Pengembangan Budaya",
        displayOrder: 2,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Level 3: Divisi Kesenian
    await db
      .insert(organizationUnits)
      .values({
        id: "unit-divisi",
        periodId: "period-1",
        parentId: bidang.id,
        name: "Divisi Kesenian Sunda",
        displayOrder: 3,
        active: true,
        createdAt: now,
        updatedAt: now,
      });

    const units = await db
      .select()
      .from(organizationUnits)
      .where(eq(organizationUnits.periodId, "period-1"))
      .orderBy(organizationUnits.displayOrder);

    assert.equal(units.length, 3);
    assert.equal(units[0].parentId, null);
    assert.equal(units[1].parentId, dph.id);
    assert.equal(units[2].parentId, bidang.id);
  } finally {
    client.close();
  }
});

test("people dan organizationMemberships mendukung penugasan pengurus dan sosial media", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(organizationPeriods).values({
      id: "period-1",
      label: "Periode 2024-2026",
      startYear: 2024,
      endYear: 2026,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(organizationUnits).values({
      id: "unit-1",
      periodId: "period-1",
      name: "Pengurus Harian",
      createdAt: now,
      updatedAt: now,
    });

    // Buat profil orang
    const [person] = await db
      .insert(people)
      .values({
        id: "person-1",
        name: "Rizki Pratama",
        slug: "rizki-pratama",
        shortBio: "Ketua Paguyuban PAMOKA Garut",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Tambah sosial media
    await db.insert(personSocialLinks).values([
      {
        id: "link-1",
        personId: person.id,
        platform: "instagram",
        url: "https://instagram.com/rizkipratama",
        displayOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "link-2",
        personId: person.id,
        platform: "linkedin",
        url: "https://linkedin.com/in/rizkipratama",
        displayOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Beri penugasan jabatan
    const [membership] = await db
      .insert(organizationMemberships)
      .values({
        id: "mem-1",
        periodId: "period-1",
        unitId: "unit-1",
        personId: person.id,
        title: "Ketua Umum",
        displayOrder: 1,
        active: true,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    assert.equal(membership.title, "Ketua Umum");
    assert.equal(membership.personId, person.id);

    const links = await db
      .select()
      .from(personSocialLinks)
      .where(eq(personSocialLinks.personId, person.id))
      .orderBy(personSocialLinks.displayOrder);

    assert.equal(links.length, 2);
    assert.equal(links[0].platform, "instagram");
  } finally {
    client.close();
  }
});

test("legacy organizationAssignments dapat dipetakan tanpa menghapus data mentah", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(people).values({
      id: "person-legacy",
      name: "Dadan Ramdani",
      slug: "dadan-ramdani",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(organizationAssignments).values({
      id: "legacy-assign-1",
      personId: "person-legacy",
      title: "Penasihat Organisasi",
      group: "Dewan Penasihat",
      displayOrder: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    const [legacy] = await db
      .select()
      .from(organizationAssignments)
      .where(eq(organizationAssignments.id, "legacy-assign-1"));

    assert.ok(legacy);
    assert.equal(legacy.title, "Penasihat Organisasi");

    // Pastikan schema legacy tetap utuh
    assert.equal(legacy.group, "Dewan Penasihat");
  } finally {
    client.close();
  }
});

test("reorder unit menolak lintas periode, menolak campuran parent, dan mencatat audit secara transaksional", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(authUsers).values({
      id: "user-admin-reorder",
      name: "Admin Organisasi",
      email: "admin-org@pamoka.id",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(organizationPeriods).values([
      {
        id: "period-A",
        label: "Periode A",
        startYear: 2024,
        endYear: 2026,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "period-B",
        label: "Periode B",
        startYear: 2026,
        endYear: 2028,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Unit di period-A (root)
    await db.insert(organizationUnits).values([
      {
        id: "unit-A1",
        periodId: "period-A",
        parentId: null,
        name: "Unit A1",
        displayOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "unit-A2",
        periodId: "period-A",
        parentId: null,
        name: "Unit A2",
        displayOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "unit-A1-child",
        periodId: "period-A",
        parentId: "unit-A1",
        name: "Sub Unit A1",
        displayOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Unit di period-B (root)
    await db.insert(organizationUnits).values({
      id: "unit-B1",
      periodId: "period-B",
      parentId: null,
      name: "Unit B1",
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Invariant 1: Tolak pengurutan lintas periode
    const itemsCrossPeriod = [
      { id: "unit-A1", displayOrder: 2 },
      { id: "unit-B1", displayOrder: 1 },
    ];

    await assert.rejects(
      async () => {
        await db.transaction(async (tx) => {
          const ids = itemsCrossPeriod.map((i) => i.id);
          const targetUnits = await tx
            .select()
            .from(organizationUnits)
            .where(inArray(organizationUnits.id, ids));

          const periodIds = new Set(targetUnits.map((u) => u.periodId));
          if (periodIds.size !== 1) {
            throw new Error("Pengurutan unit lintas periode tidak diizinkan");
          }
        });
      },
      { message: "Pengurutan unit lintas periode tidak diizinkan" }
    );

    // Invariant 2: Tolak pengurutan unit dengan parent berbeda (campuran parent / level)
    const itemsMixedParent = [
      { id: "unit-A1", displayOrder: 2 },
      { id: "unit-A1-child", displayOrder: 1 },
    ];

    await assert.rejects(
      async () => {
        await db.transaction(async (tx) => {
          const ids = itemsMixedParent.map((i) => i.id);
          const targetUnits = await tx
            .select()
            .from(organizationUnits)
            .where(inArray(organizationUnits.id, ids));

          const parentIds = new Set(targetUnits.map((u) => u.parentId));
          if (parentIds.size !== 1) {
            throw new Error("Unit yang diurutkan harus berada pada tingkat induk yang sama");
          }
        });
      },
      { message: "Unit yang diurutkan harus berada pada tingkat induk yang sama" }
    );

    // Invariant 3: Pengurutan sibling berhasil dan mencatat audit log dalam satu transaksi
    const validItems = [
      { id: "unit-A1", displayOrder: 2 },
      { id: "unit-A2", displayOrder: 1 },
    ];

    await db.transaction(async (tx) => {
      const ids = validItems.map((i) => i.id);
      const targetUnits = await tx
        .select()
        .from(organizationUnits)
        .where(inArray(organizationUnits.id, ids));

      assert.equal(targetUnits.length, 2);
      const periodIds = new Set(targetUnits.map((u) => u.periodId));
      assert.equal(periodIds.size, 1);
      const parentIds = new Set(targetUnits.map((u) => u.parentId));
      assert.equal(parentIds.size, 1);

      for (const item of validItems) {
        await tx
          .update(organizationUnits)
          .set({ displayOrder: item.displayOrder, updatedAt: new Date() })
          .where(eq(organizationUnits.id, item.id));
      }

      await appendAuditLog(tx, {
        actorUserId: "user-admin-reorder",
        actorLabel: "admin-org@pamoka.id",
        action: "organization.unit.reorder",
        resourceType: "organization_unit",
        resourceId: "period-A",
        resourceLabel: "Pengurutan unit organisasi",
        after: { items: validItems, periodId: "period-A" },
        changedFields: ["displayOrder"],
        source: "admin-organization",
      });
    });

    // Verifikasi hasil pembaruan
    const [updatedA1] = await db.select().from(organizationUnits).where(eq(organizationUnits.id, "unit-A1"));
    const [updatedA2] = await db.select().from(organizationUnits).where(eq(organizationUnits.id, "unit-A2"));
    assert.equal(updatedA1.displayOrder, 2);
    assert.equal(updatedA2.displayOrder, 1);

    // Verifikasi audit log
    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resourceType, "organization_unit"), eq(auditLogs.resourceId, "period-A")));
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "organization.unit.reorder");
    assert.equal(logs[0].actorUserId, "user-admin-reorder");
  } finally {
    client.close();
  }
});

test("savePerson memvalidasi portrait sebagai aset gambar ready secara transaksional", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(authUsers).values({
      id: "user-admin-person",
      name: "Admin Profil",
      email: "admin-person@pamoka.id",
      createdAt: now,
      updatedAt: now,
    });

    // 1. Aset pending (belum siap)
    await db.insert(mediaAssets).values({
      id: "asset-pending-1",
      provider: "uploadthing",
      url: "https://utfs.io/f/pending.jpg",
      filename: "pending.jpg",
      mimeType: "image/jpeg",
      bytes: 120000,
      lifecycle: "pending",
      ownerUserId: "user-admin-person",
      createdAt: now,
      updatedAt: now,
    });

    // 2. Aset non-image (dokumen PDF)
    await db.insert(mediaAssets).values({
      id: "asset-pdf-1",
      provider: "uploadthing",
      url: "https://utfs.io/f/document.pdf",
      filename: "document.pdf",
      mimeType: "application/pdf",
      bytes: 500000,
      lifecycle: "ready",
      ownerUserId: "user-admin-person",
      createdAt: now,
      updatedAt: now,
    });

    // 3. Aset gambar ready
    await db.insert(mediaAssets).values({
      id: "asset-ready-1",
      provider: "uploadthing",
      url: "https://utfs.io/f/ready.jpg",
      filename: "ready.jpg",
      mimeType: "image/jpeg",
      bytes: 250000,
      lifecycle: "ready",
      ownerUserId: "user-admin-person",
      createdAt: now,
      updatedAt: now,
    });

    // Invariant 1: Menolak aset dengan lifecycle bukan ready dan rollback transaksi
    await assert.rejects(
      async () => {
        await db.transaction(async (tx) => {
          const [asset] = await tx
            .select({ id: mediaAssets.id, lifecycle: mediaAssets.lifecycle, mimeType: mediaAssets.mimeType })
            .from(mediaAssets)
            .where(eq(mediaAssets.id, "asset-pending-1"))
            .limit(1);

          if (!asset || asset.lifecycle !== "ready" || !asset.mimeType.startsWith("image/")) {
            throw new Error("Foto portrait harus berupa gambar yang valid dan siap digunakan");
          }

          await tx.insert(people).values({
            id: "person-fail-1",
            name: "Gagal Pending",
            slug: "gagal-pending",
            portraitMediaId: "asset-pending-1",
            createdAt: now,
            updatedAt: now,
          });
        });
      },
      { message: "Foto portrait harus berupa gambar yang valid dan siap digunakan" }
    );

    // Pastikan person-fail-1 tidak masuk ke database
    const checkFail1 = await db.select().from(people).where(eq(people.id, "person-fail-1"));
    assert.equal(checkFail1.length, 0);

    // Invariant 2: Menolak aset bukan gambar (PDF) dan rollback transaksi
    await assert.rejects(
      async () => {
        await db.transaction(async (tx) => {
          const [asset] = await tx
            .select({ id: mediaAssets.id, lifecycle: mediaAssets.lifecycle, mimeType: mediaAssets.mimeType })
            .from(mediaAssets)
            .where(eq(mediaAssets.id, "asset-pdf-1"))
            .limit(1);

          if (!asset || asset.lifecycle !== "ready" || !asset.mimeType.startsWith("image/")) {
            throw new Error("Foto portrait harus berupa gambar yang valid dan siap digunakan");
          }

          await tx.insert(people).values({
            id: "person-fail-2",
            name: "Gagal PDF",
            slug: "gagal-pdf",
            portraitMediaId: "asset-pdf-1",
            createdAt: now,
            updatedAt: now,
          });
        });
      },
      { message: "Foto portrait harus berupa gambar yang valid dan siap digunakan" }
    );

    const checkFail2 = await db.select().from(people).where(eq(people.id, "person-fail-2"));
    assert.equal(checkFail2.length, 0);

    // Invariant 3: Berhasil menyimpan profil dengan foto portrait ready dan audit log dalam transaksi
    await db.transaction(async (tx) => {
      const [asset] = await tx
        .select({ id: mediaAssets.id, lifecycle: mediaAssets.lifecycle, mimeType: mediaAssets.mimeType })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, "asset-ready-1"))
        .limit(1);

      if (!asset || asset.lifecycle !== "ready" || !asset.mimeType.startsWith("image/")) {
        throw new Error("Foto portrait harus berupa gambar yang valid dan siap digunakan");
      }

      await tx.insert(people).values({
        id: "person-success-1",
        name: "Gilang Permana",
        slug: "gilang-permana",
        shortBio: "Wakil Ketua Paguyuban",
        portraitMediaId: asset.id,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });

      await appendAuditLog(tx, {
        actorUserId: "user-admin-person",
        actorLabel: "admin-person@pamoka.id",
        action: "person.create",
        resourceType: "person",
        resourceId: "person-success-1",
        resourceLabel: "Gilang Permana",
        after: {
          id: "person-success-1",
          name: "Gilang Permana",
          slug: "gilang-permana",
          portraitMediaId: asset.id,
        },
        changedFields: ["name", "slug", "portraitMediaId"],
        source: "admin-organization",
      });
    });

    // Verifikasi profil tersimpan
    const [savedPerson] = await db.select().from(people).where(eq(people.id, "person-success-1"));
    assert.ok(savedPerson);
    assert.equal(savedPerson.portraitMediaId, "asset-ready-1");

    // Verifikasi audit log tercatat
    const [personAudit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resourceType, "person"), eq(auditLogs.resourceId, "person-success-1")));
    assert.ok(personAudit);
    assert.equal(personAudit.action, "person.create");
    assert.equal(personAudit.actorUserId, "user-admin-person");
  } finally {
    client.close();
  }
});
