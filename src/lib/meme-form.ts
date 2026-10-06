import { get } from "./db";
import { num, str, trimmed } from "./forms";
import { getMemeById, normalizeTags, snapshotOf, type MemeSnapshot } from "./memes";
import { MEME_FIELDS } from "./types";

export interface ReadResult {
  snapshot: MemeSnapshot | null;
  errors: Record<string, string>;
}

const MAX_FIELD = 20000;

/**
 * Reads and validates every content field from a form. All write paths (new
 * meme, direct edit, correction proposal) go through this, so validation rules
 * can never drift between them.
 */
export function readMemeSnapshot(form: FormData): ReadResult {
  const errors: Record<string, string> = {};

  const name = trimmed(form, "name", 200);
  if (name.length < 2) errors.name = "Informe o nome do meme.";
  if (name.length > 120) errors.name = "O nome deve ter no máximo 120 caracteres.";

  const shortDescription = trimmed(form, "short_description", 600);
  if (shortDescription.length < 20) {
    errors.short_description = "Escreva uma descrição de pelo menos 20 caracteres.";
  } else if (shortDescription.length > 400) {
    errors.short_description = "A descrição curta deve ter no máximo 400 caracteres.";
  }

  const approxYear = num(form, "approx_year");
  if (approxYear !== null && (approxYear < 1900 || approxYear > 2100)) {
    errors.approx_year = "Informe um ano entre 1900 e 2100, ou deixe em branco.";
  }

  const categoryId = num(form, "category_id");
  if (categoryId !== null && !get("SELECT 1 FROM categories WHERE id = ?", categoryId)) {
    errors.category_id = "Categoria inválida.";
  }

  const longKeys = ["origin", "history", "usage_notes", "characteristics", "variations", "trivia", "sources"] as const;
  for (const key of longKeys) {
    if (str(form, key, MAX_FIELD + 1).length > MAX_FIELD) {
      errors[key] = "Texto muito longo para este campo.";
    }
  }

  const tagsRaw = str(form, "tags", 500);
  const tags = normalizeTags(tagsRaw);
  if (tags.length === 0) {
    // Tags are encouraged, not mandatory; noted rather than blocking.
  }

  if (Object.keys(errors).length) return { snapshot: null, errors };

  return {
    snapshot: {
      name,
      short_description: shortDescription,
      origin: str(form, "origin", MAX_FIELD).trim(),
      history: str(form, "history", MAX_FIELD).trim(),
      usage_notes: str(form, "usage_notes", MAX_FIELD).trim(),
      characteristics: str(form, "characteristics", MAX_FIELD).trim(),
      variations: str(form, "variations", MAX_FIELD).trim(),
      trivia: str(form, "trivia", MAX_FIELD).trim(),
      sources: str(form, "sources", MAX_FIELD).trim(),
      approx_year: approxYear,
      approx_period: trimmed(form, "approx_period", 120),
      country: trimmed(form, "country", 120),
      region: trimmed(form, "region", 160),
      category_id: categoryId,
      tags,
    },
    errors: {},
  };
}

/** Only the fields that actually differ, used to keep correction diffs short. */
export function changedFields(
  before: MemeSnapshot,
  after: MemeSnapshot,
): { field: string; oldValue: string; newValue: string }[] {
  const out: { field: string; oldValue: string; newValue: string }[] = [];
  for (const field of MEME_FIELDS) {
    const key = field.key;
    const a = before[key as keyof MemeSnapshot];
    const b = after[key as keyof MemeSnapshot];
    const sa = a == null ? "" : String(a);
    const sb = b == null ? "" : String(b);
    if (key === "approx_year" || key === "category_id") {
      if ((a ?? null) !== (b ?? null)) out.push({ field: key, oldValue: sa, newValue: sb });
    } else if (sa !== sb) {
      out.push({ field: key, oldValue: sa, newValue: sb });
    }
  }
  return out;
}

/** Snapshot of the live page, used as the "old value" side of a correction. */
export function currentSnapshot(memeId: number): MemeSnapshot | null {
  return snapshotOf(memeId);
}

export function memePath(slug: string): string {
  return `/meme/${slug}`;
}

export function safeMeme(memeId: number) {
  return getMemeById(memeId);
}
