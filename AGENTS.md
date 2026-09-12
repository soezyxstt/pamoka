<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Codebase Preview Reminder

> [!IMPORTANT]
> **READ BEFORE WRITING CODE**: This file is the authoritative source for project state, architecture, design system, and execution rules. Skim the full file before starting work. If a statement here conflicts with your training data, this file wins.

# Brand naming

- The project is the official website of **Paguyuban Mojang Jajaka Kabupaten Garut** (PAMOKA Garut).
- Use **PAMOKA Garut** for the site title and formal references; use **MOKA Garut** for the product/consumer-facing brand (footer, socials, metadata template `%s | MOKA Garut`). Never invent other spellings.
- The flagship event is the **Pasanggiri Mojang Jajaka Kabupaten Garut**. Keep the Sundanese tagline as brand copy: **Nu Nyunda Tur Nyakola**.
- Participant categories are fixed codes `JD`, `MD`, `JR`, `MR` (see `categoryValues` in `src/server/db/schema.ts`); they are rendered with their abbreviated label, never invented names.
- Social handles and hashtags are brand copy: `@mokagarut`, `#nyundaturnyakola`, `#kayakarya`.

# Design system

The design reference is the **public site** (`src/app/*` pages plus `src/components/custom/*` and `src/components/*`). The admin CMS surfaces are **NOT** the design reference; when you touch admin UI, reuse the existing admin primitives but steer the styling toward the public system. Do not treat the current admin look (slate-heavy, pill badges, deep shadows) as canonical.

Authoritative tokens live in `src/app/globals.css` (`@theme inline`, `:root`, `.dark`, `@layer base`). Prefer the semantic Tailwind utilities below over hard-coded hex or ad hoc font stacks.

## Font families

| Role | Font | Tailwind | Notes |
|------|------|----------|-------|
| **Headings & brand titles** | **Montserrat** (weights 400-800) | `font-montserrat` | Section headings, hero titles, card titles, page headers. Loaded in `src/style/font.ts`. |
| **Body, UI, captions** | **Inter** (weights 400-800) | `font-inter` | Default on `body` (set in `src/app/layout.tsx`). Paragraphs, nav, footer, form text. |

`next/font` exposes `--font-montserrat-next` and `--font-inter-next`; `@theme` maps `font-montserrat` / `font-inter` to those variables. The `--font-geist-*` tokens in `@theme` are unused defaults; do not rely on them.

## Typography (public)

Use the shared `typography` object from `@/components/custom/typography` for public copy. It is the canonical set, not a suggestion:

| Export | Renders | Base classes | Use |
|--------|---------|--------------|-----|
| `typography.t1` | `h3` | `uppercase text-fb-400 font-montserrat text-base font-bold` | Eyebrow / section label above a heading. |
| `typography.h1` | `h2` | `text-4xl font-semibold font-montserrat` | Section heading. Override size to `text-3xl md:text-5xl` and color to `text-white` on photo sections. |
| `typography.p` | `p` | `text-base font-normal font-montserrat text-[#505050]` | Body copy. `text-justify` and `text-[#505050]` are the established body look. |

Rules:
- Headings are Montserrat; never use Inter for a title and never use `text-gray-900`-style ad hoc heading colors on the public site.
- On dark photo heroes use `text-white` and muted `text-[#ddd]` / `text-white/80`; on light sections use `#505050` body text.
- Body text is left-aligned by default; use `text-justify` only where the design already does.

## Color

Tailwind maps each `--color-*` token to utilities: `text-{name}`, `bg-{name}`, `border-{name}`, and so on.

### Brand palettes (the identity; use first)

| Utility | Role |
|---------|------|
| `dgb`, `dgb-50` … `dgb-900` | Deep green primary. `bg-dgb` for primary buttons and CTAs; `text-dgb-900` for headings; `bg-dgb-50` for soft fills; `to-dgb-800` for hero vignettes. |
| `fb`, `fb-50` … `fb-900` | Firebrand orange accent. `text-fb-400`/`text-fb-500` for eyebrows; `text-fb` for inline highlights; `bg-fb` / `from-fb via-fb-200` for brand strips. |

### Semantic UI (shadcn) ; use for base surfaces

These adapt in light/dark via `:root` / `.dark` and are defined in `globals.css`. The default shadcn `primary` is neutral (near-black), so brand CTAs use `bg-dgb` explicitly rather than `bg-primary`.

| Token / utility | Use |
|-----------------|-----|
| `bg-background` / `text-foreground` | Page surface and primary text. |
| `bg-card` / `text-card-foreground` | Cards and elevated panels. |
| `bg-muted` / `text-muted-foreground` | Subtle fills; de-emphasized text. |
| `bg-secondary` / `text-secondary-foreground` | Secondary surfaces. |
| `border-border` | Default borders and dividers. |
| `bg-input` / `border-input` | Form fields. |
| `text-destructive` / destructive buttons | Errors and destructive actions. |
| `chart-1` … `chart-5` | Recharts series (mapped in theme). |

## Buttons

Public CTAs use `@/components/custom/button` (`rounded-md`, white text). Do not restyle buttons inline.

| Variant | Classes | Use |
|---------|---------|-----|
| `default` | `bg-dgb hover:bg-dgb/90 disabled:bg-dgb-600` | Primary action. |
| `outline` | `border border-dgb bg-transparent hover:bg-dgb hover:text-white` | Secondary action on light surfaces. |
| `destructive` | `bg-destructive` | Destructive action. |

Sizes: `sm` (h-8), `default` (h-9), `lg` (h-10). For links styled as buttons, wrap the custom `Button` in a `Link`.

## Imagery & backgrounds

- Use `next/image` with explicit `width`/`height` (or `fill` inside a sized box) and `object-cover`. Never use plain `<img>` for site assets.
- Full-bleed hero sections: `bg-[url(/asset.webp)] bg-cover bg-center` on the `<section>`, with a radial vignette overlay: `bg-radial-[at_50%_50%] from-transparent to-90% to-dgb-800` (fixed, `pointer-events-none`, `z-0`).
- Legibility washes over photo sections: `bg-dgb-50/90` or `bg-fb-50/90` full-section overlays behind content. Use the `Section` component (`background` + `overlay`) for this pattern.
- `BG` (`@/components/next-image-bg`) is the reusable fixed site-texture background; `HeroVideo` + `HeroTextWrapper` (`@/components/custom/hero-video`, `@/components/custom/hero-text`) are the video-hero pattern with a poster fallback; `ImageMaskFade` (`@/components/custom/image-mask`) is the masked edge image.
- Prefer the established organic crops (`rounded-lg`, `rounded-b-full`, `rounded-t-full`, `rounded-full` circles) for creative compositions; do not invent new shapes.

## Layout & motion

- Mobile-first single column: `flex-col` / `grid-cols-1` under `sm:`, switch with `md:` breakpoints (`max-sm:` for mobile-only overrides). Test at 380px.
- Section rhythm: use the `Section` component (full-bleed, `px-8 md:px-20` / `py-12 md:py-20`, optional `background` + `overlay`); keep existing `min-h-screen` hero rhythm on the homepage.
- Footer: `bg-linear-to-br from-dgb to-fb` with `text-white` content and a `Separator`.
- Animation: `motion/react` (not `framer-motion`) and Lenis smooth scroll (`@/components/lenis`). Hover transitions use `transition-all`/`transition-colors` with short durations (e.g. `duration-500`, `group-hover:scale-102`); entrance uses the `animate-fade-in` keyframes in `globals.css`.
- Icons: `lucide-react`, `size-4` default.

## Radius

- Interactive elements and buttons: `rounded-md`.
- Media: `rounded-lg`; cards/surfaces: `rounded-xl`.
- `rounded-full` is allowed for circles, dots, and the site's organic circular compositions, not for elongated pills.

## Language & copy

- UI copy is **Bahasa Indonesia**, short labels, sentence case (e.g. `Batal`, `Lanjut`, `Selengkapnya`, `Geser untuk melihat berita lain`).
- Sundanese brand phrases (`Nu Nyunda Tur Nyakola`, `Ulin Ngaprak Garut`, and so on) are kept verbatim.
- Numbers over sentences; no exclamation marks, no filler, no em/en dashes.

---

## No Em/En Dashes

- Never use em dashes or en dashes (long hyphen characters) in any file. Use `;`, `,`, or `.` instead. This applies to code comments, UI copy, metadata descriptions, and documentation.

---

## Date & Time Handling

All timestamps are stored as **integer epoch milliseconds** with Drizzle `{ mode: "timestamp_ms" }`. Drizzle maps those columns to and from JS `Date` objects automatically; never treat them as seconds and never re-invent a converter.

### Rules

1. **Schema timestamps**: use `integer(..., { mode: "timestamp_ms" })` for `createdAt`/`updatedAt` and any instant. The shared `timestamps` helper in `src/server/db/schema.ts` is the pattern; reuse it.
2. **Day-granularity text columns**: `voteDailyTallies.localDate` stores a `yyyy-MM-dd` string (validated by `/^\d{4}-\d{2}-\d{2}$/`). Generate and validate it with that exact format; do not hand-roll a different date string.
3. **Timezones**: `edition.timezone` and `votingCampaign.timezone` default to `Asia/Jakarta` (WIB, `+07:00`). For WIB deadlines use explicit offset literals, e.g. `new Date("2025-08-09T23:59:59+07:00")` (see `src/proxy.ts` and `src/components/navbar.tsx`). Never assume the server clock is WIB.
4. **Display formatting**: use `Date.prototype.toLocaleDateString("en-US", ...)` with an uppercase month for badge dates (pattern in `src/lib/metadata-fetcher.ts` and `getBadgeInfo` in `src/components/news-card.tsx`).
5. **Hydration safety**: the root `<html>` already uses `suppressHydrationWarning`. Keep server and client date rendering identical so the UI never flashes a different date.
6. **Deterministic tests**: pass explicit `Date` values (or `now` injection, see `src/server/db/mutations.ts`) instead of calling `new Date()` inside tested code paths.

---

## Media & Uploads

All uploads go through **UploadThing** only. There is no R2, S3, or local-blob write path. Do not add one.

- Client helpers: `src/lib/uploadthing.ts`; server config: `src/app/api/uploadthing/core.ts`.
- Limits are finite policy constants in `src/server/media/policy.ts`, never inline and never unlimited:
  - Images: 32 MB route cap, 20 MB application-level cap, max 10 files.
  - Video: 512 MB, max 1 file.
  - PDF: 64 MB, max 5 files.
- Every upload creates a `mediaAsset` row (`provider`, `url`, `filename`, `mimeType`, `bytes`, `alt`, `decorative`, `ownerUserId`).
- Fill `alt` for informative images; mark purely decorative assets `decorative: true`. Reuse the same asset across content instead of re-uploading.
- Uploads and media mutations are authenticated and go through server actions with permission checks and audit; never expose an unauthenticated upload endpoint.
- Do not upload personal data, credentials, or documents that should stay private.

---

## Execution Rules

1. Before DB or env work, read `src/server/db/schema.ts` and `src/env.js` for the current schema and env state.
2. Schema changes: edit `src/server/db/schema.ts` only, then `npm.cmd run db:generate`, review the generated SQL in `drizzle/`, run `npm.cmd run db:check`. Apply with `npm.cmd run db:migrate` only to the explicitly chosen target (`DRIZZLE_DATABASE_URL` / `DRIZZLE_AUTH_TOKEN` are separate from the app env). Never `drizzle-kit push`, never hand-edit `drizzle/`, never run production migrations without authorization.
3. After every meaningful edit batch: `npm.cmd run verify` (db tests, Next type generation, typecheck, lint, production build) or at least `npm.cmd run lint` + `npm.cmd run typecheck`. All must pass with zero new errors. Do not invent other lint/build commands.
4. Every write is a server action with `requirePermission(...)` from `src/server/auth/authorization.ts` plus `appendAuditLog` inside the same database transaction (`src/server/auth/audit.ts`). Hidden UI controls, client checks, or a redirect are never proof of authorization.
5. Follow the plans programme in `plans/README.md`. Read the full plan plus its dependencies, restate the in-scope files and STOP conditions, update the status row to `IN PROGRESS`, and run the drift check against baseline commit `3874ede` before editing.
6. No production migration, super-admin promotion, upload, deploy, or public cutover without the operator's explicit authorization for that exact action and target. Follow the runbooks in `docs/runbooks/`.
7. The public site is currently the source of truth (hard-coded content). Database content is exercised through the admin preview/staging flow until Plan 010 cutover is authorized. Do not wire public routes to live CMS data ahead of that.
8. UI copy: Bahasa Indonesia, short labels, sentence case, numbers over sentences. No exclamation marks, no filler, no em/en dashes.
   - Tampilkan deskripsi admin hanya saat membantu keputusan atau tindakan; jangan mengulang judul dan konteks edisi.
   - Jangan gunakan ikon `Sparkle` atau `Sparkles` di area admin maupun UI baru; pilih ikon semantik yang menjelaskan fungsi. Jangan mengubah public UI existing untuk aturan ini.
   - Semua kontrol admin memakai primitive shadcn lokal berbasis Radix atau wrapper Admin primitive; migrasi caller dilakukan bertahap sesuai checkpoint.
   - Voting selalu tersedia untuk setiap edisi; kampanye, tally, dan visibilitas hasil tetap terisolasi berdasarkan edisi.
   - Scrollbar kustom hanya boleh scoped pada area admin; jangan mengubah scrollbar global, public site, font, atau globals untuk kebutuhan admin.
9. **Auto-update docs**: every time you add a feature, table, env var, or change core architecture, update the relevant docs:
   - `docs/admin-guide-id.md` for user-facing admin workflows
   - `docs/runbooks/*` for manual operator procedures
   - `plans/README.md` for plan status and architecture decisions
   - `AGENTS.md` Project State section for completed/blocked items
   Scan `docs/` and `plans/` for any file made inaccurate by the change and update it.

---

## Project State

### Plans (authoritative status lives in `plans/README.md`)

| Plan | Title | Status |
|------|-------|--------|
| 001 | Replace PostgreSQL and Prisma with Turso and Drizzle | DONE |
| 002 | Restore the verification baseline and upgrade to Next.js 16.2.12 | DONE |
| 003 | Add Google OAuth, access requests, and granular RBAC | DONE |
| 004 | Add annual CMS data models, revisions, and transactional audit logs | DONE |
| 005 | Build the reusable admin shell, dashboard, users, profile, and audit UI | DONE |
| 006 | Add the media library with authenticated UploadThing uploads | DONE |
| 007 | Move global, home, news, sponsor, and organization content into the CMS | DONE |
| 008 | Move editions, participants, events, carousels, and galleries into the CMS | DONE |
| 009 | Make voting campaigns, tallies, visibility, and results manageable | DONE |
| 010 | Import 2025 content, run end-to-end QA, and perform a reversible cutover | IN PROGRESS (not authorized) |
| 011 | Unify public and admin design, media navigation, and annual CMS context | DONE |
| 012 | Admin CMS PAMOKA Berbasis Edisi | IN PROGRESS (rework) |
| 013 | Migrasi total Next.js ke Laravel + Inertia React | IN PROGRESS (Stage 10C) |

### Verified / working

- Turso (libSQL) + Drizzle data layer with the seed of 44 finalists and 572 zero-income daily rows over 13 dates (`npm run db:seed`; refuses non-seed databases).
- Better Auth Google login with pending access requests, composable roles, permission overrides, and transactional audit. No automatic super-admin bootstrap; the first super admin is promoted manually in Turso per `docs/runbooks/bootstrap-super-admin.md`.
- Admin shell with permission-filtered navigation (`/admin`), active edition selector in header with cookie persistence, collapsible content sidebar, reusable media picker (`AdminMediaPicker`), and edition-scoped folders.
- Baseline Plan 012 implementation remains available while the supervisor-gated rework proceeds:
  * Identitas edisi & program unggulan (`/admin/content/edition-settings`).
  * Aset situs tetap dengan 24 slot manifest terdefinisi (`/admin/content/site-assets`).
  * Manajemen sponsor dengan modal sheet editor, tier grouping, dan live card preview (`/admin/content/sponsors`).
  * Studio berita TipTap WYSIWYG dengan image insertion, autosave draft, dan live split preview (`/admin/content/news`).
  * Kepengurusan organisasi multi-periode dengan struktur pohon hierarkis dan direktori orang (`/admin/organization`).
  * Panitia pelaksana terisolasi per edisi dengan struktur pohon hingga 4 level (`/admin/content/committee`).
  * Baseline peserta masih memakai stage tetap. Plan rework menggantinya dengan input pendaftar manual, stage linear dinamis, keputusan lolos, gelar multi-assignment, dan QRIS gambar eksternal (`/admin/content/participants`).
  * Rangkaian acara dan studio galeri terpadu dengan album standalone/event, video YouTube, dan live split preview (`/admin/content/events`, `/admin/content/galleries`).
  * Operasional voting terisolasi per edisi dengan rekap tally harian merchant QRIS dan switch visibilitas hasil (`/admin/voting`).
  * Dashboard utama dengan panel checklist kesiapan edisi (8 indikator kesiapan) dan pintas navigasi cepat (`/admin`).
- Public routes remain intact and live: `/`, `/tentang`, `/rangkaian-kegiatan`, `/voting`, `/profil-finalis`, `/voting/hasil`, `/monitor`.
- Laravel target application is scaffolded under `laravel/` with an Inertia React home foundation. It runs beside the Next.js application; no public cutover has happened.
- Plan 013 Stage 2 inventory is complete in `plans/013-route-domain-inventory.md`: 47 page routes, 4 layouts, 2 API route handlers, 48 legacy or CMS tables, domain boundaries, source-of-truth risks, migration slice order, parity gates, and stop conditions are documented. No Next.js source or operator database was changed.
- Plan 013 Stage 3 is complete for the target shell: public Inertia layout, brand tokens, responsive navigation, footer, 9 dynamic public route contracts, and a branded 404 page. Feature content is still not ported and no public cutover has happened.
- Plan 013 Stage 4 core data foundation is complete in `laravel/`: local MySQL configuration, isolated `pamoka_test` PHPUnit database, UUID models and migrations for organization periods, editions, categories, selection stages, and participants, plus the fixed `CategoryCode` enum. The target database is local only; no operator migration or public cutover has happened.
- Plan 013 Stage 5 auth foundation is complete in `laravel/`: Google OAuth adapter with state validation, Laravel sessions, pending admin profiles, access requests, role and permission tables, per-user overrides, immutable audit model, Role Administrator approval, admin auth pages, and edition context selection. Local Google credential presence and redirect smoke are verified; real Google handshake remains unverified until the operator completes a login; no operator migration or public cutover has happened.
- Plan 013 Stage 6 public core is complete in `laravel/`: home and tentang now use a server-owned hardcoded content snapshot, local assets, metadata, fallback copy, local public PDF, dedicated Inertia pages, route contracts, HTTP smoke, and desktop or narrow viewport QA. CMS and operator database data remain outside the public read path.
- Plan 013 Stage 7A participant read slice is complete in `laravel/`: active-edition public read model, fixed category validation for `JD`, `MD`, `JR`, and `MR`, finalis or semifinalis list and detail pages, active participant filtering, empty-state fallback, local hero asset, route feature tests, HTTP smoke, and desktop or narrow viewport QA. Participant media, achievements, titles, full data import, and public cutover remain outside this slice.
- Plan 013 Stage 7B profile foundation is complete in `laravel/`: additive MySQL tables and UUID Eloquent models for media assets, participant media, achievements, social links, edition titles, and title assignments. The public reader eager-loads these relations, filters ready media and same-edition titles, and exposes them on the Inertia profile detail page. Upload, admin authoring, full data import, and public cutover remain outside this slice.
- Plan 013 Stage 7C import rehearsal is complete in `laravel/`: a source-hashed snapshot exporter, 60 participant records with 104 stage entries, 164 achievements, 60 validated local media assets, an explicit dry-run or apply Artisan command, a nonlocal-target guard, and idempotent test-database verification. The source contains no 2025 title or social-link mapping, so those fields remain empty. No operator database import or public cutover happened.
- Plan 013 Stage 8A event route slice is complete in `laravel/`: the six 2025 event entries initially render through an Inertia React page with ten local WebP images per event and the preserved 68 sponsor logos. Invalid event slugs return 404. Stage 8D adds the database-first event, gallery, and sponsor read path without changing the initial snapshot boundary.
- Plan 013 Stage 8B news read slice is complete in `laravel/`: the three stable home news cards now come from `PublicNewsCatalog`, preserve the local PDF and image assets, and keep external article URLs without runtime scraping. News database authoring, new detail routes, and public cutover remain outside this slice.
- Plan 013 Stage 8C news foundation is complete in `laravel/`: `news_articles` migration, `NewsArticle` model and factory, validated 2025 fixture, local-only idempotent importer, and database-first public news reader with snapshot fallback are in place. The rehearsal ran twice on `pamoka_test`; the `pamoka` migration remains pending and no operator data was imported.
- Plan 013 Stage 8D public media foundation is complete in `laravel/`: `events`, `galleries`, `gallery_items`, and `sponsors` migrations, UUID Eloquent models and factories, validated 2025 fixture, local-only idempotent importer, one-source gallery-item constraint, and database-first readers for event photos, About videos, and sponsor logos with snapshot fallback are in place. The rehearsal contains 6 events, 7 galleries, 69 items, 68 sponsors, and 128 media assets, ran twice on `pamoka_test`, and has not been applied to `pamoka`.
- Plan 013 Stage 8E public detail and organization read models are complete in `laravel/`: the constrained `/berita/{slug}` route and Inertia detail page support published, active-edition articles, safe TipTap nodes, local or external source links, and snapshot fallback; additive `people`, `organization_units`, `organization_memberships`, and `organization_assignments` tables, UUID models, validated organization fixture, local-only idempotent importer, portrait media, and database-first About leadership data are also in place. The organization rehearsal contains 19 people, 21 assignments, and 19 portrait assets, ran twice on `pamoka_test`, and has not been applied to `pamoka`.
- Plan 013 Stage 8F public voting and monitor read models are complete in `laravel/`: additive voting campaign, participant snapshot, daily tally, and QR media relations, validated 2025 fixture, local-only idempotent importer, database-first voting listing, detail, results, and permission-gated monitor pages are in place. The rehearsal contains 1 historical campaign, 44 finalists, 44 QR assets, 13 tally dates, and 572 zero-value tally rows, ran twice on `pamoka_test`, and has not been applied to `pamoka`.
- Plan 013 Stage 9A news authoring is complete in `laravel/`: edition-scoped admin list, create, edit, draft save, publish, unpublish, archive, delete, optimistic version checks, `content_drafts`, `content_revisions`, permission-gated mutations, transactional audit records, ready image cover selection, HTTPS or internal source URL validation, and structured paragraph input are available at `/admin/content/news`. The initial slice used a plain structured editor; the WYSIWYG core is reconciled in Stage 10B. Operator database import and public cutover remain outside this slice.
- Plan 013 Stage 9B sponsor, event, and gallery authoring is complete in `laravel/`: edition-scoped CRUD, specific `sponsors.manage`, `events.manage`, and `gallery.manage` permissions, ready image validation, sponsor activation permission checks, event reorder, gallery owner validation, photo or YouTube item management, item reorder, optimistic version checks, and transactional audit records are available under `/admin/content/sponsors`, `/admin/content/events`, and `/admin/content/galleries`. The slice does not yet include UploadThing, operator database import, or public cutover.
- Plan 013 Stage 9C participant authoring is complete in `laravel/`: edition-scoped participant list and filters, manual applicant creation into the first open selection stage, identity editing, achievements, social links, multi-role profile media, QRIS and payment URL binding, active status, safe deletion of unprocessed pending applicants, ready image validation, optimistic version checks, specific permissions, transactional audit records, and route coverage are available under `/admin/content/participants`. Selection-stage workspace, title assignment, UploadThing, operator database import, and public cutover remain outside this slice.
- Plan 013 Stage 9D selection and title authoring is complete in `laravel/`: edition-scoped selection-stage CRUD, lifecycle transitions, decision workspace, bulk decisions, rollback reasons, safe reopen, forwarding participants to the next stage, safe deletion, title CRUD, capacity, ordering, activation, and multi-title assignment restricted to final-stage participants are available under `/admin/content/participants/stages` and `/admin/content/participants/titles`. UploadThing, operator database import, and public cutover remain outside this slice.
- Plan 013 Stage 9E organization authoring is complete in `laravel/`: global organization periods, vision and mission metadata, explicit edition reassignment, reusable people directory with social links and ready portrait assets, four-level cycle-safe organization units, memberships, legacy assignment mapping, permission checks, optimistic versions, transactional writes, audit records, and Inertia pages are available under `/admin/organization` and `/admin/organization/periods/{id}`. UploadThing, operator database import, public cutover, and authenticated browser visual QA remain outside this slice.
- Plan 013 Stage 9F committee authoring is complete in `laravel/`: edition-scoped committee units, four-level cycle-safe hierarchy, sibling reorder, reusable person assignment, quick person creation with ready portrait validation, active state, controlled cascade deletion, optimistic assignment versions, permission checks, transactional writes, audit records, and an Inertia page are available under `/admin/content/committee`. UploadThing, operator database import, public cutover, and authenticated browser visual QA remain outside this slice.
- Plan 013 Stage 9G edition settings and site asset authoring are complete in `laravel/`: edition logo and slogan, edition programs with CRUD and reorder, fixed 24-slot site asset manifest, media type validation, alt override, focal point clamping, edition isolation, optimistic versions, permission checks, transactional writes, audit records, and Inertia pages are available under `/admin/content/edition-settings` and `/admin/content/site-assets`. UploadThing, operator database import, public cutover, and authenticated browser visual QA remain outside this slice.
- Plan 013 Stage 9H voting operations authoring is complete in `laravel/`: draft campaign creation, source-stage selection, participant snapshots, manual start and close lifecycle, result visibility with reasons, daily WIB tally creation and correction, ready QRIS validation, edition isolation, optimistic versions, permission checks, transactional writes, audit records, and an Inertia page are available under `/admin/voting`. UploadThing, operator database import, public cutover, and authenticated browser visual QA remain outside this slice.
- Plan 013 Stage 9I media library authoring is complete in `laravel/`: global and edition-scoped hierarchical folders, ready asset browsing with search, type filters and pagination, alt and decorative metadata, asset moves, duplicate slug validation, permission checks, transactional writes, audit records, and an Inertia page are available under `/admin/media`. UploadThing runtime integration, operator database import, public cutover, and authenticated browser visual QA remain outside this slice.
- Plan 013 Stage 9J admin workspace parity is complete in `laravel/`: profile status, effective role permissions, latest 100 audit entries, content module overview, and compatibility redirects for legacy pages and people routes are available under `/admin/profile`, `/admin/audit`, and `/admin/content`. Edition and category authoring, UploadThing runtime integration, operator database import, public cutover, and authenticated browser visual QA remain outside this slice.
- Plan 013 Stage 9K edition and category authoring is complete in `laravel/`: edition listing, draft creation, fixed `JD`, `MD`, `JR`, and `MR` category codes, year and slug validation, activation reason, archiving of the previous active edition, permission checks, transactional writes, audit records, and an Inertia page are available under `/admin/content/editions`. UploadThing runtime integration, operator database import, public cutover, and authenticated browser visual QA remain outside this slice.
- Plan 013 Stage 9L UploadThing reconciliation is complete in `laravel/`: the `/api/uploadthing` metadata and upload boundary, finite image, video, and PDF policy, media.manage authorization, UploadThing-compatible key and signed URL generation, route metadata registration, HMAC callback verification, callback-result reporting, idempotent `media_assets` persistence, transactional audit, and a React uploader on `/admin/media` are available. No local blob, S3, or R2 write path was added. External provider handshake, operator database import, public cutover, and authenticated browser visual QA remain outside this slice.
- Plan 013 Stage 10A complete in `laravel/`: `moka:rehearse-2025` validates all five public 2025 fixtures before writing, runs the participant, news, public media, organization, and voting importers within one outer transaction, is idempotent, and permits apply only on the local `pamoka_test` database. Focused route checks cover home, about, event, news detail, finalists, and voting results after rehearsal. Operator import, editor parity, external provider handshake, authenticated browser QA, and public cutover remain outside this slice.
- Plan 013 Stage 10B complete in `laravel/`: news authoring now uses a Laravel TipTap WYSIWYG editor with heading, inline formatting, safe links, lists, blockquotes, undo or redo, and ready media insertion. `TipTapDocumentSanitizer` normalizes the persisted document, requires media references for images, verifies ready image assets, and materializes server-owned media URLs before publish. Focused and full Laravel tests, Pint, TypeScript, and Vite build passed. Autosave, split preview, revision restore, operator import, external provider handshake, authenticated browser QA, and public cutover remain outside this slice.
- Plan 013 Stage 10C complete in `laravel/`: the news studio adds 1.5 second debounced autosave for existing articles, explicit Editor, Terpisah, and Preview modes, safe local preview rendering, revision snapshot props, and restoration of a selected revision into the editor as a new draft change. Autosave reuses the permission, optimistic version, transaction, audit, and revision boundary of the existing update route. Full Laravel tests passed with 112 tests and 1,508 assertions, alongside Pint, TypeScript, and Vite build. Final route or data parity, operator import, external provider handshake, authenticated browser QA, and public cutover remain outside this slice.
- Baseline commit for the plans drift check: `3874ede`.

### Blockers

- Plan 010 cutover (public runtime switch to live CMS data) is intentionally deferred until the operator authorizes it. Until then the hard-coded site stays live.
- Plan 013 current checkpoint is Stage 10C. The next implementation slice is final route or data parity gates and unresolved 2025 mappings; external provider handshake, operator import, and public cutover remain explicit reconciliation items.
- Plan 013 Stage 10C passed with 8 focused authoring tests and 75 assertions. The full Laravel suite passed with 112 tests and 1,508 assertions, Pint, Laravel TypeScript check, Vite production build, and the rich text studio contracts on isolated MySQL `pamoka_test`. The rehearsal and editor data remain local only; final route or data parity, 2025 title or social mapping, external provider handshake, authenticated browser QA, and public cutover are still open.
- Plan 013 migration is staged and checkpointed. Stage 1 through Stage 9L passed their focused Laravel contracts, isolated MySQL rehearsal gates, Pint, Laravel TypeScript check, and Vite production build. Stage 10A passed the complete 2025 rehearsal gate. Stage 10B passed the rich text authoring gate with 8 focused tests and 74 assertions, full Laravel coverage at 112 tests and 1,496 assertions, Pint, TypeScript, and Vite production build. The next slice is final route or data parity and editor studio parity; autosave, split preview, revision restore, 2025 title or social mapping, provider handshake, operator import, authenticated browser QA, and public cutover remain explicit reconciliation items.
- Plan 012 rework berjalan bertahap dan dikendalikan supervisor; checkpoint 1, 1b, 2A, 2B.1, 2B.2A, 2B.2B, 2B.3, CP2B.4 source implementation, CP1C.1, CP1C.2, CP1C.3A, CP1C.3B, CP1C.4, CP3, CP4, CP5, CP6, source CP7, source CP8A, source CP8B, source CP8C, source CP9, source CP10, dan source CP11 diterima. CP8A menambahkan skema additive serta backfill idempotent. CP8B menangani pendaftar manual serta stage linear dinamis. CP8C mengunci detail peserta ke edisi aktif, menjadikan stage hanya-baca, memakai QRIS gambar eksternal, serta menambahkan gelar per edisi dengan capacity dan assignment multi-gelar hanya bagi peserta tahap final. CP9 memisahkan pengelolaan acara dan album, mengunci owner ke edisi aktif, serta mewajibkan tepat satu sumber per item galeri. CP10 memakai stage voting dinamis, snapshot saat mulai manual, QRIS gambar siap pakai, tally terisolasi per edisi, serta dashboard dengan 10 indikator kesiapan. CP11 menghapus caller legacy dan merangkum overview Konten tanpa menghapus data kompatibilitas. Migrasi `0013` dan `0014` serta backfill belum diterapkan ke database operator mana pun. Browser dataset nonempty, runtime upload, true FormData, viewport admin 380 px, autosave artikel nyata, QA detail periode kepengurusan berisi data, runtime visual CP7, runtime visual CP8B, runtime visual CP8C, runtime visual CP9, runtime visual CP10, dan runtime QA CP11 tetap OPEN.
- Plan 013 Stage 9C lulus dengan 4 test terarah dan 47 assertions. Route peserta telah diperiksa, build Vite dan TypeScript Laravel lulus, dan seluruh workflow authoring diuji pada database MySQL test terisolasi. Tahap seleksi, assignment gelar, upload media, import operator, dan cutover publik masih terbuka.
- Plan 013 Stage 9D lulus dengan 5 test terarah dan 86 assertions. Suite Laravel penuh lulus pada 75 test dan 935 assertions; route, Pint, TypeScript Laravel, dan Vite build juga lulus pada database MySQL test terisolasi. Upload media, import operator, dan cutover publik masih terbuka.
- Plan 013 Stage 9F lulus dengan 4 test terarah dan 59 assertions. Suite Laravel penuh lulus pada 83 test dan 1.060 assertions; 9 route committee, Pint, TypeScript Laravel, Vite build, dan migration juga lulus pada database MySQL test terisolasi. Upload media, import operator, dan cutover publik masih terbuka.

---

## Core Architectural Stack

- **Framework**: Next.js 16 (App Router) under `src/`, React 19, TypeScript, Tailwind CSS v4 (`@theme inline`, `@custom-variant dark`). App code lives in `src/app`, `src/components`, `src/lib`, `src/server`.
- **Database**: Turso (libSQL) with Drizzle ORM. DB access via `src/server/db/client.ts` (`database`), queries in `src/server/db/queries.ts`, mutations in `src/server/db/mutations.ts`, schema in `src/server/db/schema.ts`. PostgreSQL and Prisma were removed in Plan 001; never reintroduce them.
- **Auth**: Better Auth 1.6.x with Google OAuth (`src/server/auth/config.ts`), roles and permission overrides in `src/server/auth/permissions.ts`, authorization boundary in `src/server/auth/authorization.ts`, immutable audit in `src/server/auth/audit.ts`. No email/password provider.
- **Media**: UploadThing (`src/app/api/uploadthing`), policy in `src/server/media/policy.ts`.
- **CMS domain**: editions, categories, participants, events, galleries, news, sponsors, people, page sections, content drafts/revisions, voting campaigns and daily tallies, plus auth/audit tables. All in `src/server/db/schema.ts`.
- **Env**: `src/env.js` (server-only `TURSO_*`, `BETTER_AUTH_*`, `GOOGLE_*`, `BASE_URL`). There are no `FEATURE_*` flags; do not invent a feature-flag system.
- **UI**: radix primitives + shadcn-style components in `src/components/ui`, custom brand components in `src/components/custom`, lucide-react icons, `motion` + Lenis for animation, recharts for charts, sonner for toasts.
- **Commands**: npm (not bun). See the scripts table in `package.json` (`dev`, `verify`, `db:generate`, `db:check`, `db:migrate`, `db:seed`, `db:inspect`, `cms:*`).

---

## UI Primitives & Layout

### Public primitives

| Need | Use | Import |
|---|---|---|
| Headings / body copy | `typography.t1`, `typography.h1`, `typography.p` | `components/custom/typography` |
| Section shell / full-bleed background + overlay | `Section`, `Vignette` | `components/custom/section` |
| Section eyebrow + title + description | `SectionHeader` | `components/custom/section-header` |
| Finalis card grid | `FinalistCard` | `components/custom/finalist-card` |
| Video hero (poster fallback) | `HeroVideo` | `components/custom/hero-video` |
| Hero text fade-in wrapper | `HeroTextWrapper` | `components/custom/hero-text` |
| Masked edge image | `ImageMaskFade` | `components/custom/image-mask` |
| Buttons | `Button` (custom; `rounded-md`) | `components/custom/button` |
| Background texture | `BG` | `components/next-image-bg` |
| Modals / confirms | `AlertDialog` | `components/ui/alert-dialog` |
| Side panels | `Sheet` | `components/ui/sheet` |
| Selects / inputs | `Select`, `Input`, `Textarea`, `ScrollArea` | `components/ui/*` |
| Cards | `Card` | `components/ui/card` |
| Carousel | `Carousel` (embla) | `components/ui/carousel` |
| Tables | `Table` family | `components/ui/table` |
| Toasts | `Toaster` (sonner) | `components/ui/sonner` |
| Accordion / popover | `Accordion`, `Popover` | `components/ui/*` |
| Icons | lucide-react, default `size-4` | `lucide-react` |

### CMS primitives (reuse, but not the design reference)

`src/components/admin/primitives.tsx` provides the shared building blocks for the admin: `AdminPage`, `AdminCard`, `AdminCardHeader`, `AdminField`, `AdminInput` / `AdminSelect` / `AdminTextarea`, `AdminButton` / `AdminLinkButton`, `AdminBadge`, `AdminStatCard`, `AdminEmptyState`, `AdminListRow`. The admin shell lives in `src/components/admin/admin-shell.tsx`.

Rules for admin work:
- Compose from these primitives instead of hand-rolling per-page markup; a lint-clean file does not excuse duplication.
- Do not copy the current admin styling (slate-heavy backgrounds, `rounded-full` status pills, strong card shadows) into new UI. The public site is the design reference; align new admin UI with Montserrat headings, `dgb`/`fb` brand colors, `rounded-md`/`rounded-xl`, and the shared semantic tokens.
- Keep dialog/form shells in `components/ui/*` and radix; do not introduce a second component library.
- Server actions stay thin: permission check, validation, transaction + audit, `revalidatePath`.
