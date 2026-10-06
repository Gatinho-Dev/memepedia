"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import {
  clientFingerprint,
  createSession,
  currentUser,
  logAudit,
  passwordProblems,
  rateLimit,
  setSessionCookie,
  verifyPassword,
  hashPassword,
  consumeToken,
  issueToken,
  readSessionToken,
} from "@/lib/auth";
import { bootstrap } from "@/lib/bootstrap";
import { get, run, tx, reindexUser } from "@/lib/db";
import {
  bool,
  done,
  emailSchema,
  fail,
  str,
  displayNameSchema,
  usernameSchema,
  type ActionState,
} from "@/lib/forms";
import { getSettings } from "@/lib/auth";
import type { Role } from "@/lib/types";

const COOKIE = "mp_session";

export async function signInAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  bootstrap();
  const identifier = str(form, "identifier", 200).trim().toLowerCase();
  const password = str(form, "password", 200);
  const next = str(form, "next", 300);

  if (!identifier || !password) {
    return fail("Preencha e-mail/usuário e senha.");
  }

  const { ipHash, userAgent } = await clientFingerprint();
  const limit = rateLimit(`login:${ipHash}`, 10, 15 * 60);
  if (!limit.ok) {
    return fail(
      `Muitas tentativas de login. Tente novamente em ${Math.ceil(limit.retryAfter / 60)} minuto(s).`,
    );
  }

  const user = get<{
    id: number;
    password_hash: string;
    status: string;
    role: Role;
    username: string;
    display_name: string;
  }>(
    "SELECT id, password_hash, status, role, username, display_name FROM users WHERE email = ? OR username = ?",
    identifier,
    identifier,
  );

  if (!user || !verifyPassword(password, user.password_hash)) {
    logAudit({
      actorName: identifier,
      action: "login.falha",
      resourceType: "user",
      resourceId: identifier,
      result: "negado",
      ipHash,
    });
    return fail("Credenciais inválidas.");
  }
  if (user.status === "banned") {
    return fail("Esta conta foi banida. Entre em contato com a administração.");
  }
  if (user.status === "suspended") {
    return fail("Esta conta está suspensa temporariamente.");
  }

  const token = createSession(user.id, { ipHash, userAgent });
  const jar = await cookies();
  jar.set(setSessionCookie(token));
  run(
    "UPDATE users SET last_login_at = datetime('now'), last_seen_at = datetime('now') WHERE id = ?",
    user.id,
  );
  logAudit({
    actorId: user.id,
    actorName: user.display_name,
    action: "login.sucesso",
    resourceType: "user",
    resourceId: user.id,
    ipHash,
  });

  redirect(next && next.startsWith("/") ? next : "/");
}

export async function signUpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  bootstrap();
  const settings = getSettings();
  if (!settings.registrationOpen) {
    return fail("O cadastro está temporariamente fechado pela administração.");
  }

  const rawUsername = str(form, "username", 80).trim().toLowerCase();
  const rawEmail = str(form, "email", 200).trim().toLowerCase();
  const displayName = str(form, "display_name", 120).trim();
  const password = str(form, "password", 200);
  const confirm = str(form, "password_confirm", 200);
  const accept = bool(form, "terms");

  const errors: Record<string, string> = {};
  const usernameCheck = usernameSchema.safeParse(rawUsername);
  if (!usernameCheck.success) errors.username = usernameCheck.error.issues[0].message;
  const emailCheck = emailSchema.safeParse(rawEmail);
  if (!emailCheck.success) errors.email = emailCheck.error.issues[0].message;
  const nameCheck = displayNameSchema.safeParse(displayName);
  if (!nameCheck.success) errors.display_name = nameCheck.error.issues[0].message;
  const pwProblem = passwordProblems(password);
  if (pwProblem) errors.password = pwProblem;
  if (password !== confirm) errors.password_confirm = "As senhas não coincidem.";
  if (!accept) errors.terms = "É necessário aceitar o código de conduta e a política de conteúdo.";
  if (Object.keys(errors).length) return fail("Corrija os campos destacados.", errors);

  const { ipHash, userAgent } = await clientFingerprint();
  const limit = rateLimit(`signup:${ipHash}`, 4, 60 * 60);
  if (!limit.ok) return fail("Muitos cadastros deste endereço. Tente novamente mais tarde.");

  const taken = get<{ username: string; email: string }>(
    "SELECT username, email FROM users WHERE username = ? OR email = ?",
    rawUsername,
    rawEmail,
  );
  if (taken) {
    return fail("Já existe uma conta com esses dados.", {
      username: taken.username === rawUsername ? "Este nome de usuário já está em uso." : "",
      email: taken.email === rawEmail ? "Este e-mail já está cadastrado." : "",
    });
  }

  let userId = 0;
  tx(() => {
    const res = run(
      `INSERT INTO users (username, email, password_hash, display_name, role, email_verified)
       VALUES (?, ?, ?, ?, ?, 0)`,
      rawUsername,
      rawEmail,
      hashPassword(password),
      displayName,
      settings.requireReviewForNewUsers ? "user" : "contributor",
    );
    userId = Number(res.lastInsertRowid);
    run("INSERT INTO profiles (user_id) VALUES (?)", userId);
    reindexUser(userId);
  });

  logAudit({
    actorId: userId,
    actorName: displayName,
    action: "conta.criada",
    resourceType: "user",
    resourceId: userId,
    ipHash,
  });

  if (settings.registrationRequiresEmail) {
    issueToken(userId, "verify_email", 48);
  }

  const token = createSession(userId, { ipHash, userAgent });
  const jar = await cookies();
  jar.set(setSessionCookie(token));
  redirect("/contribuicoes?bemvindo=1");
}

export async function signOutAction() {
  const token = await readSessionToken();
  if (token) {
    const hashed = createHash("sha256").update(token).digest("hex");
    const row = get<{ user_id: number }>("SELECT user_id FROM sessions WHERE id = ?", hashed);
    run("DELETE FROM sessions WHERE id = ?", hashed);
    if (row) {
      logAudit({ actorId: row.user_id, action: "login.saida", resourceType: "user", resourceId: row.user_id });
    }
  }
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect("/");
}

export async function updateProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return fail("Faça login para continuar.");

  const displayName = str(form, "display_name", 120).trim();
  const bio = str(form, "bio", 600).trim();
  const location = str(form, "location", 120).trim();
  const website = str(form, "website", 200).trim();

  const errors: Record<string, string> = {};
  const nameCheck = displayNameSchema.safeParse(displayName);
  if (!nameCheck.success) errors.display_name = nameCheck.error.issues[0].message;
  if (website && !/^https?:\/\//i.test(website)) {
    errors.website = "O endereço precisa começar com http:// ou https://";
  }
  if (Object.keys(errors).length) return fail("Corrija os campos destacados.", errors);

  tx(() => {
    run(
      "UPDATE users SET display_name = ?, last_seen_at = datetime('now') WHERE id = ?",
      displayName,
      user.id,
    );
    run("UPDATE profiles SET bio = ?, location = ?, website = ? WHERE user_id = ?", bio, location, website, user.id);
  });
  reindexUser(user.id);

  const avatarChoice = str(form, "avatar_choice", 20);
  if (avatarChoice === "remover") {
    run("UPDATE users SET avatar_url = NULL WHERE id = ?", user.id);
  }

  revalidatePath(`/perfil/${user.username}`);
  revalidatePath("/perfil");
  return done("Perfil atualizado.");
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return fail("Faça login para continuar.");
  const current = str(form, "current_password", 200);
  const next = str(form, "new_password", 200);
  const confirm = str(form, "new_password_confirm", 200);

  const row = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", user.id);
  if (!row || !verifyPassword(current, row.password_hash)) {
    return fail("A senha atual está incorreta.", { current_password: "Senha atual incorreta." });
  }
  const problem = passwordProblems(next);
  if (problem) return fail("A nova senha não atende aos requisitos.", { new_password: problem });
  if (next !== confirm) return fail("As senhas não coincidem.", { new_password_confirm: "As senhas não coincidem." });

  run(
    "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
    hashPassword(next),
    user.id,
  );
  run("DELETE FROM sessions WHERE user_id = ?", user.id);
  const { ipHash, userAgent } = await clientFingerprint();
  const token = createSession(user.id, { ipHash, userAgent });
  const jar = await cookies();
  jar.set(setSessionCookie(token));

  logAudit({ actorId: user.id, actorName: user.displayName, action: "senha.alterada", resourceType: "user", resourceId: user.id, ipHash });
  return done("Senha alterada. Todas as outras sessões foram encerradas.");
}

export async function requestPasswordResetAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = str(form, "email", 200).trim().toLowerCase();
  const { ipHash } = await clientFingerprint();
  const limit = rateLimit(`reset:${ipHash}`, 5, 60 * 60);
  if (!limit.ok) return fail("Muitas solicitações. Tente novamente mais tarde.");

  const user = get<{ id: number }>("SELECT id FROM users WHERE email = ?", email);
  if (user) {
    const token = issueToken(user.id, "reset_password", 2);
    logAudit({ actorId: user.id, action: "senha.redefinicao_solicitada", resourceType: "user", resourceId: user.id, ipHash });
    // Without a mail provider configured the token is surfaced to the operator
    // through the audit log instead of being silently dropped.
    if (process.env.MEMEPEDIA_EXPOSE_RESET === "1") {
      return done(`Link de redefinição: /redefinir-senha?token=${token}`);
    }
  }
  return done("Se este e-mail estiver cadastrado, enviaremos as instruções de redefinição.");
}

export async function resetPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const token = str(form, "token", 200);
  const password = str(form, "password", 200);
  const confirm = str(form, "password_confirm", 200);
  if (password !== confirm) return fail("As senhas não coincidem.");
  const problem = passwordProblems(password);
  if (problem) return fail(problem);

  const userId = consumeToken(token, "reset_password");
  if (!userId) return fail("Link inválido ou expirado. Solicite um novo.");

  run("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?", hashPassword(password), userId);
  run("DELETE FROM sessions WHERE user_id = ?", userId);
  logAudit({ actorId: userId, action: "senha.redefinida", resourceType: "user", resourceId: userId });
  redirect("/entrar?redefinida=1");
}

export async function updatePreferencesAction(theme: string) {
  const user = await currentUser();
  if (!user) return;
  const clean = theme === "dark" || theme === "light" || theme === "system" ? theme : "system";
  run("UPDATE profiles SET theme = ? WHERE user_id = ?", clean, user.id);
}

export async function markNotificationsReadAction() {
  const user = await currentUser();
  if (!user) return;
  run("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL", user.id);
  revalidatePath("/notificacoes");
}
