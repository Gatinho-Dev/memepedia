import { z } from "zod";

/** Shared result shape for every server action driving a form. */
export interface DuplicateWarning {
  slug: string;
  name: string;
  relevance: number;
  description: string;
}

export interface ActionState {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
  /** Bumped on success so the client can reset a form or close a dialog. */
  stamp?: number;
  /** Set when the duplicate check wants confirmation before submitting. */
  duplicates?: DuplicateWarning[];
  /** Set when a submission succeeded but awaits review. */
  queued?: boolean;
}

export const emptyAction: ActionState = { ok: false, message: "" };

export function fail(message: string, errors?: Record<string, string>): ActionState {
  return { ok: false, message, errors };
}

export function done(message: string): ActionState {
  return { ok: true, message, stamp: Date.now() };
}

/* -------------------------------------------------------------------------- */
/* FormData readers                                                            */
/* -------------------------------------------------------------------------- */

export function str(form: FormData, key: string, max = 20000): string {
  const value = form.get(key);
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

export function trimmed(form: FormData, key: string, max = 20000): string {
  return str(form, key, max).trim();
}

export function num(form: FormData, key: string): number | null {
  const raw = str(form, key, 20).trim();
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function bool(form: FormData, key: string): boolean {
  const value = form.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function list(form: FormData, key: string): string[] {
  return form.getAll(key).map((v) => String(v));
}

export function file(form: FormData, key: string): File | null {
  const value = form.get(key);
  if (value && typeof value === "object" && "arrayBuffer" in value && "size" in value) {
    const f = value as File;
    return f.size > 0 ? f : null;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Validation helpers                                                          */
/* -------------------------------------------------------------------------- */

export const usernameSchema = z
  .string()
  .min(3, "Use pelo menos 3 caracteres.")
  .max(32, "Máximo de 32 caracteres.")
  .regex(/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/, "Use apenas letras minúsculas, números, ponto, hífen ou sublinhado.");

export const emailSchema = z.string().email("Informe um e-mail válido.").max(200);

export const displayNameSchema = z
  .string()
  .min(2, "Informe como você quer ser chamado.")
  .max(80, "Máximo de 80 caracteres.");

export function slugSchema(max = 80) {
  return z
    .string()
    .min(2, "Endereço muito curto.")
    .max(max, `Máximo de ${max} caracteres.`)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífen.");
}

/** Turn a ZodError into the field-keyed map the forms render inline. */
export function zodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
