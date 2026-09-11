import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { categories } from '@/lib/data';

type SourceParticipant = {
  no: number | string;
  name: string;
  description?: string;
  achievements?: string[];
};

type ExportParticipant = {
  name: string;
  slug: string;
  number: number;
  bio: string | null;
  stage: 'semifinal' | 'final';
  displayOrder: number;
  source: 'data.ts' | 'finalist.ts';
  media: {
    role: 'closeup';
    url: string;
    sourcePath: string;
    alt: string;
  };
  achievements: string[];
};

type ExportCategory = {
  code: 'JD' | 'MD' | 'JR' | 'MR';
  slug: string;
  label: string;
  displayOrder: number;
  stages: Array<{
    key: 'semifinal' | 'final';
    name: string;
    slug: string;
    displayOrder: number;
    targetParticipantCount: number;
    finalStage: boolean;
  }>;
  participants: ExportParticipant[];
};

type ExportDocument = {
  schemaVersion: 1;
  sourceFiles: string[];
  sourceHash: string;
  edition: {
    year: 2025;
    slug: '2025';
    name: string;
    lifecycle: 'active';
    timezone: 'Asia/Jakarta';
  };
  categories: ExportCategory[];
  titles: [];
  notes: string[];
};

const sourceFiles = ['src/lib/data.ts', 'src/lib/finalist.ts'];
const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex === -1
  ? 'laravel/database/fixtures/participants-2025.json'
  : process.argv[outputIndex + 1] ?? (() => { throw new Error('Argumen --output membutuhkan path'); })();
const shouldWrite = process.argv.includes('--write');

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
}

function assertSourceParity(category: (typeof categories)[number], finalist: SourceParticipant, semifinalist: SourceParticipant): void {
  if (finalist.description !== semifinalist.description) {
    throw new Error(`Deskripsi berbeda untuk ${category.abrev} ${finalist.name}`);
  }

  if (JSON.stringify(finalist.achievements ?? []) !== JSON.stringify(semifinalist.achievements ?? [])) {
    throw new Error(`Prestasi berbeda untuk ${category.abrev} ${finalist.name}`);
  }
}

function buildDocument(sourceHash: string): ExportDocument {
  const exportedCategories = categories.map((category, categoryIndex): ExportCategory => {
    const semifinalists = category.list as SourceParticipant[];
    const finalists = category.finalist as SourceParticipant[];
    const semifinalByName = new Map(semifinalists.map((participant) => [normalizeName(participant.name), participant]));

    const finalParticipants = finalists.map((finalist, finalistIndex): ExportParticipant => {
      const semifinalist = semifinalByName.get(normalizeName(finalist.name));

      if (semifinalist === undefined) {
        throw new Error(`Finalis ${category.abrev} ${finalist.name} tidak ditemukan pada data semifinalis`);
      }

      assertSourceParity(category, finalist, semifinalist);

      return {
        name: finalist.name,
        slug: slugify(finalist.name),
        number: Number(finalist.no),
        bio: finalist.description ?? null,
        stage: 'final',
        displayOrder: finalistIndex,
        source: 'finalist.ts',
        media: {
          role: 'closeup',
          url: `/finalis/${category.abrev}/${category.abrev}${String(finalist.no).padStart(2, '0')}.webp`,
          sourcePath: `public/finalis/${category.abrev}/${category.abrev}${String(finalist.no).padStart(2, '0')}.webp`,
          alt: finalist.name,
        },
        achievements: finalist.achievements ?? [],
      };
    });

    const finalNames = new Set(finalists.map((participant) => normalizeName(participant.name)));
    const semifinalOnlyParticipants = semifinalists
      .filter((participant) => !finalNames.has(normalizeName(participant.name)))
      .map((participant, semifinalIndex): ExportParticipant => ({
        name: participant.name,
        slug: slugify(participant.name),
        number: Number(participant.no),
        bio: participant.description ?? null,
        stage: 'semifinal',
        displayOrder: finalists.length + semifinalIndex,
        source: 'data.ts',
        media: {
          role: 'closeup',
          url: `/peserta/${category.abrev}/${participant.name.split(' ').join('_')}/default.png`,
          sourcePath: `public/peserta/${category.abrev}/${participant.name.split(' ').join('_')}/default.png`,
          alt: participant.name,
        },
        achievements: participant.achievements ?? [],
      }));

    const participants = [...finalParticipants, ...semifinalOnlyParticipants];

    return {
      code: category.abrev,
      slug: category.slug,
      label: category.name,
      displayOrder: categoryIndex,
      stages: [
        {
          key: 'semifinal',
          name: 'Semifinalis',
          slug: 'semifinalis',
          displayOrder: 0,
          targetParticipantCount: participants.length,
          finalStage: false,
        },
        {
          key: 'final',
          name: 'Finalis',
          slug: 'finalis',
          displayOrder: 1,
          targetParticipantCount: finalParticipants.length,
          finalStage: true,
        },
      ],
      participants,
    };
  });

  return {
    schemaVersion: 1,
    sourceFiles,
    sourceHash,
    edition: {
      year: 2025,
      slug: '2025',
      name: 'Pasanggiri Mojang Jajaka Garut 2025',
      lifecycle: 'active',
      timezone: 'Asia/Jakarta',
    },
    categories: exportedCategories,
    titles: [],
    notes: [
      'Data peserta digabung berdasarkan nama antara daftar semifinalis dan finalis.',
      'Gelar edisi dan sosial link tidak tersedia pada source hardcoded 2025, sehingga tidak diinferensikan.',
      'Media merujuk pada asset lokal source dan harus diverifikasi sebelum import diterapkan.',
    ],
  };
}

async function main(): Promise<void> {
  const hash = createHash('sha256');

  for (const filename of sourceFiles) {
    hash.update(filename).update(await readFile(filename));
  }

  const document = buildDocument(hash.digest('hex'));
  const participants = document.categories.flatMap((category) => category.participants);
  const media = new Set(participants.map((participant) => participant.media.sourcePath));

  for (const sourcePath of media) {
    await access(sourcePath);
  }

  const summary = {
    mode: shouldWrite ? 'write' : 'check',
    sourceHash: document.sourceHash,
    categories: document.categories.length,
    participants: participants.length,
    finalists: participants.filter((participant) => participant.stage === 'final').length,
    semifinalistsOnly: participants.filter((participant) => participant.stage === 'semifinal').length,
    achievements: participants.reduce((total, participant) => total + participant.achievements.length, 0),
    media: media.size,
    titles: document.titles.length,
    output: outputPath,
  };

  if (shouldWrite) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
