"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clientFingerprint,
  logAudit,
  notify,
  notifyFollowers,
  requireCap,
  saveSetting,
  verifyPassword,
} from "@/lib/auth";
import { hardDeleteMeme, setMemeFlags, setUserRole, setUserStatus } from "@/lib/admin";
import { bootstrap } from "@/lib/bootstrap";
import { all, get, run, tx } from "@/lib/db";
import { bool, done, fail, num, slugSchema, str, type ActionState } from "@/lib/forms";
import type { Capability } from "@/lib/permissions";
import { moderateComment, resolveReport, reviewContribution, type ReviewAction } from "@/lib/moderation";
import { reindexMeme } from "@/lib/db";
import { slugify } from "@/lib/memes";
import { DEFAULT_SETTINGS } from "@/lib/permissions";
import { ROLE_RANK, type Role, type UserStatus } from "@/lib/types";

function safePath(value: string, fallback: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/** Append a query fragment to a path that may already carry one. */
function withQuery(path: string, query: string, hash = ""): string {
  return `${path}${path.includes("?") ? "&" : "?"}${query}${hash}`;
}

/* -------------------------------------------------------------------------- */
/* Review queue                                                                */
/* -------------------------------------------------------------------------- */

export async function reviewContributionAction(form: FormData): Promise<void> {
  bootstrap();
  const user = await requireCap("contribution.review");
  const contributionId = num(form, "contribution_id") ?? 0;
  const action = str(form, "decision", 30) as ReviewAction;
  const note = str(form, "review_note", 2000);
  const back = safePath(str(form, "return_to", 300), "/admin/revisao");

  if (!["approve", "reject", "approve_with_edits", "request_changes", "delete"].includes(action)) {
    redirect(withQuery(back, "erro=acao"));
  }

  const editedValues: Record<string, string> = {};
  if (action === "approve_with_edits") {
    for (const [key, value] of form.entries()) {
      if (key.startsWith("edit_") && typeof value === "string") {
        editedValues[key.replace(/^edit_/, "")] = value;
      }
    }
  }

  const { ipHash } = await clientFingerprint();
  const outcome = reviewContribution({
    contributionId,
    reviewerId: user.id,
    reviewerName: user.displayName,
    action,
    note,
    editedValues: action === "approve_with_edits" ? editedValues : undefined,
    ipHash,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/revisao");
  revalidatePath("/contribuicoes");
  if (outcome.newMemeId) {
    const slug = get<{ slug: string }>("SELECT slug FROM memes WHERE id = ?", outcome.newMemeId)?.slug;
    if (slug) revalidatePath(`/meme/${slug}`);
  }
  redirect(withQuery(back, `resultado=${outcome.ok ? "ok" : "erro"}`, `#contribuicao-${contributionId}`));
}

export async function bulkReviewAction(form: FormData): Promise<void> {
  const user = await requireCap("contribution.review");
  const ids = form.getAll("ids").map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
  const decision = str(form, "bulk_decision", 20);
  if (!ids.length || decision !== "approve") redirect("/admin/revisao?erro=selecao");

  const { ipHash } = await clientFingerprint();
  let approved = 0;
  for (const id of ids) {
    const outcome = reviewContribution({
      contributionId: id,
      reviewerId: user.id,
      reviewerName: user.displayName,
      action: "approve",
      note: "Aprovação em lote pela fila de revisão.",
      ipHash,
    });
    if (outcome.ok) approved++;
  }
  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: "contribuicao.aprovacao_em_lote",
    resourceType: "contribution",
    resourceId: ids.join(","),
    meta: { aprovadas: approved, total: ids.length },
    ipHash,
  });
  revalidatePath("/admin/revisao");
  redirect(`/admin/revisao?lote=${approved}`);
}

/* -------------------------------------------------------------------------- */
/* Meme moderation                                                             */
/* -------------------------------------------------------------------------- */

export async function memeFlagAction(form: FormData): Promise<void> {
  const action = str(form, "action", 40);
  const memeId = num(form, "meme_id") ?? 0;
  const back = safePath(str(form, "return_to", 300), "/admin/memes");
  const note = str(form, "note", 500);

  const CAP_BY_ACTION: Record<string, Capability> = {
    verify: "meme.verify",
    unverify: "meme.verify",
    feature: "meme.feature",
    unfeature: "meme.feature",
    protect: "meme.protect",
    hide: "meme.delete",
    delete: "meme.delete",
    restore: "meme.restore",
    toggle_comments: "comment.moderate",
  };
  const capability = CAP_BY_ACTION[action];
  if (!capability) redirect(withQuery(back, "erro=acao"));

  const user = await requireCap(capability);
  const { ipHash } = await clientFingerprint();

  const patch: Parameters<typeof setMemeFlags>[0]["patch"] = {};
  switch (action) {
    case "verify":
      patch.verified = 1;
      break;
    case "unverify":
      patch.verified = 0;
      break;
    case "feature":
      patch.featured = 1;
      break;
    case "unfeature":
      patch.featured = 0;
      break;
    case "hide":
      patch.status = "hidden";
      break;
    case "delete":
      patch.status = "deleted";
      break;
    case "restore":
      patch.status = "published";
      break;
    case "protect": {
      const level = str(form, "level", 20);
      if (!["free", "moderated", "protected", "admin"].includes(level)) {
        redirect(withQuery(back, "erro=nivel"));
      }
      patch.protection = level;
      break;
    }
    case "toggle_comments":
      patch.comments_enabled = bool(form, "enabled") ? 1 : 0;
      break;
    default:
      redirect(withQuery(back, "erro=acao"));
  }

  const meme = get<{ slug: string; name: string }>("SELECT slug, name FROM memes WHERE id = ?", memeId);
  if (!meme) redirect(withQuery(back, "erro=meme"));

  const result = setMemeFlags({
    memeId,
    actorId: user.id,
    actorName: user.displayName,
    patch,
    note,
    ipHash,
  });

  if (patch.verified === 1) {
    notifyFollowers(
      memeId,
      user.id,
      `Página verificada: ${meme.name}`,
      "A administração revisou e verificou as informações desta página.",
      `/meme/${meme.slug}`,
    );
  }

  revalidatePath(`/meme/${meme.slug}`);
  revalidatePath("/admin/memes");
  redirect(withQuery(back, `resultado=${result.ok ? "ok" : "erro"}`));
}

export async function hardDeleteMemeAction(form: FormData): Promise<void> {
  const user = await requireCap("content.hard_delete");
  const memeId = num(form, "meme_id") ?? 0;
  const { ipHash } = await clientFingerprint();
  hardDeleteMeme({ memeId, actorId: user.id, actorName: user.displayName, ipHash });
  revalidatePath("/admin/memes");
  revalidatePath("/memes");
  redirect("/admin/memes?excluido=1");
}

export async function moderateCommentAction(form: FormData): Promise<void> {
  const user = await requireCap("comment.moderate");
  const commentId = num(form, "comment_id") ?? 0;
  const status = str(form, "status", 20) as "visible" | "hidden" | "deleted";
  const back = safePath(str(form, "return_to", 300), "/admin/comentarios");
  if (!["visible", "hidden", "deleted"].includes(status)) redirect(back);
  const { ipHash } = await clientFingerprint();
  moderateComment({ commentId, actorId: user.id, actorName: user.displayName, status, ipHash });
  const row = get<{ slug: string }>(
    "SELECT m.slug FROM comments c JOIN memes m ON m.id = c.meme_id WHERE c.id = ?",
    commentId,
  );
  if (row) revalidatePath(`/meme/${row.slug}`);
  revalidatePath("/admin/comentarios");
  redirect(back);
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export async function userRoleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireCap("user.manage");
  const userId = num(form, "user_id") ?? 0;
  const role = str(form, "role", 20) as Role;
  if (role === "owner") {
    return fail("O papel OWNER só é transferido em /admin/permissoes.");
  }
  if (ROLE_RANK[role] >= ROLE_RANK.admin && !user.isOwner) {
    return fail("Somente o OWNER pode conceder papéis de administrador ou moderador sênior.");
  }
  const { ipHash } = await clientFingerprint();
  const result = setUserRole({
    userId,
    role,
    actorId: user.id,
    actorName: user.displayName,
    ipHash,
  });
  revalidatePath("/admin/usuarios");
  return result.ok ? done(result.message) : fail(result.message);
}

export async function userStatusAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const status = str(form, "status", 20) as UserStatus;
  const cap = status === "banned" ? "user.ban" : "user.suspend";
  const user = await requireCap(cap);
  const userId = num(form, "user_id") ?? 0;
  const reason = str(form, "reason", 500);
  if (status !== "active" && reason.trim().length < 5) {
    return fail("Informe o motivo. O usuário recebe esse texto.", { reason: "Descreva o motivo." });
  }
  const { ipHash } = await clientFingerprint();
  const result = setUserStatus({
    userId,
    status,
    reason,
    actorId: user.id,
    actorName: user.displayName,
    ipHash,
  });
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin");
  return result.ok ? done(result.message) : fail(result.message);
}

export async function transferOwnershipAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireCap("user.assign_role_owner");
  if (!user.isOwner) return fail("Apenas o OWNER atual pode transferir o papel.");

  const targetUsername = str(form, "target_username", 60).trim().toLowerCase();
  const password = str(form, "password", 200);
  const confirmation = str(form, "confirm", 40);

  if (confirmation !== "TRANSFERIR") {
    return fail('Digite exatamente "TRANSFERIR" para confirmar.', { confirm: "Texto de confirmação incorreto." });
  }
  const me = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", user.id);
  if (!me || !verifyPassword(password, me.password_hash)) {
    return fail("Senha incorreta.", { password: "Senha incorreta." });
  }
  const target = get<{ id: number; role: Role }>(
    "SELECT id, role FROM users WHERE username = ? AND status = 'active'",
    targetUsername,
  );
  if (!target) return fail("Usuário não encontrado ou inativo.", { target_username: "Usuário inválido." });
  if (target.id === user.id) return fail("Você já é o OWNER.");

  const { ipHash } = await clientFingerprint();
  tx(() => {
    run("UPDATE users SET is_owner = 0, role = 'admin' WHERE id = ?", user.id);
    run("UPDATE users SET is_owner = 1, role = 'owner' WHERE id = ?", target.id);
  });
  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: "owner.transferido",
    resourceType: "user",
    resourceId: target.id,
    meta: { de: user.username, para: targetUsername },
    ipHash,
  });
  revalidatePath("/admin/permissoes");
  return done(`O papel OWNER foi transferido para @${targetUsername}. Saia e entre novamente para carregar as novas permissões.`);
}

/* -------------------------------------------------------------------------- */
/* Taxonomy                                                                    */
/* -------------------------------------------------------------------------- */

export async function saveCategoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireCap("category.manage");
  const id = num(form, "id");
  const name = str(form, "name", 120).trim();
  const rawSlug = str(form, "slug", 120).trim();
  const description = str(form, "description", 400).trim();
  const group = str(form, "group_name", 60).trim() || "Geral";
  const sortOrder = num(form, "sort_order") ?? 100;

  if (name.length < 2) return fail("Informe o nome da categoria.", { name: "Nome muito curto." });
  const slug = slugify(rawSlug || name);
  const slugCheck = slugSchema().safeParse(slug);
  if (!slugCheck.success) return fail("Endereço inválido.", { slug: slugCheck.error.issues[0].message });

  const clash = get<{ id: number }>("SELECT id FROM categories WHERE slug = ?", slug);
  if (clash && clash.id !== id) return fail("Já existe uma categoria com este endereço.", { slug: "Endereço em uso." });

  if (id) {
    run(
      "UPDATE categories SET slug = ?, name = ?, description = ?, group_name = ?, sort_order = ? WHERE id = ?",
      slug,
      name,
      description,
      group,
      sortOrder,
      id,
    );
  } else {
    run(
      "INSERT INTO categories (slug, name, description, group_name, sort_order) VALUES (?, ?, ?, ?, ?)",
      slug,
      name,
      description,
      group,
      sortOrder,
    );
  }
  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: id ? "categoria.editada" : "categoria.criada",
    resourceType: "category",
    resourceId: id ?? slug,
    meta: { nome: name, slug },
  });
  revalidatePath("/admin/categorias");
  revalidatePath("/categorias");
  return done(id ? "Categoria atualizada." : "Categoria criada.");
}

export async function deleteCategoryAction(form: FormData): Promise<void> {
  const user = await requireCap("category.manage");
  const id = num(form, "category_id") ?? 0;
  const inUse = Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM memes WHERE category_id = ?", id)?.n ?? 0);
  if (inUse > 0) redirect("/admin/categorias?erro=em-uso");
  run("DELETE FROM categories WHERE id = ?", id);
  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: "categoria.excluida",
    resourceType: "category",
    resourceId: id,
  });
  revalidatePath("/admin/categorias");
  redirect("/admin/categorias?excluida=1");
}

export async function renameTagAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireCap("tag.manage");
  const tagId = num(form, "tag_id") ?? 0;
  const name = str(form, "name", 60).trim();
  if (name.length < 2) return fail("Informe o novo nome da tag.");
  const slug = slugify(name);
  const clash = get<{ id: number }>("SELECT id FROM tags WHERE slug = ?", slug);
  if (clash && clash.id !== tagId) {
    // Merge instead of duplicating: move relations, then drop the old tag.
    tx(() => {
      run("INSERT OR IGNORE INTO meme_tags (meme_id, tag_id) SELECT meme_id, ? FROM meme_tags WHERE tag_id = ?", clash.id, tagId);
      run("DELETE FROM meme_tags WHERE tag_id = ?", tagId);
      run("DELETE FROM tags WHERE id = ?", tagId);
      run(
        "UPDATE tags SET use_count = (SELECT COUNT(*) FROM meme_tags WHERE tag_id = ?) WHERE id = ?",
        clash.id,
        clash.id,
      );
    });
    for (const row of all<{ id: number }>(
      "SELECT meme_id AS id FROM meme_tags WHERE tag_id = ?",
      clash.id,
    )) {
      reindexMeme(row.id);
    }
    logAudit({
      actorId: user.id,
      actorName: user.displayName,
      action: "tag.mesclada",
      resourceType: "tag",
      resourceId: tagId,
      meta: { destino: slug },
    });
    revalidatePath("/admin/tags");
    return done(`Tags mescladas em "${name}".`);
  }
  run("UPDATE tags SET slug = ?, name = ? WHERE id = ?", slug, name, tagId);
  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: "tag.renomeada",
    resourceType: "tag",
    resourceId: tagId,
    meta: { nome: name, slug },
  });
  revalidatePath("/admin/tags");
  return done("Tag atualizada.");
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

export async function resolveReportAction(form: FormData): Promise<void> {
  const user = await requireCap("report.moderate");
  const reportId = num(form, "report_id") ?? 0;
  const status = str(form, "status", 20) === "dismissed" ? "dismissed" : "resolved";
  const note = str(form, "note", 1000);
  const { ipHash } = await clientFingerprint();
  resolveReport({
    reportId,
    resolverId: user.id,
    resolverName: user.displayName,
    status,
    note,
    ipHash,
  });
  const reporter = get<{ reporter_id: number | null }>("SELECT reporter_id FROM reports WHERE id = ?", reportId);
  if (reporter?.reporter_id) {
    notify({
      userId: reporter.reporter_id,
      kind: "report_resolved",
      title: "Sua denúncia foi analisada",
      body: note.slice(0, 200),
      url: "/notificacoes",
      actorId: user.id,
    });
  }
  revalidatePath("/admin/denuncias");
  redirect(`/admin/denuncias?resultado=${status}`);
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export async function saveSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireCap("settings.manage");
  const { ipHash } = await clientFingerprint();

  const changes: Record<string, string> = {};
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    if (typeof fallback === "boolean") {
      const value = bool(form, key) ? "true" : "false";
      saveSetting(key, value, user.id);
      changes[key] = value;
    } else if (typeof fallback === "number") {
      const value = num(form, key);
      const safe = value == null ? fallback : Math.max(1, Math.min(200, value));
      saveSetting(key, String(safe), user.id);
      changes[key] = String(safe);
    } else {
      const value = str(form, key, 200).trim();
      if (!value) continue;
      saveSetting(key, value, user.id);
      changes[key] = value;
    }
  }

  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: "configuracoes.alteradas",
    resourceType: "settings",
    resourceId: "global",
    meta: changes,
    ipHash,
  });
  revalidatePath("/admin/configuracoes");
  revalidatePath("/", "layout");
  return done("Configurações salvas.");
}
