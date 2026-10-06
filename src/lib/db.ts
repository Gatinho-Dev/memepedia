import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * Memepedia data layer.
 *
 * SQLite via node:sqlite (bundled - no native build step). WAL + busy timeout
 * so readers never block a writer. The schema scales from hundreds to hundreds
 * of thousands of memes: every hot path is indexed and search runs on an FTS5
 * index instead of LIKE scans.
 *
 * Entity map (requirement 38):
 *   users, profiles, roles, memes, meme_versions, categories, meme_categories,
 *   tags, meme_tags, meme_media, contributions, contribution_changes, reports,
 *   comments, notifications, audit_logs, page_locks, featured_memes, views,
 *   sessions, follows, favorites, settings, rate_limits, tokens, challenges.
 *
 * Note: `meme_tags` is the tag relation table (the brief also lists a
 * `meme_tag_relations` alias - a second table would duplicate it, so the
 * relation lives in `meme_tags` with a ranking weight column).
 */

const DATA_DIR = process.env.MEMEPEDIA_DATA_DIR
  ? path.resolve(process.env.MEMEPEDIA_DATA_DIR)
  : path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: "core",
    sql: `
    CREATE TABLE roles (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      rank INTEGER NOT NULL,
      permissions TEXT NOT NULL DEFAULT '[]',
      is_system INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user' REFERENCES roles(key),
      status TEXT NOT NULL DEFAULT 'active',      -- active | suspended | banned
      status_reason TEXT,
      status_until TEXT,
      is_owner INTEGER NOT NULL DEFAULT 0,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT,
      last_login_at TEXT
    );
    CREATE INDEX idx_users_role ON users(role);
    CREATE INDEX idx_users_status ON users(status);

    CREATE TABLE profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      bio TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      theme TEXT NOT NULL DEFAULT 'system',       -- light | dark | system
      locale TEXT NOT NULL DEFAULT 'pt-BR',
      contributions_total INTEGER NOT NULL DEFAULT 0,
      approved_total INTEGER NOT NULL DEFAULT 0,
      rejected_total INTEGER NOT NULL DEFAULT 0,
      achievements TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      group_name TEXT NOT NULL DEFAULT 'Geral',
      sort_order INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE memes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      short_description TEXT NOT NULL DEFAULT '',
      origin TEXT NOT NULL DEFAULT '',
      history TEXT NOT NULL DEFAULT '',
      usage_notes TEXT NOT NULL DEFAULT '',
      characteristics TEXT NOT NULL DEFAULT '',
      variations TEXT NOT NULL DEFAULT '',
      trivia TEXT NOT NULL DEFAULT '',
      sources TEXT NOT NULL DEFAULT '',
      approx_year INTEGER,
      approx_period TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      category_id INTEGER REFERENCES categories(id),
      status TEXT NOT NULL DEFAULT 'published',   -- published | hidden | deleted
      protection TEXT NOT NULL DEFAULT 'free',    -- free | moderated | protected | admin
      verified INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      comments_enabled INTEGER NOT NULL DEFAULT 1,
      is_demo INTEGER NOT NULL DEFAULT 0,
      popularity INTEGER NOT NULL DEFAULT 0,      -- rolling score for "popular"
      views_count INTEGER NOT NULL DEFAULT 0,
      versions_count INTEGER NOT NULL DEFAULT 0,
      contributions_count INTEGER NOT NULL DEFAULT 0,
      followers_count INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by INTEGER REFERENCES users(id),
      published_at TEXT,
      deleted_at TEXT
    );
    CREATE INDEX idx_memes_status ON memes(status);
    CREATE INDEX idx_memes_category ON memes(category_id);
    CREATE INDEX idx_memes_popularity ON memes(popularity DESC);
    CREATE INDEX idx_memes_updated ON memes(updated_at DESC);
    CREATE INDEX idx_memes_featured ON memes(featured) WHERE featured = 1;
    CREATE INDEX idx_memes_year ON memes(approx_year);

    CREATE TABLE meme_categories (
      meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      PRIMARY KEY (meme_id, category_id)
    );

    CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE meme_tags (
      meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      weight INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (meme_id, tag_id)
    );
    CREATE INDEX idx_meme_tags_tag ON meme_tags(tag_id);

    CREATE TABLE meme_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'image',        -- image | gif | video
      url TEXT NOT NULL,
      thumb_url TEXT,
      alt TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      width INTEGER,
      height INTEGER,
      bytes INTEGER,
      mime TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      source_url TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      license TEXT NOT NULL DEFAULT '',
      rights_notes TEXT NOT NULL DEFAULT '',
      is_placeholder INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_media_meme ON meme_media(meme_id, position);

    CREATE TABLE meme_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
      version_no INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reason TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'edit',       -- seed | direct | contribution | revert
      restored_from INTEGER REFERENCES meme_versions(id),
      contribution_id INTEGER
    );
    CREATE INDEX idx_versions_meme ON meme_versions(meme_id, version_no DESC);

    CREATE TABLE contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,                        -- new_meme | correction | media | delete_request
      meme_id INTEGER REFERENCES memes(id) ON DELETE SET NULL,
      target_name TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | rejected | changed | cancelled
      submitted_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT,
      review_note TEXT NOT NULL DEFAULT '',
      resulting_version_id INTEGER,
      resulting_meme_id INTEGER,
      ai_flags TEXT NOT NULL DEFAULT '[]',
      risk_score INTEGER NOT NULL DEFAULT 0,
      ip_hash TEXT
    );
    CREATE INDEX idx_contrib_status ON contributions(status, created_at DESC);
    CREATE INDEX idx_contrib_user ON contributions(submitted_by, created_at DESC);
    CREATE INDEX idx_contrib_meme ON contributions(meme_id, created_at DESC);

    CREATE TABLE contribution_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contribution_id INTEGER NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
      field TEXT NOT NULL,
      old_value TEXT NOT NULL DEFAULT '',
      new_value TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX idx_changes_contrib ON contribution_changes(contribution_id);

    CREATE TABLE reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,                 -- meme | comment | user | media
      target_id INTEGER NOT NULL,
      reporter_id INTEGER REFERENCES users(id),
      reason TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',       -- open | resolved | dismissed
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_by INTEGER REFERENCES users(id),
      resolved_at TEXT,
      resolution_note TEXT NOT NULL DEFAULT '',
      ip_hash TEXT
    );
    CREATE INDEX idx_reports_status ON reports(status, created_at DESC);

    CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'visible',    -- visible | hidden | deleted
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      reports_count INTEGER NOT NULL DEFAULT 0,
      ip_hash TEXT
    );
    CREATE INDEX idx_comments_meme ON comments(meme_id, created_at DESC);

    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      actor_id INTEGER REFERENCES users(id),
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);

    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER REFERENCES users(id),
      actor_name TEXT NOT NULL DEFAULT 'sistema',
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL DEFAULT '',
      resource_id TEXT NOT NULL DEFAULT '',
      result TEXT NOT NULL DEFAULT 'ok',
      meta TEXT NOT NULL DEFAULT '{}',
      ip_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
    CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);

    CREATE TABLE page_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
      level TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      set_by INTEGER REFERENCES users(id),
      set_at TEXT NOT NULL DEFAULT (datetime('now')),
      released_by INTEGER REFERENCES users(id),
      released_at TEXT
    );
    CREATE INDEX idx_locks_meme ON page_locks(meme_id, active);

    CREATE TABLE featured_memes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
      note TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      featured_by INTEGER REFERENCES users(id),
      featured_at TEXT NOT NULL DEFAULT (datetime('now')),
      removed_at TEXT
    );
    CREATE INDEX idx_featured_active ON featured_memes(active);

    CREATE TABLE views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      UNIQUE (meme_id, day)
    );
    CREATE INDEX idx_views_day ON views(day DESC, count DESC);

    CREATE TABLE follows (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, meme_id)
    );

    CREATE TABLE favorites (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, meme_id)
    );

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      user_agent TEXT NOT NULL DEFAULT '',
      ip_hash TEXT
    );
    CREATE INDEX idx_sessions_user ON sessions(user_id);

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE rate_limits (
      key TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE tokens (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,                        -- verify_email | reset_password
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE challenges (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      answer_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    `,
  },
  {
    version: 2,
    name: "full-text search",
    sql: `
    CREATE VIRTUAL TABLE memes_fts USING fts5(
      meme_id UNINDEXED,
      name,
      short_description,
      origin,
      history,
      usage_notes,
      characteristics,
      variations,
      trivia,
      category,
      tags,
      tokenize = "unicode61 remove_diacritics 2"
    );
    CREATE VIRTUAL TABLE users_fts USING fts5(
      user_id UNINDEXED,
      username,
      display_name,
      tokenize = "unicode61 remove_diacritics 2"
    );
    `,
  },
  {
    version: 3,
    name: "role catalogue",
    sql: `
    -- users.role has a foreign key onto roles(key), so the catalogue must exist
    -- before the first account can be created. Labels mirror src/lib/types.ts.
    INSERT OR IGNORE INTO roles (key, label, description, rank, permissions, is_system) VALUES
      ('user', 'Usuário', 'Contribui sugerindo memes e correções que passam por revisão.', 10, '[]', 1),
      ('contributor', 'Colaborador', 'Contribuidor de confiança: publica direto em páginas livres e organiza categorias e tags.', 20, '[]', 1),
      ('moderator', 'Moderador', 'Revisa contribuições, modera denúncias, bloqueia conteúdo e reverte edições.', 40, '[]', 1),
      ('admin', 'Administrador', 'Acesso administrativo amplo sobre conteúdo, usuários e configurações.', 70, '[]', 1),
      ('owner', 'Owner', 'Proprietário da Memepedia. Controle total e irreversível sobre a plataforma.', 100, '[]', 1);
    `,
  },
];

let _db: DatabaseSync | null = null;
/** Nesting depth of tx(): 0 means no transaction is open on this connection. */
let txDepth = 0;

function connect(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, "memepedia.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA synchronous = NORMAL");
  return db;
}

function migrate(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );
  const applied = new Set(
    db.prepare("SELECT version FROM _migrations").all().map((r) => Number(r.version)),
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    db.exec("BEGIN");
    try {
      db.exec(m.sql);
      db.prepare("INSERT INTO _migrations (version, name) VALUES (?, ?)").run(m.version, m.name);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

export function getDb(): DatabaseSync {
  if (_db) return _db;
  const db = connect();
  migrate(db);
  _db = db;
  return db;
}

/* -------------------------------------------------------------------------- */
/* Small typed helpers around node:sqlite                                     */
/* -------------------------------------------------------------------------- */

export type Row = Record<string, unknown>;

/*
 * node:sqlite hands back null-prototype objects, which React refuses to
 * serialize when a row travels from a Server Component to a Client Component.
 * Copying each row keeps `all`/`get` safe to hand straight to the UI.
 */
function plain<T>(row: T): T {
  return row && typeof row === "object" ? ({ ...(row as object) } as T) : row;
}

export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return (getDb().prepare(sql).all(...(params as never[])) as T[]).map(plain);
}

export function get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  const row = getDb().prepare(sql).get(...(params as never[])) as T | undefined;
  return row === undefined ? undefined : plain(row);
}

export function run(sql: string, ...params: unknown[]) {
  return getDb().prepare(sql).run(...(params as never[]));
}

export function pluck<T = unknown>(sql: string, ...params: unknown[]): T | undefined {
  const row = get<Row>(sql, ...params);
  if (!row) return undefined;
  return Object.values(row)[0] as T;
}

export function count(sql: string, ...params: unknown[]): number {
  return Number(pluck<number>(sql, ...params) ?? 0);
}

/**
 * Run `fn` inside a transaction; rolls back on any throw.
 *
 * Reentrant on purpose: higher-level operations (reviewing a contribution,
 * creating a meme) legitimately call lower-level ones that are themselves
 * transactional, and SQLite has no nested BEGIN. The inner call joins the
 * outer transaction, so the whole operation still commits or rolls back as a
 * single unit.
 */
export function tx<T>(fn: () => T): T {
  const db = getDb();
  if (txDepth > 0) return fn();
  db.exec("BEGIN");
  txDepth += 1;
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already rolled back */
    }
    throw err;
  } finally {
    txDepth -= 1;
  }
}

export function nowIso(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/* Full-text search index maintenance                                         */
/* -------------------------------------------------------------------------- */

export function reindexMeme(memeId: number) {
  const db = getDb();
  const m = get<{
    id: number;
    name: string;
    short_description: string;
    origin: string;
    history: string;
    usage_notes: string;
    characteristics: string;
    variations: string;
    trivia: string;
  }>(
    `SELECT id, name, short_description, origin, history, usage_notes,
            characteristics, variations, trivia FROM memes WHERE id = ?`,
    memeId,
  );
  db.prepare("DELETE FROM memes_fts WHERE meme_id = ?").run(memeId);
  if (!m) return;
  const category = pluck<string>(
    `SELECT c.name FROM memes m JOIN categories c ON c.id = m.category_id WHERE m.id = ?`,
    memeId,
  );
  const tags = all<{ name: string }>(
    `SELECT t.name FROM meme_tags mt JOIN tags t ON t.id = mt.tag_id WHERE mt.meme_id = ?`,
    memeId,
  )
    .map((t) => t.name)
    .join(" ");
  db.prepare(
    `INSERT INTO memes_fts (meme_id, name, short_description, origin, history,
                            usage_notes, characteristics, variations, trivia, category, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    memeId,
    m.name,
    m.short_description,
    m.origin,
    m.history,
    m.usage_notes,
    m.characteristics,
    m.variations,
    m.trivia,
    category ?? "",
    tags,
  );
}

export function reindexUser(userId: number) {
  const db = getDb();
  const u = get<{ username: string; display_name: string }>(
    "SELECT username, display_name FROM users WHERE id = ?",
    userId,
  );
  db.prepare("DELETE FROM users_fts WHERE user_id = ?").run(userId);
  if (u) {
    db.prepare("INSERT INTO users_fts (user_id, username, display_name) VALUES (?, ?, ?)").run(
      userId,
      u.username,
      u.display_name,
    );
  }
}

/**
 * Turn untrusted user input into a safe FTS5 MATCH expression.
 * Every term becomes a quoted prefix match, so operators (=, NEAR, ") in the
 * input can never alter the query shape.
 */
export function buildFtsQuery(input: string): string | null {
  const terms = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
    .slice(0, 8);
  if (!terms.length) return null;
  return terms.map((t) => `"${t.replace(/"/g, "")}"*`).join(" ");
}
