import "server-only";
import { all, count, get, run, tx, nowIso } from "./db";
import { logAudit, notify } from "./auth";
import { MEME_FIELDS, ROLE_RANK, type ContributionKind, type ContributionStatus, type Role } from "./types";
import {
  commitVersion,
  createMeme,
  findDuplicates,
  normalizeTags,
  snapshotOf,
} from "./memes";

/** Every moderator and above hears about new abuse reports. */
export function notifyModerators(kind: string, title: string, body: string, url: string, actorId?: number) {
  const staff = all<{ id: number; role: Role }>("SELECT id, role FROM users WHERE status = 'active'");
  for (const u of staff) {
    if (ROLE_RANK[u.role] >= ROLE_RANK.moderator && u.id !== actorId) {
      notify({ userId: u.id, kind, title, body, url, actorId });
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Automated triage                                                            */
/* -------------------------------------------------------------------------- */

export interface TriageResult {
  score: number;
  flags: string[];
  level: "limpo" | "atencao" | "alto";
}

const ABUSIVE = [
  "idiota", "imbecil", "otário", "otario", "burro", "retardado", "escroto",
  "vagabunda", "viado", "nojento", "lixo humano", "vai morrer", "te mato",
];

const SHORTENERS = [
  "bit.ly", "tinyurl", "t.co", "goo.gl", "cutt.ly", "is.gd", "encurtador",
  "shorte.st", "rb.gy", "ow.ly", "rebrand.ly",
];

const GENERIC = [
  "meme engraçado", "meme muito engraçado", "muito engraçado", "esse é um meme",
  "é um meme", "meme legal", "piada engraçada", "meme bom", "hilário",
  "todo mundo ri", "todos riem",
];

function textOf(payload: Record<string, unknown>): string {
  return Object.values(payload)
    .map((v) => (Array.isArray(v) ? v.join(" ") : String(v ?? "")))
    .join("\n");
}

/**
 * Heuristic pre-screening that runs before a contribution reaches a human.
 *
 * This exists to *sort* the queue, not to decide it. It never publishes,
 * approves or rejects anything: the brief is explicit that automated review
 * assists the owner and does not replace them, and that is how it is wired.
 */
export function triage(payload: Record<string, unknown>): TriageResult {
  const flags: string[] = [];
  let score = 0;
  const text = textOf(payload);
  const lower = text.toLowerCase();

  const name = String(payload.name ?? "").trim();
  const description = String(payload.short_description ?? "").trim();

  if (!name) {
    flags.push("Campo obrigatório vazio: nome");
    score += 40;
  }
  if (description.length < 40) {
    flags.push("Descrição curta abaixo do mínimo editorial (40 caracteres)");
    score += 14;
  }
  if (GENERIC.some((g) => lower.includes(g))) {
    flags.push("Descrição genérica: descreva origem e uso em vez de julgar o meme");
    score += 18;
  }

  const longFields = ["origin", "history", "usage_notes"] as const;
  const emptyCore = longFields.filter((f) => String(payload[f] ?? "").trim().length < 30);
  if (emptyCore.length >= 2) {
    flags.push(`Campos de contexto praticamente vazios: ${emptyCore.join(", ")}`);
    score += 16;
  }
  if (!String(payload.sources ?? "").trim()) {
    flags.push("Sem fontes ou referências informadas");
    score += 8;
  }

  const links = lower.match(/https?:\/\/[^\s)]+/g) ?? [];
  if (links.length > 6) {
    flags.push(`Excesso de links (${links.length})`);
    score += 22;
  }
  for (const link of links) {
    const host = link.replace(/^https?:\/\//, "").split("/")[0];
    if (SHORTENERS.some((s) => host.includes(s))) {
      flags.push(`Link encurtado suspeito: ${host}`);
      score += 30;
    } else if (link.startsWith("http://")) {
      flags.push(`Link sem HTTPS: ${host}`);
      score += 10;
    } else if (/^\d+\.\d+\.\d+\.\d+/.test(host)) {
      flags.push("Link apontando para endereço IP literal");
      score += 35;
    }
  }

  const abusiveHits = ABUSIVE.filter((w) => lower.includes(w));
  if (abusiveHits.length) {
    flags.push(`Termos potencialmente abusivos: ${abusiveHits.join(", ")}`);
    score += 40;
  }

  if (/(.)\1{6,}/.test(text)) {
    flags.push("Repetição excessiva de caracteres");
    score += 20;
  }
  if (text.toUpperCase() === text && text.replace(/[^A-ZÀ-Ü]/g, "").length > 60) {
    flags.push("Texto inteiro em caixa alta");
    score += 10;
  }

  if (name.length >= 4) {
    const dupes = findDuplicates(name, description, 3);
    const strong = dupes.filter((d) => d.relevance >= 70);
    if (strong.length) {
      flags.push(`Possível duplicata: ${strong.map((d) => d.name).join(", ")}`);
      score += 25;
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, flags, level: score >= 55 ? "alto" : score >= 20 ? "atencao" : "limpo" };
}

/* -------------------------------------------------------------------------- */
/* Contribution submission                                                     */
/* -------------------------------------------------------------------------- */

export interface ContributionRow {
  id: number;
  kind: ContributionKind;
  meme_id: number | null;
  target_name: string;
  title: string;
  note: string;
  payload: string;
  status: ContributionStatus;
  submitted_by: number | null;
  created_at: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_note: string;
  resulting_version_id: number | null;
  resulting_meme_id: number | null;
  ai_flags: string;
  risk_score: number;
  author_name: string | null;
  author_username: string | null;
  reviewer_name: string | null;
  meme_slug: string | null;
  meme_name: string | null;
}

const CONTRIB_SELECT = `
  SELECT c.*, u.display_name AS author_name, u.username AS author_username,
         r.display_name AS reviewer_name, m.slug AS meme_slug, m.name AS meme_name
    FROM contributions c
    LEFT JOIN users u ON u.id = c.submitted_by
    LEFT JOIN users r ON r.id = c.reviewed_by
    LEFT JOIN memes m ON m.id = c.meme_id`;

export function getContribution(id: number): ContributionRow | undefined {
  return get<ContributionRow>(`${CONTRIB_SELECT} WHERE c.id = ?`, id);
}

export function listContributions(opts: {
  status?: ContributionStatus | "all";
  kind?: ContributionKind | "all";
  userId?: number;
  memeId?: number;
  limit?: number;
  offset?: number;
}): { items: ContributionRow[]; total: number } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.status && opts.status !== "all") {
    where.push("c.status = ?");
    params.push(opts.status);
  }
  if (opts.kind && opts.kind !== "all") {
    where.push("c.kind = ?");
    params.push(opts.kind);
  }
  if (opts.userId) {
    where.push("c.submitted_by = ?");
    params.push(opts.userId);
  }
  if (opts.memeId) {
    where.push("c.meme_id = ?");
    params.push(opts.memeId);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(opts.limit ?? 20, 100);
  const total = count(`SELECT COUNT(*) FROM contributions c ${whereSql}`, ...params);
  const items = all<ContributionRow>(
    `${CONTRIB_SELECT} ${whereSql}
     ORDER BY CASE c.status WHEN 'pending' THEN 0 ELSE 1 END, c.created_at DESC
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    opts.offset ?? 0,
  );
  return { items, total };
}

export function contributionChanges(contributionId: number) {
  return all<{ id: number; field: string; old_value: string; new_value: string }>(
    "SELECT id, field, old_value, new_value FROM contribution_changes WHERE contribution_id = ? ORDER BY id",
    contributionId,
  );
}

export interface ChangeInput {
  field: string;
  oldValue: string;
  newValue: string;
}

export function createContribution(input: {
  kind: ContributionKind;
  memeId?: number | null;
  targetName: string;
  title: string;
  note: string;
  payload: Record<string, unknown>;
  changes: ChangeInput[];
  userId: number;
  ipHash: string;
}): { id: number; triage: TriageResult } {
  const triageResult = triage(input.payload);
  return tx(() => {
    const res = run(
      `INSERT INTO contributions (kind, meme_id, target_name, title, note, payload, status,
          submitted_by, ai_flags, risk_score, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      input.kind,
      input.memeId ?? null,
      input.targetName.slice(0, 200),
      input.title.slice(0, 200),
      input.note.slice(0, 2000),
      JSON.stringify(input.payload),
      input.userId,
      JSON.stringify(triageResult.flags),
      triageResult.score,
      input.ipHash,
    );
    const id = Number(res.lastInsertRowid);
    for (const c of input.changes) {
      run(
        "INSERT INTO contribution_changes (contribution_id, field, old_value, new_value) VALUES (?, ?, ?, ?)",
        id,
        c.field,
        c.oldValue.slice(0, 20000),
        c.newValue.slice(0, 20000),
      );
    }
    if (input.memeId) {
      run("UPDATE memes SET contributions_count = contributions_count + 1 WHERE id = ?", input.memeId);
    }
    return { id, triage: triageResult };
  });
}

export type ReviewAction = "approve" | "reject" | "approve_with_edits" | "request_changes" | "delete";

export interface ReviewOutcome {
  ok: boolean;
  message: string;
  newMemeId?: number;
  versionId?: number;
}

/**
 * Single review entry point used by the admin queue. Approvals funnel into the
 * same versioning path as direct edits, so history stays linear and nothing is
 * ever silently overwritten.
 */
export function reviewContribution(input: {
  contributionId: number;
  reviewerId: number;
  reviewerName: string;
  action: ReviewAction;
  note?: string;
  editedValues?: Record<string, string>;
  ipHash?: string;
}): ReviewOutcome {
  const contribution = getContribution(input.contributionId);
  if (!contribution) return { ok: false, message: "Contribuição não encontrada." };
  if (contribution.status !== "pending" && input.action !== "delete") {
    return { ok: false, message: "Esta contribuição já foi avaliada." };
  }

  const payload = safeParse(contribution.payload);
  if (input.editedValues) {
    for (const [k, v] of Object.entries(input.editedValues)) payload[k] = v;
  }

  if (input.action === "delete") {
    tx(() => {
      run("DELETE FROM contributions WHERE id = ?", input.contributionId);
      if (contribution.meme_id) {
        run("UPDATE memes SET contributions_count = MAX(0, contributions_count - 1) WHERE id = ?", contribution.meme_id);
      }
    });
    logAudit({
      actorId: input.reviewerId,
      actorName: input.reviewerName,
      action: "contribuicao.excluida",
      resourceType: "contribution",
      resourceId: input.contributionId,
      meta: { titulo: contribution.title },
      ipHash: input.ipHash,
    });
    return { ok: true, message: "Contribuição excluída do banco de dados." };
  }

  if (input.action === "reject" || input.action === "request_changes") {
    const status: ContributionStatus = input.action === "reject" ? "rejected" : "changed";
    run(
      "UPDATE contributions SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?",
      status,
      input.reviewerId,
      nowIso(),
      (input.note ?? (input.action === "reject" ? "Rejeitada pela moderação." : "Alterações solicitadas.")).slice(0, 2000),
      input.contributionId,
    );
    if (contribution.submitted_by) {
      notify({
        userId: contribution.submitted_by,
        kind: input.action === "reject" ? "contribution_rejected" : "contribution_changes_requested",
        title:
          input.action === "reject"
            ? `Contribuição rejeitada: ${contribution.title}`
            : `Alteração solicitada: ${contribution.title}`,
        body: input.note ?? "",
        url: "/contribuicoes",
        actorId: input.reviewerId,
      });
    }
    logAudit({
      actorId: input.reviewerId,
      actorName: input.reviewerName,
      action: input.action === "reject" ? "contribuicao.rejeitada" : "contribuicao.alteracao_solicitada",
      resourceType: "contribution",
      resourceId: input.contributionId,
      meta: { titulo: contribution.title, motivo: input.note ?? "" },
      ipHash: input.ipHash,
    });
    return {
      ok: true,
      message: input.action === "reject" ? "Contribuição rejeitada." : "Alteração solicitada ao autor.",
    };
  }

  /* ---- Approve (optionally with reviewer edits applied on top) ---- */
  let newMemeId: number | undefined;
  let versionId: number | undefined;

  tx(() => {
    if (contribution.kind === "new_meme") {
      const snapshot = {
        name: stringVal(payload.name),
        short_description: stringVal(payload.short_description),
        origin: stringVal(payload.origin),
        history: stringVal(payload.history),
        usage_notes: stringVal(payload.usage_notes),
        characteristics: stringVal(payload.characteristics),
        variations: stringVal(payload.variations),
        trivia: stringVal(payload.trivia),
        sources: stringVal(payload.sources),
        approx_year: numberVal(payload.approx_year),
        approx_period: stringVal(payload.approx_period),
        country: stringVal(payload.country),
        region: stringVal(payload.region),
        category_id: numberVal(payload.category_id),
        tags: normalizeTags(stringVal(payload.tags)),
      };
      newMemeId = createMeme({
        snapshot,
        actorId: contribution.submitted_by ?? input.reviewerId,
        status: "published",
        reason: `Contribuição #${contribution.id} aprovada por ${input.reviewerName}`,
        source: "contribution",
      });
      run(
        "UPDATE contributions SET status = 'approved', reviewed_by = ?, reviewed_at = ?, review_note = ?, resulting_meme_id = ? WHERE id = ?",
        input.reviewerId,
        nowIso(),
        (input.note ?? "Aprovada.").slice(0, 2000),
        newMemeId,
        input.contributionId,
      );
    } else {
      if (!contribution.meme_id) throw new Error("Contribuição sem meme alvo.");
      const current = snapshotOf(contribution.meme_id);
      if (!current) throw new Error("Meme alvo não existe mais.");
      const next = { ...current };
      for (const field of MEME_FIELDS) {
        const value = payload[field.key];
        if (value === undefined) continue;
        if (field.key === "approx_year") next.approx_year = numberVal(value);
        else if (field.key === "category_id") next.category_id = numberVal(value);
        else if (field.key === "tags") next.tags = normalizeTags(stringVal(value));
        else (next as unknown as Record<string, unknown>)[field.key] = stringVal(value);
      }
      versionId = commitVersion({
        memeId: contribution.meme_id,
        snapshot: next,
        actorId: input.reviewerId,
        reason: `Contribuição #${contribution.id} de ${contribution.author_name ?? "usuário"} aprovada`,
        source: "contribution",
        contributionId: contribution.id,
      });
      run(
        "UPDATE contributions SET status = 'approved', reviewed_by = ?, reviewed_at = ?, review_note = ?, resulting_version_id = ? WHERE id = ?",
        input.reviewerId,
        nowIso(),
        (input.note ?? "Aprovada.").slice(0, 2000),
        versionId,
        input.contributionId,
      );
    }
  });

  if (contribution.submitted_by) {
    notify({
      userId: contribution.submitted_by,
      kind: "contribution_approved",
      title: `Contribuição aprovada: ${contribution.title}`,
      body: input.action === "approve_with_edits"
        ? "Aprovada com ajustes de redação feitos pela moderação."
        : "Obrigado por contribuir com a Memepedia.",
      url: newMemeId ? "/memes" : contribution.meme_slug ? `/meme/${contribution.meme_slug}` : "/contribuicoes",
      actorId: input.reviewerId,
    });
    run(
      "UPDATE profiles SET approved_total = approved_total + 1 WHERE user_id = ?",
      contribution.submitted_by,
    );
  }

  logAudit({
    actorId: input.reviewerId,
    actorName: input.reviewerName,
    action: input.action === "approve_with_edits" ? "contribuicao.aprovada_com_edicao" : "contribuicao.aprovada",
    resourceType: "contribution",
    resourceId: input.contributionId,
    meta: { titulo: contribution.title, novo_meme: newMemeId ?? null, versao: versionId ?? null },
    ipHash: input.ipHash,
  });

  return {
    ok: true,
    message: input.action === "approve_with_edits" ? "Contribuição aprovada com edições." : "Contribuição aprovada.",
    newMemeId,
    versionId,
  };
}

export function cancelContribution(contributionId: number, userId: number): boolean {
  const c = get<{ submitted_by: number | null; status: string }>(
    "SELECT submitted_by, status FROM contributions WHERE id = ?",
    contributionId,
  );
  if (!c || c.submitted_by !== userId || c.status !== "pending") return false;
  run("UPDATE contributions SET status = 'cancelled', reviewed_at = ? WHERE id = ?", nowIso(), contributionId);
  return true;
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

export function listReports(opts: { status?: string; limit?: number; offset?: number } = {}) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.status && opts.status !== "all") {
    where.push("r.status = ?");
    params.push(opts.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = count(`SELECT COUNT(*) FROM reports r ${whereSql}`, ...params);
  const items = all<{
    id: number;
    target_type: string;
    target_id: number;
    reporter_id: number | null;
    reason: string;
    details: string;
    status: string;
    created_at: string;
    resolved_by: number | null;
    resolved_at: string | null;
    resolution_note: string;
    reporter_name: string | null;
    resolver_name: string | null;
    target_label: string;
    target_url: string | null;
  }>(
    `SELECT r.*, u.display_name AS reporter_name, res.display_name AS resolver_name,
            CASE r.target_type
              WHEN 'meme' THEN (SELECT m.name FROM memes m WHERE m.id = r.target_id)
              WHEN 'comment' THEN (SELECT substr(cm.body, 1, 80) FROM comments cm WHERE cm.id = r.target_id)
              WHEN 'user' THEN (SELECT us.username FROM users us WHERE us.id = r.target_id)
              ELSE ''
            END AS target_label,
            CASE r.target_type
              WHEN 'meme' THEN (SELECT '/meme/' || m.slug FROM memes m WHERE m.id = r.target_id)
              WHEN 'user' THEN (SELECT '/perfil/' || us.username FROM users us WHERE us.id = r.target_id)
              ELSE NULL
            END AS target_url
       FROM reports r
       LEFT JOIN users u ON u.id = r.reporter_id
       LEFT JOIN users res ON res.id = r.resolved_by
       ${whereSql}
      ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END, r.created_at DESC
      LIMIT ? OFFSET ?`,
    ...params,
    opts.limit ?? 20,
    opts.offset ?? 0,
  );
  return { items, total };
}

export function createReport(input: {
  targetType: "meme" | "comment" | "user" | "media";
  targetId: number;
  reporterId: number;
  reason: string;
  details: string;
  ipHash: string;
}): { ok: boolean; message: string } {
  const existing = get(
    "SELECT 1 FROM reports WHERE target_type = ? AND target_id = ? AND reporter_id = ? AND status = 'open'",
    input.targetType,
    input.targetId,
    input.reporterId,
  );
  if (existing) return { ok: false, message: "Você já tem uma denúncia aberta sobre este conteúdo." };

  tx(() => {
    run(
      `INSERT INTO reports (target_type, target_id, reporter_id, reason, details, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.targetType,
      input.targetId,
      input.reporterId,
      input.reason,
      input.details.slice(0, 2000),
      input.ipHash,
    );
    if (input.targetType === "comment") {
      run("UPDATE comments SET reports_count = reports_count + 1 WHERE id = ?", input.targetId);
    }
  });

  const label =
    input.targetType === "meme"
      ? (get<{ name: string }>("SELECT name FROM memes WHERE id = ?", input.targetId)?.name ?? "meme")
      : input.targetType === "user"
        ? (get<{ username: string }>("SELECT username FROM users WHERE id = ?", input.targetId)?.username ?? "usuário")
        : "comentário";
  notifyModerators(
    "report_created",
    "Nova denúncia registrada",
    `${input.reason} em ${label}: ${input.details.slice(0, 120)}`,
    "/admin/denuncias",
    input.reporterId,
  );

  return { ok: true, message: "Denúncia registrada. Nossa equipe vai analisar." };
}

export function resolveReport(input: {
  reportId: number;
  resolverId: number;
  resolverName: string;
  status: "resolved" | "dismissed";
  note: string;
  ipHash?: string;
}) {
  run(
    "UPDATE reports SET status = ?, resolved_by = ?, resolved_at = ?, resolution_note = ? WHERE id = ?",
    input.status,
    input.resolverId,
    nowIso(),
    input.note.slice(0, 2000),
    input.reportId,
  );
  logAudit({
    actorId: input.resolverId,
    actorName: input.resolverName,
    action: input.status === "resolved" ? "denuncia.resolvida" : "denuncia.arquivada",
    resourceType: "report",
    resourceId: input.reportId,
    meta: { nota: input.note },
    ipHash: input.ipHash,
  });
}

/* -------------------------------------------------------------------------- */
/* Comments                                                                    */
/* -------------------------------------------------------------------------- */

export function listComments(memeId: number, includeHidden = false) {
  const where = includeHidden ? "" : "AND c.status = 'visible'";
  return all<{
    id: number;
    parent_id: number | null;
    body: string;
    status: string;
    created_at: string;
    reports_count: number;
    user_id: number | null;
    author_name: string | null;
    author_username: string | null;
    author_avatar: string | null;
    author_role: string | null;
  }>(
    `SELECT c.id, c.parent_id, c.body, c.status, c.created_at, c.reports_count, c.user_id,
            u.display_name AS author_name, u.username AS author_username,
            u.avatar_url AS author_avatar, u.role AS author_role
       FROM comments c LEFT JOIN users u ON u.id = c.user_id
      WHERE c.meme_id = ? ${where}
      ORDER BY c.created_at ASC`,
    memeId,
  );
}

export function createComment(input: {
  memeId: number;
  parentId: number | null;
  userId: number;
  body: string;
  ipHash: string;
}): { ok: boolean; message: string } {
  const body = input.body.trim();
  if (body.length < 2) return { ok: false, message: "Escreva um comentário com pelo menos 2 caracteres." };
  if (body.length > 1500) return { ok: false, message: "Comentário muito longo (limite de 1500 caracteres)." };
  const result = triage({ comentario: body });
  if (result.level === "alto") {
    return {
      ok: false,
      message: "Seu comentário foi bloqueado pela triagem automática. Reformule sem links suspeitos ou termos abusivos.",
    };
  }
  run(
    `INSERT INTO comments (meme_id, parent_id, user_id, body, ip_hash) VALUES (?, ?, ?, ?, ?)`,
    input.memeId,
    input.parentId,
    input.userId,
    body,
    input.ipHash,
  );
  if (input.parentId) {
    const parent = get<{ user_id: number | null }>("SELECT user_id FROM comments WHERE id = ?", input.parentId);
    const meme = get<{ slug: string; name: string }>("SELECT slug, name FROM memes WHERE id = ?", input.memeId);
    if (parent?.user_id && parent.user_id !== input.userId && meme) {
      notify({
        userId: parent.user_id,
        kind: "comment_reply",
        title: "Alguém respondeu seu comentário",
        body: body.slice(0, 120),
        url: `/meme/${meme.slug}#comentarios`,
        actorId: input.userId,
      });
    }
  }
  return { ok: true, message: "Comentário publicado." };
}

export function moderateComment(input: {
  commentId: number;
  actorId: number;
  actorName: string;
  status: "visible" | "hidden" | "deleted";
  ipHash?: string;
}) {
  run("UPDATE comments SET status = ?, updated_at = ? WHERE id = ?", input.status, nowIso(), input.commentId);
  logAudit({
    actorId: input.actorId,
    actorName: input.actorName,
    action: `comentario.${input.status}`,
    resourceType: "comment",
    resourceId: input.commentId,
    ipHash: input.ipHash,
  });
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function safeParse(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringVal(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function numberVal(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
