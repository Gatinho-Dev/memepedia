import "server-only";
import { all, count, get, run, tx, nowIso } from "./db";
import { logAudit } from "./auth";
import { ROLE_RANK, type Role, type UserStatus } from "./types";

export function dashboardStats() {
  return {
    memes: count("SELECT COUNT(*) FROM memes WHERE status = 'published'"),
    memesHidden: count("SELECT COUNT(*) FROM memes WHERE status = 'hidden'"),
    memesDeleted: count("SELECT COUNT(*) FROM memes WHERE status = 'deleted'"),
    pendingMemes: count("SELECT COUNT(*) FROM contributions WHERE kind = 'new_meme' AND status = 'pending'"),
    pendingCorrections: count("SELECT COUNT(*) FROM contributions WHERE kind = 'correction' AND status = 'pending'"),
    pendingTotal: count("SELECT COUNT(*) FROM contributions WHERE status = 'pending'"),
    highRisk: count("SELECT COUNT(*) FROM contributions WHERE status = 'pending' AND risk_score >= 55"),
    users: count("SELECT COUNT(*) FROM users"),
    activeUsers: count("SELECT COUNT(*) FROM users WHERE status = 'active'"),
    bannedUsers: count("SELECT COUNT(*) FROM users WHERE status = 'banned'"),
    openReports: count("SELECT COUNT(*) FROM reports WHERE status = 'open'"),
    versions: count("SELECT COUNT(*) FROM meme_versions"),
    comments: count("SELECT COUNT(*) FROM comments WHERE status = 'visible'"),
    viewsToday: count("SELECT COALESCE(SUM(count), 0) FROM views WHERE day = date('now')"),
    viewsWeek: count("SELECT COALESCE(SUM(count), 0) FROM views WHERE day >= date('now', '-6 days')"),
    viewsAll: count("SELECT COALESCE(SUM(count), 0) FROM views"),
    categories: count("SELECT COUNT(*) FROM categories"),
    tags: count("SELECT COUNT(*) FROM tags"),
    protectedPages: count("SELECT COUNT(*) FROM memes WHERE protection != 'free'"),
    demoContent: count("SELECT COUNT(*) FROM memes WHERE is_demo = 1"),
  };
}

export function viewsTrend(days = 14): { day: string; count: number }[] {
  const rows = all<{ day: string; count: number }>(
    `SELECT day, COALESCE(SUM(count), 0) AS count FROM views
      WHERE day >= date('now', ?) GROUP BY day ORDER BY day`,
    `-${days - 1} days`,
  );
  const byDay = new Map(rows.map((r) => [r.day, Number(r.count)]));
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}

export function growthTrend(months = 6): { month: string; memes: number; users: number; contributions: number }[] {
  const rows = all<{ month: string; memes: number; users: number; contributions: number }>(
    `SELECT strftime('%Y-%m', created_at) AS month,
            COUNT(*) AS memes, 0 AS users, 0 AS contributions
       FROM memes GROUP BY month
      UNION ALL
     SELECT strftime('%Y-%m', created_at) AS month, 0, COUNT(*), 0
       FROM users GROUP BY month
      UNION ALL
     SELECT strftime('%Y-%m', created_at) AS month, 0, 0, COUNT(*)
       FROM contributions GROUP BY month`,
  );
  const merged = new Map<string, { month: string; memes: number; users: number; contributions: number }>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    merged.set(key, { month: key, memes: 0, users: 0, contributions: 0 });
  }
  for (const r of rows) {
    const entry = merged.get(r.month);
    if (!entry) continue;
    entry.memes += Number(r.memes);
    entry.users += Number(r.users);
    entry.contributions += Number(r.contributions);
  }
  return [...merged.values()];
}

export function mostViewed(limit = 8) {
  return all<{ id: number; slug: string; name: string; views_count: number; popularity: number }>(
    "SELECT id, slug, name, views_count, popularity FROM memes WHERE status = 'published' ORDER BY views_count DESC LIMIT ?",
    limit,
  );
}

export function topCategories(limit = 8) {
  return all<{ slug: string; name: string; n: number }>(
    `SELECT c.slug, c.name, COUNT(m.id) AS n FROM categories c
       LEFT JOIN memes m ON m.category_id = c.id AND m.status = 'published'
      GROUP BY c.id ORDER BY n DESC, c.sort_order LIMIT ?`,
    limit,
  );
}

export function mostActiveUsers(limit = 8) {
  return all<{
    id: number;
    username: string;
    display_name: string;
    role: Role;
    contributions: number;
    approved: number;
  }>(
    `SELECT u.id, u.username, u.display_name, u.role,
            (SELECT COUNT(*) FROM contributions c WHERE c.submitted_by = u.id) AS contributions,
            (SELECT COUNT(*) FROM contributions c WHERE c.submitted_by = u.id AND c.status = 'approved') AS approved
       FROM users u ORDER BY contributions DESC, approved DESC LIMIT ?`,
    limit,
  );
}

export function recentActivity(limit = 12) {
  return all<{
    id: number;
    actor_name: string;
    action: string;
    resource_type: string;
    resource_id: string;
    result: string;
    created_at: string;
    meta: string;
  }>(
    `SELECT id, actor_name, action, resource_type, resource_id, result, created_at, meta
       FROM audit_logs ORDER BY id DESC LIMIT ?`,
    limit,
  );
}

export function auditLogList(opts: { limit?: number; offset?: number; q?: string; result?: string } = {}) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.q) {
    where.push("(action LIKE ? OR actor_name LIKE ? OR resource_type LIKE ?)");
    const like = `%${opts.q}%`;
    params.push(like, like, like);
  }
  if (opts.result && opts.result !== "all") {
    where.push("result = ?");
    params.push(opts.result);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = count(`SELECT COUNT(*) FROM audit_logs ${whereSql}`, ...params);
  const items = all<{
    id: number;
    actor_id: number | null;
    actor_name: string;
    action: string;
    resource_type: string;
    resource_id: string;
    result: string;
    meta: string;
    created_at: string;
  }>(
    `SELECT id, actor_id, actor_name, action, resource_type, resource_id, result, meta, created_at
       FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    ...params,
    opts.limit ?? 40,
    opts.offset ?? 0,
  );
  return { items, total };
}

export function listUsersAdmin(opts: { q?: string; role?: string; status?: string; limit?: number; offset?: number } = {}) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.q) {
    where.push("(u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)");
    const like = `%${opts.q}%`;
    params.push(like, like, like);
  }
  if (opts.role && opts.role !== "all") {
    where.push("u.role = ?");
    params.push(opts.role);
  }
  if (opts.status && opts.status !== "all") {
    where.push("u.status = ?");
    params.push(opts.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = count(`SELECT COUNT(*) FROM users u ${whereSql}`, ...params);
  const items = all<{
    id: number;
    username: string;
    display_name: string;
    email: string;
    role: Role;
    status: UserStatus;
    status_reason: string | null;
    is_owner: number;
    created_at: string;
    last_seen_at: string | null;
    contributions: number;
    approved: number;
    rejected: number;
  }>(
    `SELECT u.id, u.username, u.display_name, u.email, u.role, u.status, u.status_reason,
            u.is_owner, u.created_at, u.last_seen_at,
            (SELECT COUNT(*) FROM contributions c WHERE c.submitted_by = u.id) AS contributions,
            (SELECT COUNT(*) FROM contributions c WHERE c.submitted_by = u.id AND c.status = 'approved') AS approved,
            (SELECT COUNT(*) FROM contributions c WHERE c.submitted_by = u.id AND c.status = 'rejected') AS rejected
       FROM users u ${whereSql}
      ORDER BY CASE u.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 WHEN 'contributor' THEN 3 ELSE 4 END,
               u.created_at DESC
      LIMIT ? OFFSET ?`,
    ...params,
    opts.limit ?? 25,
    opts.offset ?? 0,
  );
  return { items, total };
}

export function getUserAdmin(userId: number) {
  return get<{
    id: number;
    username: string;
    display_name: string;
    email: string;
    role: Role;
    status: UserStatus;
    status_reason: string | null;
    status_until: string | null;
    is_owner: number;
    created_at: string;
    last_seen_at: string | null;
    last_login_at: string | null;
    bio: string;
    contributions: number;
    approved: number;
    rejected: number;
  }>(
    `SELECT u.id, u.username, u.display_name, u.email, u.role, u.status, u.status_reason,
            u.status_until, u.is_owner, u.created_at, u.last_seen_at, u.last_login_at,
            COALESCE(p.bio, '') AS bio,
            (SELECT COUNT(*) FROM contributions c WHERE c.submitted_by = u.id) AS contributions,
            (SELECT COUNT(*) FROM contributions c WHERE c.submitted_by = u.id AND c.status = 'approved') AS approved,
            (SELECT COUNT(*) FROM contributions c WHERE c.submitted_by = u.id AND c.status = 'rejected') AS rejected
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`,
    userId,
  );
}

export function setUserRole(input: {
  userId: number;
  role: Role;
  actorId: number;
  actorName: string;
  ipHash?: string;
}): { ok: boolean; message: string } {
  if (input.role === "owner") {
    return { ok: false, message: "O papel OWNER só pode ser transferido em /admin/permissoes com confirmação explícita." };
  }
  const target = get<{ role: Role; username: string; is_owner: number }>(
    "SELECT role, username, is_owner FROM users WHERE id = ?",
    input.userId,
  );
  if (!target) return { ok: false, message: "Usuário não encontrado." };
  if (target.is_owner === 1) return { ok: false, message: "Não é possível rebaixar o OWNER desta forma." };
  const previous = target.role;
  run("UPDATE users SET role = ? WHERE id = ?", input.role, input.userId);
  logAudit({
    actorId: input.actorId,
    actorName: input.actorName,
    action: "usuario.papel_alterado",
    resourceType: "user",
    resourceId: input.userId,
    meta: { usuario: target.username, de: previous, para: input.role },
    ipHash: input.ipHash,
  });
  return { ok: true, message: `Papel de @${target.username} alterado para ${input.role}.` };
}

export function setUserStatus(input: {
  userId: number;
  status: UserStatus;
  reason: string;
  actorId: number;
  actorName: string;
  ipHash?: string;
}): { ok: boolean; message: string } {
  if (input.userId === input.actorId) {
    return { ok: false, message: "Você não pode alterar o status da própria conta." };
  }
  const target = get<{ username: string; is_owner: number }>(
    "SELECT username, is_owner FROM users WHERE id = ?",
    input.userId,
  );
  if (!target) return { ok: false, message: "Usuário não encontrado." };
  if (target.is_owner === 1) return { ok: false, message: "A conta do OWNER não pode ser suspensa ou banida." };

  run(
    "UPDATE users SET status = ?, status_reason = ? WHERE id = ?",
    input.status,
    input.reason.slice(0, 500),
    input.userId,
  );
  if (input.status !== "active") {
    run("DELETE FROM sessions WHERE user_id = ?", input.userId);
  }
  logAudit({
    actorId: input.actorId,
    actorName: input.actorName,
    action: `usuario.${input.status === "active" ? "reativado" : input.status === "banned" ? "banido" : "suspenso"}`,
    resourceType: "user",
    resourceId: input.userId,
    meta: { usuario: target.username, motivo: input.reason },
    ipHash: input.ipHash,
  });
  return { ok: true, message: `Status de @${target.username} atualizado.` };
}

/** Paginated, guarded content table with the quick actions from requirement 59. */
export function listMemesAdmin(opts: { q?: string; status?: string; page?: number; perPage?: number } = {}) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.q) {
    where.push("m.name LIKE ?");
    params.push(`%${opts.q}%`);
  }
  if (opts.status && opts.status !== "all") {
    where.push("m.status = ?");
    params.push(opts.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const perPage = opts.perPage ?? 20;
  const page = Math.max(1, opts.page ?? 1);
  const total = count(`SELECT COUNT(*) FROM memes m ${whereSql}`, ...params);
  const items = all<{
    id: number;
    slug: string;
    name: string;
    status: string;
    protection: string;
    verified: number;
    featured: number;
    is_demo: number;
    comments_enabled: number;
    versions_count: number;
    views_count: number;
    contributions_count: number;
    pending: number;
    category_name: string | null;
    updated_at: string;
    thumb_url: string | null;
  }>(
    `SELECT m.id, m.slug, m.name, m.status, m.protection, m.verified, m.featured, m.is_demo,
            m.comments_enabled, m.versions_count, m.views_count, m.contributions_count, m.updated_at,
            c.name AS category_name,
            (SELECT COUNT(*) FROM contributions ct WHERE ct.meme_id = m.id AND ct.status = 'pending') AS pending,
            (SELECT md.thumb_url FROM meme_media md WHERE md.meme_id = m.id AND md.is_primary = 1 LIMIT 1) AS thumb_url
       FROM memes m LEFT JOIN categories c ON c.id = m.category_id
       ${whereSql}
      ORDER BY CASE m.status WHEN 'hidden' THEN 0 WHEN 'deleted' THEN 1 ELSE 2 END, m.updated_at DESC
      LIMIT ? OFFSET ?`,
    ...params,
    perPage,
    (page - 1) * perPage,
  );
  return { items, total, page, perPage };
}

export function setMemeFlags(input: {
  memeId: number;
  actorId: number;
  actorName: string;
  patch: Partial<{ status: string; verified: number; featured: number; protection: string; comments_enabled: number }>;
  ipHash?: string;
  note?: string;
}) {
  return tx(() => {
    const meme = get<{ name: string; slug: string; featured: number; protection: string }>(
      "SELECT name, slug, featured, protection FROM memes WHERE id = ?",
      input.memeId,
    );
    if (!meme) return { ok: false, message: "Meme não encontrado." };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(input.patch)) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
    if (!sets.length) return { ok: true, message: "Nada a alterar." };
    sets.push("updated_at = ?");
    values.push(nowIso());
    run(`UPDATE memes SET ${sets.join(", ")} WHERE id = ?`, ...values, input.memeId);

    if (input.patch.featured !== undefined) {
      if (input.patch.featured === 1) {
        run(
          "INSERT INTO featured_memes (meme_id, note, active, featured_by) VALUES (?, ?, 1, ?)",
          input.memeId,
          input.note ?? "",
          input.actorId,
        );
      } else {
        run("UPDATE featured_memes SET active = 0, removed_at = ? WHERE meme_id = ? AND active = 1", nowIso(), input.memeId);
      }
    }

    if (input.patch.protection !== undefined && input.patch.protection !== meme.protection) {
      run("UPDATE page_locks SET active = 0, released_by = ?, released_at = ? WHERE meme_id = ? AND active = 1", input.actorId, nowIso(), input.memeId);
      run(
        "INSERT INTO page_locks (meme_id, level, reason, active, set_by) VALUES (?, ?, ?, 1, ?)",
        input.memeId,
        input.patch.protection,
        input.note ?? "",
        input.actorId,
      );
    }

    logAudit({
      actorId: input.actorId,
      actorName: input.actorName,
      action: `meme.${Object.keys(input.patch).join("+")}`,
      resourceType: "meme",
      resourceId: input.memeId,
      meta: { meme: meme.name, patch: input.patch, nota: input.note ?? "" },
      ipHash: input.ipHash,
    });
    return { ok: true, message: `Ações aplicadas em ${meme.name}.` };
  });
}

export function hardDeleteMeme(input: {
  memeId: number;
  actorId: number;
  actorName: string;
  ipHash?: string;
}): { ok: boolean; message: string } {
  const meme = get<{ name: string; slug: string }>("SELECT name, slug FROM memes WHERE id = ?", input.memeId);
  if (!meme) return { ok: false, message: "Meme não encontrado." };
  tx(() => {
    run("DELETE FROM memes_fts WHERE meme_id = ?", input.memeId);
    run("DELETE FROM memes WHERE id = ?", input.memeId);
    logAudit({
      actorId: input.actorId,
      actorName: input.actorName,
      action: "meme.excluido_permanentemente",
      resourceType: "meme",
      resourceId: input.memeId,
      meta: { meme: meme.name, slug: meme.slug },
      ipHash: input.ipHash,
    });
  });
  return { ok: true, message: `"${meme.name}" foi excluído permanentemente.` };
}

export function pageLocks() {
  return all<{
    id: number;
    meme_id: number;
    level: string;
    reason: string;
    set_at: string;
    set_by: number | null;
    name: string;
    slug: string;
    actor: string | null;
  }>(
    `SELECT l.id, l.meme_id, l.level, l.reason, l.set_at, l.set_by, m.name, m.slug,
            u.display_name AS actor
       FROM page_locks l JOIN memes m ON m.id = l.meme_id
       LEFT JOIN users u ON u.id = l.set_by
      WHERE l.active = 1 ORDER BY l.set_at DESC`,
  );
}
