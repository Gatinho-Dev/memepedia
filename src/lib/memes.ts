import "server-only";
import { all, count, get, pluck, reindexMeme, run, tx, nowIso, dayKey, buildFtsQuery } from "./db";
import { notifyFollowers } from "./auth";
import { MEME_FIELDS, type ProtectionLevel } from "./types";

/**
 * Meme content service: reads, writes, versions, diffs and search.
 *
 * Content lives in structured columns rather than one HTML blob. That choice
 * pays off three times: the editor is a real form, version diffs are per-field
 * instead of line-based noise, and there is no HTML sink to sanitise because
 * rich text is rendered through a React renderer, never through
 * dangerouslySetInnerHTML.
 */

export const MEME_CONTENT_COLUMNS = [
  "name",
  "short_description",
  "origin",
  "history",
  "usage_notes",
  "characteristics",
  "variations",
  "trivia",
  "sources",
  "approx_year",
  "approx_period",
  "country",
  "region",
  "category_id",
] as const;

export type MemeContentColumn = (typeof MEME_CONTENT_COLUMNS)[number];

export interface MemeSnapshot {
  name: string;
  short_description: string;
  origin: string;
  history: string;
  usage_notes: string;
  characteristics: string;
  variations: string;
  trivia: string;
  sources: string;
  approx_year: number | null;
  approx_period: string;
  country: string;
  region: string;
  category_id: number | null;
  tags: string[];
}

export interface MemeRow {
  id: number;
  slug: string;
  name: string;
  short_description: string;
  origin: string;
  history: string;
  usage_notes: string;
  characteristics: string;
  variations: string;
  trivia: string;
  sources: string;
  approx_year: number | null;
  approx_period: string;
  country: string;
  region: string;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  status: string;
  protection: ProtectionLevel;
  verified: number;
  featured: number;
  comments_enabled: number;
  is_demo: number;
  popularity: number;
  views_count: number;
  versions_count: number;
  contributions_count: number;
  followers_count: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  updated_by: number | null;
  published_at: string | null;
  deleted_at: string | null;
  author_name: string | null;
  editor_name: string | null;
}

export interface MemeListItem {
  id: number;
  slug: string;
  name: string;
  short_description: string;
  category_name: string | null;
  category_slug: string | null;
  views_count: number;
  versions_count: number;
  updated_at: string;
  created_at: string;
  popularity: number;
  verified: number;
  featured: number;
  approx_year: number | null;
  country: string;
  is_demo: number;
  protection: ProtectionLevel;
  thumb_url: string | null;
  media_kind: string | null;
  tags: string[];
}

/* -------------------------------------------------------------------------- */
/* Slugs + tags                                                                */
/* -------------------------------------------------------------------------- */

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['"“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueSlug(base: string, ignoreMemeId?: number): string {
  const root = slugify(base) || "meme";
  let candidate = root;
  let n = 2;
  for (;;) {
    const existing = get<{ id: number }>("SELECT id FROM memes WHERE slug = ?", candidate);
    if (!existing || existing.id === ignoreMemeId) return candidate;
    candidate = `${root}-${n++}`;
    if (n > 500) return `${root}-${Date.now()}`;
  }
}

export function normalizeTags(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input : input.split(/[,\n]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const clean = t.trim().replace(/^#/, "").replace(/\s+/g, " ").slice(0, 40);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= 12) break;
  }
  return out;
}

export function tagsForMeme(memeId: number): string[] {
  return all<{ name: string }>(
    "SELECT t.name FROM meme_tags mt JOIN tags t ON t.id = mt.tag_id WHERE mt.meme_id = ? ORDER BY t.name",
    memeId,
  ).map((r) => r.name);
}

function setTags(memeId: number, tags: string[]) {
  const existing = all<{ tag_id: number }>("SELECT tag_id FROM meme_tags WHERE meme_id = ?", memeId);
  for (const row of existing) {
    run("UPDATE tags SET use_count = MAX(0, use_count - 1) WHERE id = ?", row.tag_id);
  }
  run("DELETE FROM meme_tags WHERE meme_id = ?", memeId);
  for (const tag of normalizeTags(tags)) {
    const slug = slugify(tag);
    if (!slug) continue;
    run("INSERT OR IGNORE INTO tags (slug, name) VALUES (?, ?)", slug, tag);
    const id = pluck<number>("SELECT id FROM tags WHERE slug = ?", slug)!;
    run("INSERT OR IGNORE INTO meme_tags (meme_id, tag_id) VALUES (?, ?)", memeId, id);
    run("UPDATE tags SET use_count = use_count + 1 WHERE id = ?", id);
  }
}

export interface MediaRow {
  id: number;
  meme_id: number;
  kind: string;
  url: string;
  thumb_url: string | null;
  alt: string;
  caption: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  mime: string | null;
  is_primary: number;
  position: number;
  source_url: string;
  author: string;
  license: string;
  rights_notes: string;
  is_placeholder: number;
  created_at: string;
}

/** All media for a meme, primary first, then gallery order. */
export function mediaForMeme(memeId: number): MediaRow[] {
  return all<MediaRow>(
    `SELECT id, meme_id, kind, url, thumb_url, alt, caption, width, height, bytes, mime,
            is_primary, position, source_url, author, license, rights_notes, is_placeholder, created_at
       FROM meme_media WHERE meme_id = ?
      ORDER BY is_primary DESC, position ASC, id ASC`,
    memeId,
  );
}

/* -------------------------------------------------------------------------- */
/* Snapshots + versioning                                                      */
/* -------------------------------------------------------------------------- */

export function snapshotOf(memeId: number): MemeSnapshot | null {
  const row = get<Record<string, unknown>>(
    `SELECT ${MEME_CONTENT_COLUMNS.join(", ")} FROM memes WHERE id = ?`,
    memeId,
  );
  if (!row) return null;
  return {
    name: String(row.name ?? ""),
    short_description: String(row.short_description ?? ""),
    origin: String(row.origin ?? ""),
    history: String(row.history ?? ""),
    usage_notes: String(row.usage_notes ?? ""),
    characteristics: String(row.characteristics ?? ""),
    variations: String(row.variations ?? ""),
    trivia: String(row.trivia ?? ""),
    sources: String(row.sources ?? ""),
    approx_year: row.approx_year == null ? null : Number(row.approx_year),
    approx_period: String(row.approx_period ?? ""),
    country: String(row.country ?? ""),
    region: String(row.region ?? ""),
    category_id: row.category_id == null ? null : Number(row.category_id),
    tags: tagsForMeme(memeId),
  };
}

export function parseSnapshot(json: string): MemeSnapshot {
  try {
    const raw = JSON.parse(json) as Partial<MemeSnapshot>;
    return {
      name: raw.name ?? "",
      short_description: raw.short_description ?? "",
      origin: raw.origin ?? "",
      history: raw.history ?? "",
      usage_notes: raw.usage_notes ?? "",
      characteristics: raw.characteristics ?? "",
      variations: raw.variations ?? "",
      trivia: raw.trivia ?? "",
      sources: raw.sources ?? "",
      approx_year: raw.approx_year ?? null,
      approx_period: raw.approx_period ?? "",
      country: raw.country ?? "",
      region: raw.region ?? "",
      category_id: raw.category_id ?? null,
      tags: Array.isArray(raw.tags) ? raw.tags : [],
    };
  } catch {
    return {
      name: "", short_description: "", origin: "", history: "", usage_notes: "",
      characteristics: "", variations: "", trivia: "", sources: "",
      approx_year: null, approx_period: "", country: "", region: "",
      category_id: null, tags: [],
    };
  }
}

/** Write a snapshot into the live row. Only whitelisted columns are touched. */
function writeSnapshot(memeId: number, snap: MemeSnapshot, actorId: number) {
  const safeYear =
    snap.approx_year == null || !Number.isFinite(Number(snap.approx_year))
      ? null
      : Math.max(1000, Math.min(3000, Math.round(Number(snap.approx_year))));
  run(
    `UPDATE memes SET name = ?, short_description = ?, origin = ?, history = ?, usage_notes = ?,
        characteristics = ?, variations = ?, trivia = ?, sources = ?, approx_year = ?,
        approx_period = ?, country = ?, region = ?, category_id = ?, updated_at = ?, updated_by = ?
      WHERE id = ?`,
    snap.name.slice(0, 200) || "Meme sem nome",
    snap.short_description.slice(0, 600),
    snap.origin,
    snap.history,
    snap.usage_notes,
    snap.characteristics,
    snap.variations,
    snap.trivia,
    snap.sources,
    safeYear,
    snap.approx_period.slice(0, 120),
    snap.country.slice(0, 120),
    snap.region.slice(0, 160),
    snap.category_id,
    nowIso(),
    actorId,
    memeId,
  );
  setTags(memeId, snap.tags);
  reindexMeme(memeId);
}

export interface VersionRow {
  id: number;
  meme_id: number;
  version_no: number;
  snapshot: string;
  created_by: number | null;
  created_at: string;
  reason: string;
  source: string;
  restored_from: number | null;
  contribution_id: number | null;
  author_name: string | null;
  author_username: string | null;
}

export function versionsOf(memeId: number): VersionRow[] {
  return all<VersionRow>(
    `SELECT v.*, u.display_name AS author_name, u.username AS author_username
       FROM meme_versions v LEFT JOIN users u ON u.id = v.created_by
      WHERE v.meme_id = ? ORDER BY v.version_no DESC`,
    memeId,
  );
}

export function latestVersion(memeId: number): VersionRow | undefined {
  return get<VersionRow>(
    "SELECT * FROM meme_versions WHERE meme_id = ? ORDER BY version_no DESC LIMIT 1",
    memeId,
  );
}

/**
 * Append a new version. Every write path in the app funnels through here, which
 * is what makes "never silently overwrite" a structural guarantee rather than
 * a convention: the previous snapshot is always already in the table.
 */
export function commitVersion(input: {
  memeId: number;
  snapshot: MemeSnapshot;
  actorId: number;
  reason: string;
  source: "direct" | "contribution" | "revert" | "media";
  restoredFrom?: number | null;
  contributionId?: number | null;
  notify?: boolean;
}): number {
  return tx(() => {
    writeSnapshot(input.memeId, input.snapshot, input.actorId);
    const next = (pluck<number>("SELECT MAX(version_no) FROM meme_versions WHERE meme_id = ?", input.memeId) ?? 0) + 1;
    const res = run(
      `INSERT INTO meme_versions (meme_id, version_no, snapshot, created_by, reason, source, restored_from, contribution_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.memeId,
      next,
      JSON.stringify(input.snapshot),
      input.actorId,
      input.reason.slice(0, 500),
      input.source,
      input.restoredFrom ?? null,
      input.contributionId ?? null,
    );
    run("UPDATE memes SET versions_count = ? WHERE id = ?", next, input.memeId);
    if (input.notify !== false) {
      const meme = get<{ slug: string; name: string; status: string }>(
        "SELECT slug, name, status FROM memes WHERE id = ?",
        input.memeId,
      );
      if (meme && meme.status === "published") {
        notifyFollowers(
          input.memeId,
          input.actorId,
          `Página atualizada: ${meme.name}`,
          input.reason.slice(0, 180),
          `/meme/${meme.slug}`,
        );
      }
    }
    return Number(res.lastInsertRowid);
  });
}

export function createMeme(input: {
  snapshot: MemeSnapshot;
  actorId: number;
  slug?: string;
  status?: "published" | "hidden";
  isDemo?: boolean;
  reason?: string;
  /** How the first version came to be: seeded demo data, a direct publish or an approved contribution. */
  source?: "seed" | "direct" | "contribution";
  featured?: boolean;
  verified?: boolean;
  media?: {
    url: string;
    thumbUrl?: string | null;
    alt?: string;
    kind?: string;
    mime?: string | null;
    bytes?: number | null;
    width?: number | null;
    height?: number | null;
    placeholder?: boolean;
    author?: string;
    license?: string;
    sourceUrl?: string;
  };
}): number {
  return tx(() => {
    const slug = input.slug ? uniqueSlug(input.slug) : uniqueSlug(input.snapshot.name);
    const snap = input.snapshot;
    const res = run(
      `INSERT INTO memes (slug, name, short_description, origin, history, usage_notes,
          characteristics, variations, trivia, sources, approx_year, approx_period,
          country, region, category_id, status, verified, featured, is_demo,
          created_by, updated_by, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ?, ?, CASE WHEN ? = 'published' THEN datetime('now') ELSE NULL END)`,
      slug,
      snap.name.slice(0, 200) || "Meme sem nome",
      snap.short_description.slice(0, 600),
      snap.origin,
      snap.history,
      snap.usage_notes,
      snap.characteristics,
      snap.variations,
      snap.trivia,
      snap.sources,
      snap.approx_year,
      snap.approx_period.slice(0, 120),
      snap.country.slice(0, 120),
      snap.region.slice(0, 160),
      snap.category_id,
      input.status ?? "published",
      input.verified ? 1 : 0,
      input.featured ? 1 : 0,
      input.isDemo ? 1 : 0,
      input.actorId,
      input.actorId,
      input.status ?? "published",
    );
    const memeId = Number(res.lastInsertRowid);
    setTags(memeId, snap.tags);
    run(
      `INSERT INTO meme_versions (meme_id, version_no, snapshot, created_by, reason, source)
       VALUES (?, 1, ?, ?, ?, ?)`,
      memeId,
      JSON.stringify(snap),
      input.actorId,
      (input.reason ?? "Criação da página").slice(0, 500),
      input.source ?? "seed",
    );
    run("UPDATE memes SET versions_count = 1 WHERE id = ?", memeId);
    if (input.media?.url) {
      run(
        `INSERT INTO meme_media (meme_id, kind, url, thumb_url, alt, width, height, bytes, mime,
            is_primary, position, source_url, author, license, is_placeholder, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?)`,
        memeId,
        input.media.kind ?? "image",
        input.media.url,
        input.media.thumbUrl ?? null,
        (input.media.alt ?? snap.name).slice(0, 200),
        input.media.width ?? null,
        input.media.height ?? null,
        input.media.bytes ?? null,
        input.media.mime ?? null,
        input.media.sourceUrl ?? "",
        input.media.author ?? "",
        input.media.license ?? "",
        input.media.placeholder ? 1 : 0,
        input.actorId,
      );
    }
    reindexMeme(memeId);
    return memeId;
  });
}

/* -------------------------------------------------------------------------- */
/* Diffs                                                                       */
/* -------------------------------------------------------------------------- */

export interface DiffEntry {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
  changed: boolean;
  type: "text" | "number";
}

export function diffSnapshots(before: MemeSnapshot, after: MemeSnapshot): DiffEntry[] {
  const labelOf = (key: string) =>
    MEME_FIELDS.find((f) => f.key === key)?.label ?? key;
  const out: DiffEntry[] = [];
  for (const key of MEME_CONTENT_COLUMNS) {
    const a = before[key as keyof MemeSnapshot];
    const b = after[key as keyof MemeSnapshot];
    const sa = a == null ? "" : String(a);
    const sb = b == null ? "" : String(b);
    const changed = key === "approx_year" ? (a ?? null) !== (b ?? null) : sa !== sb;
    out.push({
      field: key,
      label: labelOf(key),
      oldValue: sa,
      newValue: sb,
      changed,
      type: key === "approx_year" ? "number" : "text",
    });
  }
  const tagsBefore = before.tags.join(", ");
  const tagsAfter = after.tags.join(", ");
  out.push({
    field: "tags",
    label: "Tags",
    oldValue: tagsBefore,
    newValue: tagsAfter,
    changed: tagsBefore !== tagsAfter,
    type: "text",
  });
  return out;
}

/** Word-level diff used to highlight added/removed spans inside a field. */
export function inlineDiff(before: string, after: string): { kind: "same" | "add" | "del"; text: string }[] {
  const a = before.split(/(\s+)/).filter((s) => s !== "");
  const b = after.split(/(\s+)/).filter((s) => s !== "");
  const n = a.length;
  const m = b.length;
  if (n * m > 400_000) {
    return [
      ...(before ? [{ kind: "del" as const, text: before }] : []),
      ...(after ? [{ kind: "add" as const, text: after }] : []),
    ];
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { kind: "same" | "add" | "del"; text: string }[] = [];
  const push = (kind: "same" | "add" | "del", text: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("del", a[i++]);
    } else {
      push("add", b[j++]);
    }
  }
  while (i < n) push("del", a[i++]);
  while (j < m) push("add", b[j++]);
  return out;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

const BASE_SELECT = `
  SELECT m.id, m.slug, m.name, m.short_description, m.origin, m.history, m.usage_notes,
         m.characteristics, m.variations, m.trivia, m.sources, m.approx_year, m.approx_period,
         m.country, m.region, m.category_id, m.status, m.protection, m.verified, m.featured,
         m.comments_enabled, m.is_demo, m.popularity, m.views_count, m.versions_count,
         m.contributions_count, m.followers_count, m.created_by, m.created_at, m.updated_at,
         m.updated_by, m.published_at, m.deleted_at,
         c.name AS category_name, c.slug AS category_slug,
         a.display_name AS author_name, e.display_name AS editor_name
    FROM memes m
    LEFT JOIN categories c ON c.id = m.category_id
    LEFT JOIN users a ON a.id = m.created_by
    LEFT JOIN users e ON e.id = m.updated_by`;

export function getMemeBySlug(slug: string): MemeRow | undefined {
  return get<MemeRow>(`${BASE_SELECT} WHERE m.slug = ?`, slug);
}

export function getMemeById(id: number): MemeRow | undefined {
  return get<MemeRow>(`${BASE_SELECT} WHERE m.id = ?`, id);
}

export type MemeSort = "popular" | "recent" | "oldest" | "edited" | "alpha" | "random";
export type ViewRange = "today" | "week" | "month" | "all";

export interface ListOptions {
  q?: string;
  category?: string;
  decade?: string;
  country?: string;
  kind?: string;
  minPopularity?: number;
  createdWithin?: number;
  updatedWithin?: number;
  sort?: MemeSort;
  page?: number;
  perPage?: number;
  includeUnpublished?: boolean;
  statusFilter?: string;
  featuredOnly?: boolean;
  verifiedOnly?: boolean;
  tag?: string;
}

const SORT_SQL: Record<MemeSort, string> = {
  popular: "m.popularity DESC, m.views_count DESC",
  recent: "m.created_at DESC",
  oldest: "m.created_at ASC",
  edited: "m.versions_count DESC, m.updated_at DESC",
  alpha: "m.name COLLATE NOCASE ASC",
  random: "RANDOM()",
};

const DECADES: Record<string, [number, number]> = {
  "2000": [2000, 2009],
  "2010": [2010, 2019],
  "2020": [2020, 2029],
  atuais: [2025, 2100],
  anterior: [0, 1999],
};

export interface ListResult {
  items: MemeListItem[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

export function listMemes(opts: ListOptions = {}): ListResult {
  const perPage = Math.min(Math.max(opts.perPage ?? 12, 1), 60);
  const page = Math.max(opts.page ?? 1, 1);
  const where: string[] = [];
  const params: unknown[] = [];
  let from = "FROM memes m LEFT JOIN categories c ON c.id = m.category_id";
  let order = SORT_SQL[opts.sort ?? "popular"];
  let rankJoin = "";

  if (!opts.includeUnpublished) {
    where.push("m.status = 'published'");
  } else if (opts.statusFilter && opts.statusFilter !== "all") {
    where.push("m.status = ?");
    params.push(opts.statusFilter);
  }

  if (opts.q) {
    const fts = buildFtsQuery(opts.q);
    if (fts) {
      from += " JOIN memes_fts f ON f.meme_id = m.id";
      where.push("memes_fts MATCH ?");
      params.push(fts);
      rankJoin = "bm25(memes_fts, 0, 9.0, 4.5, 2.0, 2.0, 2.0, 2.0, 2.0, 1.5, 3.0, 3.5)";
      order = `m.featured DESC, ${rankJoin} ASC, m.popularity DESC`;
    } else {
      where.push("LOWER(m.name) LIKE ?");
      params.push(`%${opts.q.toLowerCase()}%`);
    }
  }

  if (opts.tag) {
    from += " JOIN meme_tags mt ON mt.meme_id = m.id JOIN tags t ON t.id = mt.tag_id";
    where.push("t.slug = ?");
    params.push(opts.tag);
  }

  if (opts.category) {
    where.push("c.slug = ?");
    params.push(opts.category);
  }
  if (opts.country) {
    where.push("m.country = ?");
    params.push(opts.country);
  }
  if (opts.decade && DECADES[opts.decade]) {
    const [lo, hi] = DECADES[opts.decade];
    where.push("m.approx_year IS NOT NULL AND m.approx_year BETWEEN ? AND ?");
    params.push(lo, hi);
  }
  if (opts.kind) {
    where.push(
      "EXISTS (SELECT 1 FROM meme_media md WHERE md.meme_id = m.id AND md.is_primary = 1 AND md.kind = ?)",
    );
    params.push(opts.kind);
  }
  if (opts.minPopularity) {
    where.push("m.popularity >= ?");
    params.push(opts.minPopularity);
  }
  if (opts.createdWithin) {
    where.push("m.created_at >= datetime('now', ?)");
    params.push(`-${opts.createdWithin} days`);
  }
  if (opts.updatedWithin) {
    where.push("m.updated_at >= datetime('now', ?)");
    params.push(`-${opts.updatedWithin} days`);
  }
  if (opts.featuredOnly) where.push("m.featured = 1");
  if (opts.verifiedOnly) where.push("m.verified = 1");

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = count(`SELECT COUNT(*) ${from} ${whereSql}`, ...params);
  const rows = all<Record<string, unknown>>(
    `SELECT m.id, m.slug, m.name, m.short_description, m.views_count, m.versions_count,
            m.updated_at, m.created_at, m.popularity, m.verified, m.featured, m.approx_year,
            m.country, m.is_demo, m.protection,
            c.name AS category_name, c.slug AS category_slug,
            (SELECT md.thumb_url FROM meme_media md WHERE md.meme_id = m.id AND md.is_primary = 1 LIMIT 1) AS thumb_url,
            (SELECT md.url FROM meme_media md WHERE md.meme_id = m.id AND md.is_primary = 1 LIMIT 1) AS full_url,
            (SELECT md.kind FROM meme_media md WHERE md.meme_id = m.id AND md.is_primary = 1 LIMIT 1) AS media_kind
       ${from} ${whereSql}
      ORDER BY ${order}
      LIMIT ? OFFSET ?`,
    ...params,
    perPage,
    (page - 1) * perPage,
  );

  const items = hydrateItems(rows);
  return { items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/** Shared row -> card mapper. Tags are fetched in one batch to avoid N+1. */
function hydrateItems(rows: Record<string, unknown>[]): MemeListItem[] {
  const ids = rows.map((r) => Number(r.id));
  const tagMap = new Map<number, string[]>();
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    for (const t of all<{ meme_id: number; name: string }>(
      `SELECT mt.meme_id, t.name FROM meme_tags mt JOIN tags t ON t.id = mt.tag_id
        WHERE mt.meme_id IN (${placeholders}) ORDER BY t.use_count DESC, t.name`,
      ...ids,
    )) {
      const arr = tagMap.get(Number(t.meme_id)) ?? [];
      arr.push(t.name);
      tagMap.set(Number(t.meme_id), arr);
    }
  }
  return rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    short_description: String(r.short_description ?? ""),
    category_name: r.category_name == null ? null : String(r.category_name),
    category_slug: r.category_slug == null ? null : String(r.category_slug),
    views_count: Number(r.views_count ?? 0),
    versions_count: Number(r.versions_count ?? 0),
    updated_at: String(r.updated_at ?? ""),
    created_at: String(r.created_at ?? ""),
    popularity: Number(r.popularity ?? 0),
    verified: Number(r.verified ?? 0),
    featured: Number(r.featured ?? 0),
    approx_year: r.approx_year == null ? null : Number(r.approx_year),
    country: String(r.country ?? ""),
    is_demo: Number(r.is_demo ?? 0),
    protection: (r.protection as ProtectionLevel) ?? "free",
    thumb_url: (r.thumb_url as string) ?? (r.full_url as string) ?? null,
    media_kind: (r.media_kind as string) ?? null,
    tags: tagMap.get(Number(r.id)) ?? [],
  }));
}

const CARD_SELECT = `
  SELECT m.id, m.slug, m.name, m.short_description, m.views_count, m.versions_count,
         m.updated_at, m.created_at, m.popularity, m.verified, m.featured, m.approx_year,
         m.country, m.is_demo, m.protection,
         c.name AS category_name, c.slug AS category_slug,
         (SELECT md.thumb_url FROM meme_media md WHERE md.meme_id = m.id AND md.is_primary = 1 LIMIT 1) AS thumb_url,
         (SELECT md.url FROM meme_media md WHERE md.meme_id = m.id AND md.is_primary = 1 LIMIT 1) AS full_url,
         (SELECT md.kind FROM meme_media md WHERE md.meme_id = m.id AND md.is_primary = 1 LIMIT 1) AS media_kind
    FROM memes m LEFT JOIN categories c ON c.id = m.category_id`;

/** Fetch cards for a known id list, preserving the given order. */
export function listMemesByIds(ids: number[]): MemeListItem[] {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const placeholders = unique.map(() => "?").join(",");
  const rows = all<Record<string, unknown>>(
    `${CARD_SELECT} WHERE m.id IN (${placeholders}) AND m.status = 'published'`,
    ...unique,
  );
  const byId = new Map(hydrateItems(rows).map((m) => [m.id, m]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as MemeListItem[];
}

/* -------------------------------------------------------------------------- */
/* Search                                                                      */
/* -------------------------------------------------------------------------- */

export interface SearchHit {
  id: number;
  slug: string;
  name: string;
  short_description: string;
  category_name: string | null;
  score: number;
}

export function searchMemes(query: string, limit = 8): SearchHit[] {
  const fts = buildFtsQuery(query);
  if (!fts) return [];
  try {
    return all<SearchHit>(
      `SELECT m.id, m.slug, m.name, m.short_description, c.name AS category_name,
              bm25(memes_fts, 0, 9.0, 4.5, 2.0, 2.0, 2.0, 2.0, 2.0, 1.5, 3.0, 3.5) AS score
         FROM memes_fts
         JOIN memes m ON m.id = memes_fts.meme_id
         LEFT JOIN categories c ON c.id = m.category_id
        WHERE memes_fts MATCH ? AND m.status = 'published'
        ORDER BY score ASC LIMIT ?`,
      fts,
      limit,
    );
  } catch {
    // Defensive: if the FTS index is ever unavailable, degrade to a LIKE scan
    // rather than failing the request.
    const like = `%${query.toLowerCase()}%`;
    return all<SearchHit>(
      `SELECT m.id, m.slug, m.name, m.short_description, c.name AS category_name, 0 AS score
         FROM memes m LEFT JOIN categories c ON c.id = m.category_id
        WHERE m.status = 'published' AND (LOWER(m.name) LIKE ? OR LOWER(m.short_description) LIKE ?)
        ORDER BY m.popularity DESC LIMIT ?`,
      like,
      like,
      limit,
    );
  }
}

export function searchUsers(query: string, limit = 6) {
  const fts = buildFtsQuery(query);
  if (!fts) return [];
  try {
    return all<{ id: number; username: string; display_name: string }>(
      `SELECT u.id, u.username, u.display_name FROM users_fts
        JOIN users u ON u.id = users_fts.user_id
       WHERE users_fts MATCH ? AND u.status = 'active'
       ORDER BY bm25(users_fts, 0, 4.0, 3.0) ASC LIMIT ?`,
      fts,
      limit,
    );
  } catch {
    const like = `%${query.toLowerCase()}%`;
    return all<{ id: number; username: string; display_name: string }>(
      `SELECT id, username, display_name FROM users
        WHERE status = 'active' AND (LOWER(username) LIKE ? OR LOWER(display_name) LIKE ?) LIMIT ?`,
      like,
      like,
      limit,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Discovery                                                                   */
/* -------------------------------------------------------------------------- */

export function popularMemes(range: ViewRange, limit = 6): MemeListItem[] {
  if (range === "all") {
    return listMemes({ sort: "popular", perPage: limit }).items;
  }
  const days = range === "today" ? 1 : range === "week" ? 7 : 30;
  const rows = all<{ meme_id: number }>(
    `SELECT meme_id, SUM(count) AS c FROM views
      WHERE day >= date('now', ?) GROUP BY meme_id ORDER BY c DESC LIMIT ?`,
    `-${days - 1} days`,
    limit,
  );
  const items = listMemesByIds(rows.map((r) => r.meme_id));
  return items.length ? items : listMemes({ sort: "popular", perPage: limit }).items;
}

export function featuredMemes(limit = 6): MemeListItem[] {
  const items = listMemes({ featuredOnly: true, sort: "popular", perPage: limit }).items;
  return items;
}

export function recentMemes(limit = 6): MemeListItem[] {
  return listMemes({ sort: "recent", perPage: limit }).items;
}

export function mostEditedMemes(limit = 6) {
  return all<{ id: number; slug: string; name: string; versions_count: number; edits: number }>(
    `SELECT m.id, m.slug, m.name, m.versions_count,
            (SELECT COUNT(*) FROM contributions c WHERE c.meme_id = m.id) AS edits
       FROM memes m WHERE m.status = 'published'
      ORDER BY m.versions_count DESC, edits DESC LIMIT ?`,
    limit,
  );
}

export function randomMemeSlug(): string | null {
  return (
    pluck<string>("SELECT slug FROM memes WHERE status = 'published' ORDER BY RANDOM() LIMIT 1") ?? null
  );
}

export function recordView(memeId: number) {
  tx(() => {
    run(
      `INSERT INTO views (meme_id, day, count) VALUES (?, ?, 1)
       ON CONFLICT(meme_id, day) DO UPDATE SET count = count + 1`,
      memeId,
      dayKey(),
    );
    run(
      `UPDATE memes SET views_count = views_count + 1,
         popularity = popularity + 1,
         featured = featured
       WHERE id = ?`,
      memeId,
    );
  });
}

export function viewsByRange(memeId: number, days: number): { day: string; count: number }[] {
  return all<{ day: string; count: number }>(
    "SELECT day, count FROM views WHERE meme_id = ? AND day >= date('now', ?) ORDER BY day",
    memeId,
    `-${days} days`,
  );
}

export function relatedMemes(meme: MemeRow, limit = 6): MemeListItem[] {
  const tagNames = tagsForMeme(meme.id).map((t) => slugify(t));
  const sameCategory = meme.category_slug
    ? listMemes({ category: meme.category_slug, perPage: limit + 4, sort: "popular" }).items
    : [];
  const scored = new Map<number, { item: MemeListItem; score: number }>();
  const ownName = new Set(meme.name.toLowerCase().split(/\s+/));

  for (const item of sameCategory) {
    if (item.id === meme.id) continue;
    scored.set(item.id, { item, score: 3 + item.popularity / 500 });
  }
  if (tagNames.length) {
    const placeholders = tagNames.map(() => "?").join(",");
    const shared = all<{ meme_id: number; n: number }>(
      `SELECT mt.meme_id, COUNT(*) AS n FROM meme_tags mt JOIN tags t ON t.id = mt.tag_id
        WHERE t.slug IN (${placeholders}) AND mt.meme_id != ?
        GROUP BY mt.meme_id ORDER BY n DESC LIMIT 12`,
      ...tagNames,
      meme.id,
    );
    for (const s of shared) {
      const existing = scored.get(s.meme_id);
      if (existing) existing.score += Number(s.n) * 4;
      else {
        const [row] = listMemesByIds([s.meme_id]);
        if (row) scored.set(s.meme_id, { item: row, score: 2 + Number(s.n) * 4 });
      }
    }
  }

  // Tag-term overlap is the strongest signal, so rank it above raw popularity.
  for (const entry of scored.values()) {
    const words = entry.item.name.toLowerCase().split(/\s+/);
    if (words.some((w) => ownName.has(w) && w.length > 3)) entry.score += 2;
    entry.score += Math.min(entry.item.views_count / 800, 3);
  }
  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}

/* -------------------------------------------------------------------------- */
/* Taxonomy                                                                    */
/* -------------------------------------------------------------------------- */

export interface CategoryWithCount {
  id: number;
  slug: string;
  name: string;
  description: string;
  group_name: string;
  sort_order: number;
  meme_count: number;
}

export function categoriesWithCounts(): CategoryWithCount[] {
  return all<CategoryWithCount>(
    `SELECT c.id, c.slug, c.name, c.description, c.group_name, c.sort_order,
            (SELECT COUNT(*) FROM memes m WHERE m.category_id = c.id AND m.status = 'published') AS meme_count
       FROM categories c ORDER BY c.sort_order, c.name`,
  );
}

export function getCategory(slug: string) {
  return get<CategoryWithCount>(
    `SELECT c.id, c.slug, c.name, c.description, c.group_name, c.sort_order,
            (SELECT COUNT(*) FROM memes m WHERE m.category_id = c.id AND m.status = 'published') AS meme_count
       FROM categories c WHERE c.slug = ?`,
    slug,
  );
}

export function allCategories() {
  return all<{ id: number; slug: string; name: string; group_name: string; description: string }>(
    "SELECT id, slug, name, group_name, description FROM categories ORDER BY sort_order, name",
  );
}

export function tagsWithCounts(limit = 60) {
  return all<{ id: number; slug: string; name: string; use_count: number }>(
    `SELECT t.id, t.slug, t.name,
            (SELECT COUNT(*) FROM meme_tags mt JOIN memes m ON m.id = mt.meme_id
              WHERE mt.tag_id = t.id AND m.status = 'published') AS use_count
       FROM tags t ORDER BY use_count DESC, t.name LIMIT ?`,
    limit,
  );
}

export function getTag(slug: string) {
  return get<{ id: number; slug: string; name: string }>("SELECT id, slug, name FROM tags WHERE slug = ?", slug);
}

export function countries(): { country: string; n: number }[] {
  return all<{ country: string; n: number }>(
    `SELECT country, COUNT(*) AS n FROM memes
      WHERE status = 'published' AND country != '' GROUP BY country ORDER BY n DESC, country`,
  );
}

export function mediaKinds(): { kind: string; n: number }[] {
  return all<{ kind: string; n: number }>(
    `SELECT md.kind, COUNT(DISTINCT md.meme_id) AS n FROM meme_media md
       JOIN memes m ON m.id = md.meme_id
      WHERE m.status = 'published' GROUP BY md.kind ORDER BY n DESC`,
  );
}

/* -------------------------------------------------------------------------- */
/* Duplicate detection (requirement 41)                                        */
/* -------------------------------------------------------------------------- */

export interface DuplicateCandidate {
  id: number;
  slug: string;
  name: string;
  short_description: string;
  category_name: string | null;
  relevance: number;
}

export function findDuplicates(name: string, description = "", limit = 5): DuplicateCandidate[] {
  const results = new Map<number, DuplicateCandidate>();
  const cleanName = name.trim();
  if (cleanName.length < 3) return [];

  const like = `%${cleanName.toLowerCase()}%`;
  for (const row of all<{
    id: number;
    slug: string;
    name: string;
    short_description: string;
    category_name: string | null;
  }>(
    `SELECT m.id, m.slug, m.name, m.short_description, c.name AS category_name
       FROM memes m LEFT JOIN categories c ON c.id = m.category_id
      WHERE m.status = 'published' AND LOWER(m.name) LIKE ?
      ORDER BY m.popularity DESC LIMIT ?`,
    like,
    limit,
  )) {
    results.set(row.id, { ...row, relevance: 90 });
  }

  for (const hit of searchMemes(`${cleanName} ${description.slice(0, 120)}`, limit + 3)) {
    const existing = results.get(hit.id);
    const relevance = Math.max(20, Math.min(85, Math.round(100 + hit.score * 3)));
    if (existing) existing.relevance = Math.max(existing.relevance, relevance);
    else results.set(hit.id, { ...hit, relevance });
  }

  const slugGuess = slugify(cleanName);
  for (const row of all<{
    id: number;
    slug: string;
    name: string;
    short_description: string;
    category_name: string | null;
    diff: number;
  }>(
    `SELECT m.id, m.slug, m.name, m.short_description, c.name AS category_name,
            ABS(LENGTH(m.slug) - LENGTH(?)) AS diff
       FROM memes m LEFT JOIN categories c ON c.id = m.category_id
      WHERE m.status = 'published' AND m.slug LIKE ? LIMIT ?`,
    slugGuess,
    `${slugGuess.slice(0, Math.max(3, slugGuess.length - 3))}%`,
    limit,
  )) {
    if (!results.has(row.id)) {
      results.set(row.id, { ...row, relevance: 45 });
    }
  }

  return [...results.values()].sort((a, b) => b.relevance - a.relevance).slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Contributor-facing helpers                                                  */
/* -------------------------------------------------------------------------- */

export function memeStats(memeId: number) {
  return {
    pendingContributions: count(
      "SELECT COUNT(*) FROM contributions WHERE meme_id = ? AND status = 'pending'",
      memeId,
    ),
    openReports: count("SELECT COUNT(*) FROM reports WHERE target_type = 'meme' AND target_id = ? AND status = 'open'", memeId),
    comments: count("SELECT COUNT(*) FROM comments WHERE meme_id = ? AND status = 'visible'", memeId),
  };
}

export function isFollowing(userId: number | undefined, memeId: number): boolean {
  if (!userId) return false;
  return !!get("SELECT 1 FROM follows WHERE user_id = ? AND meme_id = ?", userId, memeId);
}

export function isFavorite(userId: number | undefined, memeId: number): boolean {
  if (!userId) return false;
  return !!get("SELECT 1 FROM favorites WHERE user_id = ? AND meme_id = ?", userId, memeId);
}

export function toggleFollow(userId: number, memeId: number): boolean {
  return tx(() => {
    const exists = get("SELECT 1 FROM follows WHERE user_id = ? AND meme_id = ?", userId, memeId);
    if (exists) {
      run("DELETE FROM follows WHERE user_id = ? AND meme_id = ?", userId, memeId);
      run("UPDATE memes SET followers_count = MAX(0, followers_count - 1) WHERE id = ?", memeId);
      return false;
    }
    run("INSERT INTO follows (user_id, meme_id) VALUES (?, ?)", userId, memeId);
    run("UPDATE memes SET followers_count = followers_count + 1 WHERE id = ?", memeId);
    return true;
  });
}

export function toggleFavorite(userId: number, memeId: number): boolean {
  return tx(() => {
    const exists = get("SELECT 1 FROM favorites WHERE user_id = ? AND meme_id = ?", userId, memeId);
    if (exists) {
      run("DELETE FROM favorites WHERE user_id = ? AND meme_id = ?", userId, memeId);
      return false;
    }
    run("INSERT INTO favorites (user_id, meme_id) VALUES (?, ?)", userId, memeId);
    return true;
  });
}

export function favoriteMemes(userId: number): MemeListItem[] {
  const ids = all<{ meme_id: number }>(
    "SELECT meme_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC",
    userId,
  ).map((r) => r.meme_id);
  return listMemesByIds(ids);
}

export function followedMemes(userId: number) {
  return all<{
    id: number;
    slug: string;
    name: string;
    short_description: string;
    updated_at: string;
    versions_count: number;
    thumb_url: string | null;
  }>(
    `SELECT m.id, m.slug, m.name, m.short_description, m.updated_at, m.versions_count,
            (SELECT md.thumb_url FROM meme_media md WHERE md.meme_id = m.id AND md.is_primary = 1 LIMIT 1) AS thumb_url
       FROM follows f JOIN memes m ON m.id = f.meme_id
      WHERE f.user_id = ? AND m.status = 'published'
      ORDER BY m.updated_at DESC`,
    userId,
  );
}

export function suggestionsFor(query: string, limit = 6) {
  return searchMemes(query, limit).map((h) => ({
    slug: h.slug,
    name: h.name,
    category: h.category_name,
    snippet: h.short_description.slice(0, 90),
  }));
}
