"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clientFingerprint,
  getSettings,
  logAudit,
  rateLimit,
  requireCap,
  requireUser,
  solveChallenge,
} from "@/lib/auth";
import { bootstrap } from "@/lib/bootstrap";
import { get, run } from "@/lib/db";
import { bool, done, fail, num, str, type ActionState } from "@/lib/forms";
import { changedFields, currentSnapshot, readMemeSnapshot } from "@/lib/meme-form";
import {
  commitVersion,
  createMeme,
  findDuplicates,
  getMemeById,
  parseSnapshot,
  toggleFavorite,
  toggleFollow,
} from "@/lib/memes";
import {
  cancelContribution,
  createComment,
  createReport,
  createContribution,
  notifyModerators,
} from "@/lib/moderation";
import { PROTECTION_LABEL, type ProtectionLevel } from "@/lib/types";
import { canDirectEditOn, canProposeOn } from "@/lib/permissions";
import { kindFromMime, storeUpload } from "@/lib/uploads";

function safePath(value: string, fallback: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/** Append a query fragment to a path that may already carry one. */
function withQuery(path: string, query: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

/* -------------------------------------------------------------------------- */
/* Human check + rate limit, shared by the write paths                         */
/* -------------------------------------------------------------------------- */

async function guard(
  userId: number,
  role: string,
  action: string,
  form: FormData,
): Promise<ActionState | null> {
  const settings = getSettings();
  const { ipHash } = await clientFingerprint();

  const limit = rateLimit(`contrib:${userId}`, settings.contributionsPerHour, 60 * 60);
  if (!limit.ok) {
    return fail(
      `Você atingiu o limite de ${settings.contributionsPerHour} contribuições por hora. Tente novamente em ${Math.ceil(
        limit.retryAfter / 60,
      )} minuto(s). Esse limite existe para proteger a Memepedia contra vandalismo.`,
    );
  }
  if (limit.remaining === 0) {
    notifyModerators(
      "rate_limit",
      "Limite de contribuições atingido",
      `Um usuário alcançou o teto de contribuições por hora (${action}).`,
      "/admin/logs",
      userId,
    );
  }

  const needsChallenge =
    settings.requireCaptchaOnContribute && (role === "user" || role === "contributor");
  if (needsChallenge) {
    const challengeId = str(form, "challenge_id", 100);
    const answer = str(form, "challenge_answer", 20);
    if (!challengeId || !solveChallenge(challengeId, answer)) {
      return fail("Confirmação humana incorreta ou expirada. Recarregue a página e tente novamente.", {
        challenge_answer: "Resposta incorreta.",
      });
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* New meme                                                                    */
/* -------------------------------------------------------------------------- */

export async function submitNewMemeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  bootstrap();
  const user = await requireUser("/contribuir/novo");

  const gate = await guard(user.id, user.role, "novo meme", form);
  if (gate) return gate;

  const { snapshot, errors } = readMemeSnapshot(form);
  if (!snapshot) return fail("Corrija os campos destacados antes de enviar.", errors);

  const confirmedDistinct = bool(form, "confirmed_distinct");
  if (!confirmedDistinct) {
    const duplicates = findDuplicates(snapshot.name, snapshot.short_description, 5);
    if (duplicates.length) {
      return {
        ok: false,
        message: "Talvez esse meme já exista.",
        duplicates: duplicates.map((d) => ({
          slug: d.slug,
          name: d.name,
          relevance: d.relevance,
          description: d.short_description,
        })),
      };
    }
  }

  const categoryId = snapshot.category_id;
  const categorySlug =
    categoryId == null
      ? ""
      : (get<{ slug: string }>("SELECT slug FROM categories WHERE id = ?", categoryId)?.slug ?? "");

  const media = form.get("media");
  let mediaInfo: Record<string, unknown> | null = null;
  if (media && typeof media === "object" && "size" in media && (media as File).size > 0) {
    const stored = await storeUpload(media as File);
    if (!stored.ok) return fail(stored.error, { media: stored.error });
    const thumbFile = form.get("media_thumb");
    let thumbUrl: string | null = null;
    if (thumbFile && typeof thumbFile === "object" && "size" in thumbFile && (thumbFile as File).size > 0) {
      const thumbStored = await storeUpload(thumbFile as File);
      if (thumbStored.ok) thumbUrl = thumbStored.file.url;
    }
    mediaInfo = {
      url: stored.file.url,
      thumbUrl,
      kind: kindFromMime(stored.file.mime),
      mime: stored.file.mime,
      bytes: stored.file.bytes,
      width: stored.file.width,
      height: stored.file.height,
    };
  }

  const payload = { ...snapshot, category_slug: categorySlug, media: mediaInfo };

  // Moderators and above can publish immediately; everyone else queues.
  if (form.get("publish_direct") && canDirectEditOn(user.role, "free")) {
    const memeId = createMeme({
      snapshot,
      actorId: user.id,
      status: "published",
      reason: str(form, "reason", 400) || "Criação direta por membro da equipe",
      source: "direct",
      media: mediaInfo as never,
    });
    run("UPDATE profiles SET contributions_total = contributions_total + 1 WHERE user_id = ?", user.id);
    logAudit({
      actorId: user.id,
      actorName: user.displayName,
      action: "meme.criado_direto",
      resourceType: "meme",
      resourceId: memeId,
      meta: { nome: snapshot.name },
    });
    const created = get<{ slug: string }>("SELECT slug FROM memes WHERE id = ?", memeId);
    redirect(`/meme/${created?.slug ?? ""}?novo=1`);
  }

  const result = createContribution({
    kind: "new_meme",
    targetName: snapshot.name,
    title: `Novo meme: ${snapshot.name}`,
    note: str(form, "submission_note", 1000),
    payload,
    changes: Object.entries(snapshot)
      .filter(([, value]) => value !== "" && value !== null && !(Array.isArray(value) && !value.length))
      .map(([field, value]) => ({
        field,
        oldValue: "",
        newValue: Array.isArray(value) ? value.join(", ") : String(value),
      })),
    userId: user.id,
    ipHash: (await clientFingerprint()).ipHash,
  });

  run("UPDATE profiles SET contributions_total = contributions_total + 1 WHERE user_id = ?", user.id);
  notifyModerators(
    "contribution_new",
    `Novo meme sugerido: ${snapshot.name}`,
    `Enviado por ${user.displayName}. Triagem automática: ${result.triage.level} (${result.triage.score}/100).`,
    "/admin/revisao",
    user.id,
  );
  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: "contribuicao.enviada",
    resourceType: "contribution",
    resourceId: result.id,
    meta: { tipo: "new_meme", nome: snapshot.name, risco: result.triage.score },
  });

  revalidatePath("/contribuicoes");
  revalidatePath("/admin/revisao");
  return {
    ...done("Sua contribuição foi enviada para revisão."),
    queued: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Correction / direct edit                                                    */
/* -------------------------------------------------------------------------- */

export async function submitCorrectionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  bootstrap();
  const memeId = num(form, "meme_id") ?? 0;
  const meme = getMemeById(memeId);
  if (!meme || meme.status === "deleted") return fail("Meme não encontrado.");

  const user = await requireUser(`/meme/${meme.slug}/sugerir`);
  const protection = meme.protection as ProtectionLevel;

  if (!canProposeOn(user.role, protection)) {
    return fail(
      `Esta página está com proteção "${PROTECTION_LABEL[protection]}" e não aceita sugestões do seu nível de acesso.`,
    );
  }

  const gate = await guard(user.id, user.role, "correção", form);
  if (gate) return gate;

  const { snapshot, errors } = readMemeSnapshot(form);
  if (!snapshot) return fail("Corrija os campos destacados antes de enviar.", errors);

  const before = currentSnapshot(memeId);
  if (!before) return fail("Não foi possível ler a versão atual da página.");

  const changes = changedFields(before, snapshot);
  if (!changes.length) {
    return fail("Nenhuma alteração foi detectada. Edite pelo menos um campo antes de enviar.");
  }

  const note = str(form, "note", 1000);
  if (note.trim().length < 5) {
    return fail("Explique brevemente a alteração: isso ajuda quem revisa.", {
      note: "Descreva o motivo da alteração.",
    });
  }

  const wantsDirect = bool(form, "publish_direct") && canDirectEditOn(user.role, protection);
  if (wantsDirect) {
    const versionId = commitVersion({
      memeId,
      snapshot,
      actorId: user.id,
      reason: note,
      source: "direct",
    });
    logAudit({
      actorId: user.id,
      actorName: user.displayName,
      action: "meme.editado_direto",
      resourceType: "meme",
      resourceId: memeId,
      meta: { versao: versionId, campos: changes.map((c) => c.field) },
    });
    revalidatePath(`/meme/${meme.slug}`);
    revalidatePath(`/historico/${meme.slug}`);
    redirect(`/meme/${meme.slug}?editado=1`);
  }

  const contribution = createContribution({
    kind: "correction",
    memeId,
    targetName: meme.name,
    title: `Correção em ${meme.name}`,
    note,
    payload: { ...snapshot } as Record<string, unknown>,
    changes,
    userId: user.id,
    ipHash: (await clientFingerprint()).ipHash,
  });

  run("UPDATE profiles SET contributions_total = contributions_total + 1 WHERE user_id = ?", user.id);
  notifyModerators(
    "contribution_correction",
    `Correção sugerida em ${meme.name}`,
    `${changes.length} campo(s) alterado(s) por ${user.displayName}.`,
    "/admin/revisao",
    user.id,
  );
  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: "contribuicao.correcao_enviada",
    resourceType: "contribution",
    resourceId: contribution.id,
    meta: { meme: meme.name, campos: changes.map((c) => c.field) },
  });

  revalidatePath(`/meme/${meme.slug}`);
  revalidatePath("/contribuicoes");
  return { ...done("Sua sugestão de correção foi enviada para revisão."), queued: true };
}

/* -------------------------------------------------------------------------- */
/* Revert                                                                      */
/* -------------------------------------------------------------------------- */

export async function revertVersionAction(form: FormData): Promise<void> {
  const user = await requireCap("meme.revert");
  const versionId = num(form, "version_id") ?? 0;
  const back = safePath(str(form, "return_to", 300), "/");

  const version = get<{ meme_id: number; snapshot: string; version_no: number }>(
    "SELECT meme_id, snapshot, version_no FROM meme_versions WHERE id = ?",
    versionId,
  );
  if (!version) redirect(withQuery(back, "erro=versao"));

  const target = get<{ slug: string; name: string; status: string }>(
    "SELECT slug, name, status FROM memes WHERE id = ?",
    version.meme_id,
  );
  if (!target) redirect(withQuery(back, "erro=meme"));

  const snapshot = parseSnapshot(version.snapshot);
  const { ipHash } = await clientFingerprint();
  const newVersionId = commitVersion({
    memeId: version.meme_id,
    snapshot,
    actorId: user.id,
    reason: `Restauração da versão ${version.version_no} por ${user.displayName}`,
    source: "revert",
    restoredFrom: versionId,
  });

  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: "meme.revertido",
    resourceType: "meme",
    resourceId: version.meme_id,
    meta: { versao_restaurada: version.version_no, nova_versao_id: newVersionId },
    ipHash,
  });

  revalidatePath(`/meme/${target.slug}`);
  revalidatePath(`/historico/${target.slug}`);
  redirect(`/historico/${target.slug}?restaurada=${version.version_no}`);
}

/* -------------------------------------------------------------------------- */
/* Follow / favorite                                                          */
/* -------------------------------------------------------------------------- */

export async function toggleFollowAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const memeId = num(form, "meme_id") ?? 0;
  const back = safePath(str(form, "return_to", 300), "/");
  if (!memeId) redirect(back);
  toggleFollow(user.id, memeId);
  revalidatePath(back);
  redirect(back);
}

export async function toggleFavoriteAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const memeId = num(form, "meme_id") ?? 0;
  const back = safePath(str(form, "return_to", 300), "/favoritos");
  if (!memeId) redirect(back);
  toggleFavorite(user.id, memeId);
  revalidatePath(back);
  redirect(back);
}

/* -------------------------------------------------------------------------- */
/* Comments                                                                    */
/* -------------------------------------------------------------------------- */

export async function addCommentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const memeId = num(form, "meme_id") ?? 0;
  const meme = get<{ slug: string; comments_enabled: number; status: string }>(
    "SELECT slug, comments_enabled, status FROM memes WHERE id = ?",
    memeId,
  );
  if (!meme) return fail("Meme não encontrado.");
  const settings = getSettings();
  if (!settings.commentsEnabled || !meme.comments_enabled) {
    return fail("Os comentários estão desativados nesta página.");
  }

  const user = await requireUser();
  const { ipHash } = await clientFingerprint();
  const limit = rateLimit(`comment:${user.id}`, settings.commentsPerHour, 60 * 60);
  if (!limit.ok) {
    return fail(`Você comentou muito rápido. Aguarde ${Math.ceil(limit.retryAfter / 60)} minuto(s).`);
  }
  const flood = rateLimit(`comment:burst:${user.id}`, 3, 60);
  if (!flood.ok) {
    return fail("Você enviou três comentários no último minuto. Aguarde um pouco antes de continuar.");
  }

  const parentRaw = num(form, "parent_id");
  const result = createComment({
    memeId,
    parentId: parentRaw && parentRaw > 0 ? parentRaw : null,
    userId: user.id,
    body: str(form, "body", 1500),
    ipHash,
  });
  if (!result.ok) return fail(result.message);
  revalidatePath(`/meme/${meme.slug}`);
  return done(result.message);
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

export async function reportContentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const targetType = str(form, "target_type", 20) as "meme" | "comment" | "user" | "media";
  const targetId = num(form, "target_id") ?? 0;
  const reason = str(form, "reason", 40);
  const details = str(form, "details", 2000);

  if (!["meme", "comment", "user", "media"].includes(targetType)) return fail("Alvo inválido.");
  if (!targetId) return fail("Alvo inválido.");
  if (!reason) return fail("Selecione um motivo para a denúncia.");
  if (details.trim().length < 10) {
    return fail("Descreva o problema com um pouco mais de detalhe.", {
      details: "Explique o que está errado nesta página.",
    });
  }

  const { ipHash } = await clientFingerprint();
  const limit = rateLimit(`report:${user.id}`, 10, 24 * 60 * 60);
  if (!limit.ok) return fail("Limite de denúncias por dia atingido.");

  const result = createReport({
    targetType,
    targetId,
    reporterId: user.id,
    reason,
    details,
    ipHash,
  });
  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: "denuncia.criada",
    resourceType: targetType,
    resourceId: targetId,
    meta: { motivo: reason },
    ipHash,
  });
  return result.ok ? done(result.message) : fail(result.message);
}

/* -------------------------------------------------------------------------- */
/* Media management                                                            */
/* -------------------------------------------------------------------------- */

export async function saveMediaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireCap("meme.manage_media");
  const memeId = num(form, "meme_id") ?? 0;
  const meme = get<{ slug: string; name: string }>("SELECT slug, name FROM memes WHERE id = ?", memeId);
  if (!meme) return fail("Meme não encontrado.");

  const media = form.get("media");
  if (!media || typeof media !== "object" || !("size" in media) || (media as File).size === 0) {
    return fail("Selecione um arquivo de imagem.", { media: "Nenhum arquivo selecionado." });
  }
  const stored = await storeUpload(media as File);
  if (!stored.ok) return fail(stored.error, { media: stored.error });

  const thumbFile = form.get("media_thumb");
  let thumbUrl: string | null = null;
  if (thumbFile && typeof thumbFile === "object" && "size" in thumbFile && (thumbFile as File).size > 0) {
    const thumbStored = await storeUpload(thumbFile as File);
    if (thumbStored.ok) thumbUrl = thumbStored.file.url;
  }

  const mode = str(form, "mode", 20) || "primary";
  if (mode === "primary") {
    run("UPDATE meme_media SET is_primary = 0 WHERE meme_id = ?", memeId);
    const existing = get<{ id: number }>(
      "SELECT id FROM meme_media WHERE meme_id = ? AND position = 0",
      memeId,
    );
    if (existing) {
      run(
        `UPDATE meme_media SET url = ?, thumb_url = ?, mime = ?, bytes = ?, width = ?, height = ?,
            kind = ?, is_primary = 1, is_placeholder = 0 WHERE id = ?`,
        stored.file.url,
        thumbUrl,
        stored.file.mime,
        stored.file.bytes,
        stored.file.width,
        stored.file.height,
        kindFromMime(stored.file.mime),
        existing.id,
      );
    } else {
      run(
        `INSERT INTO meme_media (meme_id, kind, url, thumb_url, alt, mime, bytes, width, height,
            is_primary, position, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
        memeId,
        kindFromMime(stored.file.mime),
        stored.file.url,
        thumbUrl,
        meme.name,
        stored.file.mime,
        stored.file.bytes,
        stored.file.width,
        stored.file.height,
        user.id,
      );
    }
  } else {
    const nextPosition =
      (Number(get<{ n: number }>("SELECT COALESCE(MAX(position), -1) + 1 AS n FROM meme_media WHERE meme_id = ?", memeId)?.n) ?? 0);
    run(
      `INSERT INTO meme_media (meme_id, kind, url, thumb_url, alt, caption, mime, bytes, width, height,
          is_primary, position, source_url, author, license, rights_notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      memeId,
      kindFromMime(stored.file.mime),
      stored.file.url,
      thumbUrl,
      str(form, "alt", 200) || meme.name,
      str(form, "caption", 300),
      stored.file.mime,
      stored.file.bytes,
      stored.file.width,
      stored.file.height,
      nextPosition,
      str(form, "source_url", 400),
      str(form, "author", 200),
      str(form, "license", 120),
      str(form, "rights_notes", 500),
      user.id,
    );
  }

  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: "meme.midia_atualizada",
    resourceType: "meme",
    resourceId: memeId,
    meta: { meme: meme.name, modo: mode },
  });

  revalidatePath(`/meme/${meme.slug}`);
  revalidatePath("/admin/memes");
  return done("Mídia atualizada.");
}

export async function updateMediaRightsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireCap("meme.manage_media");
  const mediaId = num(form, "media_id") ?? 0;
  const row = get<{ meme_id: number; slug: string }>(
    "SELECT md.meme_id, m.slug FROM meme_media md JOIN memes m ON m.id = md.meme_id WHERE md.id = ?",
    mediaId,
  );
  if (!row) return fail("Mídia não encontrada.");
  run(
    `UPDATE meme_media SET source_url = ?, author = ?, license = ?, rights_notes = ?, caption = ?, alt = ?
      WHERE id = ?`,
    str(form, "source_url", 400),
    str(form, "author", 200),
    str(form, "license", 120),
    str(form, "rights_notes", 500),
    str(form, "caption", 300),
    str(form, "alt", 200),
    mediaId,
  );
  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: "meme.midia_direitos_atualizados",
    resourceType: "media",
    resourceId: mediaId,
  });
  revalidatePath(`/meme/${row.slug}`);
  return done("Informações de direitos atualizadas.");
}

export async function deleteMediaAction(form: FormData): Promise<void> {
  const user = await requireCap("meme.manage_media");
  const mediaId = num(form, "media_id") ?? 0;
  const back = safePath(str(form, "return_to", 300), "/admin/memes");
  const row = get<{ meme_id: number; is_primary: number; slug: string }>(
    "SELECT md.meme_id, md.is_primary, m.slug FROM meme_media md JOIN memes m ON m.id = md.meme_id WHERE md.id = ?",
    mediaId,
  );
  if (row && row.is_primary === 0) {
    run("DELETE FROM meme_media WHERE id = ?", mediaId);
    logAudit({
      actorId: user.id,
      actorName: user.displayName,
      action: "meme.midia_removida",
      resourceType: "media",
      resourceId: mediaId,
    });
    revalidatePath(`/meme/${row.slug}`);
  }
  redirect(back);
}

/* -------------------------------------------------------------------------- */
/* Submission note on a page (requirement 11)                                  */
/* -------------------------------------------------------------------------- */

export async function addInformationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  bootstrap();
  const memeId = num(form, "meme_id") ?? 0;
  const meme = getMemeById(memeId);
  if (!meme) return fail("Meme não encontrado.");
  const user = await requireUser(`/meme/${meme.slug}`);

  const field = str(form, "field", 40);
  const value = str(form, "value", 5000).trim();
  if (!value || value.length < 5) {
    return fail("Escreva a informação que você quer adicionar.", { value: "Texto muito curto." });
  }
  if (!/^[a-z_]+$/.test(field)) return fail("Campo inválido.");

  const before = currentSnapshot(memeId);
  if (!before) return fail("Não foi possível ler a versão atual da página.");
  const after = { ...before, [field]: value };

  const contribution = createContribution({
    kind: "correction",
    memeId,
    targetName: meme.name,
    title: `Nova informação em ${meme.name}`,
    note: str(form, "note", 1000) || "Informação adicional enviada pelo formulário rápido.",
    payload: { ...after } as Record<string, unknown>,
    changes: [{ field, oldValue: String((before as unknown as Record<string, unknown>)[field] ?? ""), newValue: value }],
    userId: user.id,
    ipHash: (await clientFingerprint()).ipHash,
  });

  run("UPDATE profiles SET contributions_total = contributions_total + 1 WHERE user_id = ?", user.id);
  notifyModerators(
    "contribution_add_info",
    `Nova informação em ${meme.name}`,
    `${user.displayName} adicionou conteúdo ao campo "${field}".`,
    "/admin/revisao",
    user.id,
  );
  logAudit({
    actorId: user.id,
    actorName: user.displayName,
    action: "contribuicao.informacao_enviada",
    resourceType: "contribution",
    resourceId: contribution.id,
    meta: { meme: meme.name, campo: field },
  });
  revalidatePath(`/meme/${meme.slug}`);
  return { ...done("Informação enviada para revisão. Obrigado!"), queued: true };
}

export async function cancelContributionAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const contributionId = num(form, "contribution_id") ?? 0;
  cancelContribution(contributionId, user.id);
  revalidatePath("/contribuicoes");
  redirect("/contribuicoes?cancelada=1");
}
