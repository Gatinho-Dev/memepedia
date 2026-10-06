import "server-only";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
  createHmac,
} from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { all, get, pluck, run, tx, nowIso } from "./db";
import { can, DEFAULT_SETTINGS, type Capability, type SiteSettings } from "./permissions";
import type { Role, SessionUser, UserStatus } from "./types";

const COOKIE = "mp_session";
const SESSION_DAYS = 30;

/* -------------------------------------------------------------------------- */
/* Passwords                                                                   */
/* -------------------------------------------------------------------------- */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, N, r, p, salt, hash] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const expected = Buffer.from(hash, "base64url");
    const actual = scryptSync(password, Buffer.from(salt, "base64url"), expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function passwordProblems(password: string): string | null {
  if (password.length < 8) return "Use pelo menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(password)) return "Inclua ao menos uma letra.";
  if (!/[0-9]/.test(password)) return "Inclua ao menos um número.";
  return null;
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                    */
/* -------------------------------------------------------------------------- */

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function clientFingerprint(): Promise<{ ipHash: string; userAgent: string }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "local";
  return { ipHash: hashIp(ip), userAgent: (h.get("user-agent") ?? "").slice(0, 250) };
}

/**
 * IPs are stored as a keyed hash, never in the clear. Abuse can still be traced
 * (same hash = same origin) without the database holding personal data.
 */
export function hashIp(ip: string): string {
  let salt = pluck<string>("SELECT value FROM settings WHERE key = 'ip_salt'");
  if (!salt) {
    salt = randomBytes(24).toString("base64url");
    run("INSERT OR IGNORE INTO settings (key, value) VALUES ('ip_salt', ?)", salt);
    salt = pluck<string>("SELECT value FROM settings WHERE key = 'ip_salt'") ?? salt;
  }
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

export function createSession(userId: number, meta: { ipHash: string; userAgent: string }): string {
  const token = randomBytes(32).toString("base64url");
  run(
    `INSERT INTO sessions (id, user_id, expires_at, user_agent, ip_hash)
     VALUES (?, ?, datetime('now', ?), ?, ?)`,
    sha256(token),
    userId,
    `+${SESSION_DAYS} days`,
    meta.userAgent,
    meta.ipHash,
  );
  return token;
}

export function setSessionCookie(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  const row = get<{
    id: number;
    username: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    role: Role;
    status: UserStatus;
    is_owner: number;
    must_change_password: number;
    theme: string;
    created_at: string;
    last_seen_at: string | null;
    expires_at: string;
  }>(
    `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.role, u.status,
            u.is_owner, u.must_change_password, u.created_at, u.last_seen_at,
            COALESCE(p.theme, 'system') AS theme, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE s.id = ? AND s.expires_at > datetime('now')`,
    sha256(token),
  );
  if (!row) return null;
  if (row.status === "banned") return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    isOwner: row.is_owner === 1 || row.role === "owner",
    mustChangePassword: row.must_change_password === 1,
    theme: (row.theme as SessionUser["theme"]) ?? "system",
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
});

export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(nextPath ? `/entrar?next=${encodeURIComponent(nextPath)}` : "/entrar");
  return user;
}

/**
 * Server-side capability gate. Every mutation calls this - frontend checks are
 * only ever cosmetic.
 */
export async function requireCap(cap: Capability): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  if (!can(user.role, cap)) redirect("/403");
  return user;
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export function notify(input: {
  userId: number;
  kind: string;
  title: string;
  body?: string;
  url?: string;
  actorId?: number | null;
}) {
  if (!input.userId) return;
  run(
    `INSERT INTO notifications (user_id, kind, title, body, url, actor_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.userId,
    input.kind,
    input.title,
    input.body ?? "",
    input.url ?? "",
    input.actorId ?? null,
  );
}

/** Notify everyone following a meme, except the person who made the change. */
export function notifyFollowers(memeId: number, actorId: number, title: string, body: string, url: string) {
  const followers = all<{ user_id: number }>(
    "SELECT user_id FROM follows WHERE meme_id = ? AND user_id != ?",
    memeId,
    actorId,
  );
  for (const f of followers) notify({ userId: f.user_id, kind: "meme_change", title, body, url, actorId });
}

/* -------------------------------------------------------------------------- */
/* Audit log                                                                   */
/* -------------------------------------------------------------------------- */

export function logAudit(input: {
  actorId?: number | null;
  actorName?: string;
  action: string;
  resourceType?: string;
  resourceId?: string | number;
  result?: "ok" | "negado" | "erro";
  meta?: Record<string, unknown>;
  ipHash?: string;
}) {
  run(
    `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, result, meta, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.actorId ?? null,
    input.actorName ?? "sistema",
    input.action,
    input.resourceType ?? "",
    String(input.resourceId ?? ""),
    input.result ?? "ok",
    JSON.stringify(input.meta ?? {}),
    input.ipHash ?? null,
  );
}

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Fixed-window limiter backed by SQLite. Good enough for vandalism control at
 * this scale and it survives restarts (unlike an in-process Map).
 */
export function rateLimit(key: string, limit: number, windowSeconds: number): { ok: boolean; remaining: number; retryAfter: number } {
  const now = Math.floor(Date.now() / 1000);
  return tx(() => {
    const row = get<{ window_start: number; count: number }>(
      "SELECT window_start, count FROM rate_limits WHERE key = ?",
      key,
    );
    if (!row || now - row.window_start >= windowSeconds) {
      run(
        "INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1",
        key,
        now,
      );
      return { ok: true, remaining: limit - 1, retryAfter: 0 };
    }
    if (row.count >= limit) {
      return { ok: false, remaining: 0, retryAfter: row.window_start + windowSeconds - now };
    }
    run("UPDATE rate_limits SET count = count + 1 WHERE key = ?", key);
    return { ok: true, remaining: limit - row.count - 1, retryAfter: 0 };
  });
}

/* -------------------------------------------------------------------------- */
/* Human check (arithmetic CAPTCHA, verified server-side)                      */
/* -------------------------------------------------------------------------- */

export function createChallenge(): { id: string; prompt: string } {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  const id = randomUUID();
  run(
    "INSERT INTO challenges (id, prompt, answer_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+15 minutes'))",
    id,
    `Quanto é ${a} + ${b}?`,
    sha256(String(a + b)),
  );
  return { id, prompt: `Quanto é ${a} + ${b}?` };
}

export function solveChallenge(id: string, answer: string): boolean {
  const row = get<{ answer_hash: string }>(
    "SELECT answer_hash FROM challenges WHERE id = ? AND expires_at > datetime('now')",
    id,
  );
  run("DELETE FROM challenges WHERE id = ?", id);
  if (!row) return false;
  return row.answer_hash === sha256(answer.trim());
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export function getSettings(): SiteSettings {
  const rows = all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (!(r.key in DEFAULT_SETTINGS)) continue;
    const fallback = DEFAULT_SETTINGS[r.key as keyof SiteSettings];
    if (typeof fallback === "boolean") out[r.key] = r.value === "true";
    else if (typeof fallback === "number") out[r.key] = Number(r.value);
    else out[r.key] = r.value;
  }
  return out as unknown as SiteSettings;
}

export function saveSetting(key: string, value: string, actorId: number) {
  run(
    `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    key,
    value,
    nowIso(),
    actorId,
  );
}

export function setting(key: string): string | null {
  return pluck<string>("SELECT value FROM settings WHERE key = ?", key) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Tokens (email confirmation / password reset)                                */
/* -------------------------------------------------------------------------- */

export function issueToken(userId: number, kind: "verify_email" | "reset_password", hours = 24): string {
  const id = randomUUID();
  const token = randomBytes(24).toString("base64url");
  run(
    "INSERT INTO tokens (id, user_id, kind, expires_at) VALUES (?, ?, ?, datetime('now', ?))",
    sha256(token),
    userId,
    kind,
    `+${hours} hours`,
  );
  return `${id}.${token}`;
}

export function consumeToken(raw: string, kind: "verify_email" | "reset_password"): number | null {
  const [id, token] = raw.split(".");
  if (!id || !token) return null;
  const row = get<{ user_id: number }>(
    "SELECT user_id FROM tokens WHERE id = ? AND kind = ? AND used_at IS NULL AND expires_at > datetime('now')",
    sha256(token),
    kind,
  );
  if (!row) return null;
  run("UPDATE tokens SET used_at = ? WHERE id = ?", nowIso(), sha256(token));
  return row.user_id;
}

/* -------------------------------------------------------------------------- */
/* New-account defaults                                                        */
/* -------------------------------------------------------------------------- */

export const OWNER_EMAIL = "owner@memepedia.app";
export const OWNER_USERNAME = "memepedia";

export function roleForNewAccount(): Role {
  const settings = getSettings();
  return settings.requireReviewForNewUsers ? "user" : "contributor";
}
