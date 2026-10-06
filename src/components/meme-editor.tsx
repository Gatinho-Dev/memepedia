"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "./icons";
import { RichText } from "./rich-text";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Field,
  Input,
  Panel,
  Select,
  Textarea,
  Checkbox,
  cn,
} from "./ui";
import { MediaPicker, SubmitButton, TagsField } from "./ui-client";
import { emptyAction, type ActionState, type DuplicateWarning } from "@/lib/forms";
import { MEME_FIELDS, type MemeField } from "@/lib/types";
import type { MemeSnapshot } from "@/lib/memes";

/* -------------------------------------------------------------------------- */
/* Markup editor                                                               */
/* -------------------------------------------------------------------------- */

const TOOLS: { label: string; title: string; wrap: [string, string] }[] = [
  { label: "T", title: "Negrito", wrap: ["**", "**"] },
  { label: "I", title: "Itálico", wrap: ["*", "*"] },
  { label: "</>", title: "Código", wrap: ["`", "`"] },
  { label: "H3", title: "Subtítulo", wrap: ["### ", ""] },
  { label: "•", title: "Lista com marcadores", wrap: ["- ", ""] },
  { label: "1.", title: "Lista numerada", wrap: ["1. ", ""] },
  { label: "❝", title: "Citação", wrap: ["> ", ""] },
  { label: "⧉", title: "Tabela", wrap: ["", ""] },
];

const TABLE_TEMPLATE = "| Coluna 1 | Coluna 2 |\n|---|---|\n| valor | valor |";

function MarkupEditor({
  id,
  name,
  defaultValue,
  rows = 6,
  label,
  hint,
  error,
  required,
}: {
  id: string;
  name: string;
  defaultValue: string;
  rows?: number;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [value, setValue] = useState(defaultValue);

  const apply = (tool: (typeof TOOLS)[number]) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    let next: string;
    let caret: number;
    if (tool.label === "⧉") {
      next = `${value.slice(0, start)}${TABLE_TEMPLATE}${value.slice(end)}`;
      caret = start + TABLE_TEMPLATE.length;
    } else if (tool.wrap[0] === "" ) {
      return;
    } else {
      next = `${value.slice(0, start)}${tool.wrap[0]}${selected}${tool.wrap[1]}${value.slice(end)}`;
      caret = start + tool.wrap[0].length + selected.length + tool.wrap[1].length;
    }
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const insertLink = () => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "texto do link";
    const snippet = `[${selected}](https://)`;
    setValue(`${value.slice(0, start)}${snippet}${value.slice(end)}`);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + selected.length + 3;
      el.setSelectionRange(caret, caret + 8);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.8125rem] font-semibold text-ink">
          {label}
          {required ? (
            <>
              <span className="ml-1 text-accent" aria-hidden>*</span>
              <span className="sr-only"> (obrigatório)</span>
            </>
          ) : null}
        </label>
        <span className="font-mono text-[0.6875rem] text-ink-4 tabular">{value.length}</span>
      </div>

      <div className="flex flex-wrap items-center gap-0.5 rounded-control border border-line bg-sunken p-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.title}
            type="button"
            title={tool.title}
            aria-label={tool.title}
            onClick={() => apply(tool)}
            className="inline-flex h-7 min-w-7 items-center justify-center rounded-[5px] px-1.5 font-mono text-[0.75rem] text-ink-2 transition-colors duration-150 hover:bg-surface hover:text-ink"
          >
            {tool.label}
          </button>
        ))}
        <button
          type="button"
          title="Inserir link"
          aria-label="Inserir link"
          onClick={insertLink}
          className="inline-flex h-7 items-center justify-center rounded-[5px] px-2 text-[0.75rem] font-medium text-ink-2 transition-colors duration-150 hover:bg-surface hover:text-ink"
        >
          Link
        </button>
        <span className="ml-auto pr-1">
          <button
            type="button"
            aria-pressed={preview}
            onClick={() => setPreview((p) => !p)}
            className="inline-flex h-7 items-center gap-1 rounded-[5px] px-2 text-[0.75rem] font-medium text-ink-2 transition-colors duration-150 hover:bg-surface hover:text-ink"
          >
            {preview ? <Icons.edit size={13} aria-hidden /> : <Icons.eye size={13} aria-hidden />}
            {preview ? "Editar" : "Pré-visualizar"}
          </button>
        </span>
      </div>

      {preview ? (
        <div className="article min-h-24 rounded-control border border-line bg-surface px-3 py-2">
          {value.trim() ? <RichText value={value} /> : <p className="text-ink-4">Nada escrito ainda.</p>}
        </div>
      ) : (
        <Textarea
          id={id}
          ref={ref}
          name={name}
          rows={rows}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={Boolean(error)}
        />
      )}
      {error ? (
        <p role="alert" className="flex items-center gap-1 text-[0.75rem] font-medium text-danger">
          <Icons.warningCircle size={13} aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.75rem] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export { MarkupEditor };

/* -------------------------------------------------------------------------- */
/* Meme editor form                                                            */
/* -------------------------------------------------------------------------- */

const GROUP_LABEL: Record<string, { title: string; note: string }> = {
  essencial: {
    title: "O essencial",
    note: "Estes campos aparecem nos cards, na busca e nos resultados de leitura rápida.",
  },
  contexto: {
    title: "Origem e contexto",
    note: "Datas, país e região ajudam a situar o meme. Use “aproximadamente” quando não houver confirmação.",
  },
  artigo: {
    title: "Conteúdo do artigo",
    note: "Este é o corpo da enciclopédia. Escreva de forma informativa, não como piada.",
  },
  referencias: {
    title: "Fontes",
    note: "Links e publicações que sustentam o que está escrito. Sem fonte, o texto não pode ser verificado.",
  },
};

const GROUP_ORDER = ["essencial", "contexto", "artigo", "referencias"] as const;

function fieldsByGroup(group: string): MemeField[] {
  return MEME_FIELDS.filter((field) => field.group === group);
}

export interface MemeEditorProps {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  mode: "create" | "edit";
  memeId?: number;
  memeName?: string;
  slug?: string;
  initial?: MemeSnapshot;
  categories: { id: number; name: string; group_name: string }[];
  allowDirectPublish?: boolean;
  challenge?: { id: string; prompt: string } | null;
  warning?: string;
  requiresImage?: boolean;
  /** Current primary image URL, shown as preview when editing media. */
  mediaUrl?: string | null;
}

function snapshotToRecord(snapshot?: MemeSnapshot): Record<string, string> {
  const out: Record<string, string> = {};
  if (!snapshot) return out;
  for (const field of MEME_FIELDS) {
    const value = snapshot[field.key as keyof MemeSnapshot];
    out[field.key] =
      Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value);
  }
  return out;
}

export function MemeEditor(props: MemeEditorProps) {
  const {
    action,
    mode,
    memeId,
    memeName,
    slug,
    categories,
    allowDirectPublish,
    challenge,
    warning,
    requiresImage,
    mediaUrl,
  } = props;

  const initial = useMemo(() => snapshotToRecord(props.initial), [props.initial]);
  const [state, formAction] = useActionState(action, emptyAction);
  const router = useRouter();
  const [changed, setChanged] = useState<string[]>([]);
  const [confirmedDistinct, setConfirmedDistinct] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const trackChanges = () => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const next: string[] = [];
    for (const field of MEME_FIELDS) {
      const current = String(data.get(field.key) ?? "").trim();
      const before = (initial[field.key] ?? "").trim();
      if (current !== before) next.push(field.key);
    }
    setChanged(next);
  };

  if (state.ok && state.queued) {
    return (
      <Panel className="p-6">
        <Alert tone="ok" title="Sua contribuição foi enviada para revisão">
          <p>{state.message}</p>
          <p className="mt-2 text-ink-2">
            O conteúdo <strong>não</strong> entra na enciclopédia imediatamente: ele passa pela triagem
            automática e depois pela fila de revisão da administração.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href="/contribuicoes" size="sm">
              <Icons.note size={15} aria-hidden />
              Acompanhar minhas contribuições
            </ButtonLink>
            <Button variant="secondary" size="sm" onClick={() => router.push("/memes")}>
              Voltar ao catálogo
            </Button>
          </div>
        </Alert>
      </Panel>
    );
  }

  const duplicates: DuplicateWarning[] = state.duplicates ?? [];

  return (
    <form ref={formRef} action={formAction} onInput={trackChanges} className="flex flex-col gap-5">
      {memeId ? <input type="hidden" name="meme_id" value={memeId} /> : null}
      {confirmedDistinct ? <input type="hidden" name="confirmed_distinct" value="1" /> : null}

      {mode === "edit" ? (
        <Alert tone="info" title={`Editando: ${memeName ?? "meme"}`}>
          {allowDirectPublish
            ? "Você tem permissão para publicar direto nesta página. Uma nova versão é criada no histórico."
            : "Suas alterações passarão por revisão antes de serem publicadas."}
        </Alert>
      ) : null}

      {warning ? <Alert tone="warn">{warning}</Alert> : null}
      {state.message && !state.ok && !duplicates.length ? <Alert tone="danger">{state.message}</Alert> : null}

      {duplicates.length ? (
        <Panel className="p-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-warn" aria-hidden>
              <Icons.warning size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-semibold text-ink">Talvez esse meme já exista</p>
              <p className="mt-1 text-[0.8125rem] text-ink-3">
                Encontramos {duplicates.length} meme(s) parecido(s). Confira antes de continuar: páginas
                duplicadas dividem informação que deveria estar junta.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {duplicates.map((duplicate) => (
                  <li key={duplicate.slug} className="rounded-control border border-line bg-sunken p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.875rem] font-semibold text-ink">{duplicate.name}</span>
                      <Badge tone={duplicate.relevance >= 70 ? "danger" : "warn"}>
                        {duplicate.relevance >= 70 ? "provável igual" : "parecido"}
                      </Badge>
                      <ButtonLink href={`/meme/${duplicate.slug}`} size="sm" variant="secondary">
                        Ver página
                      </ButtonLink>
                    </div>
                    {duplicate.description ? (
                      <p className="mt-1 text-[0.75rem] text-ink-3">{duplicate.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmedDistinct(true)}>
                  Esse é outro meme, enviar assim mesmo
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmedDistinct(false)}>
                  Recomeçar a busca
                </Button>
              </div>
              {confirmedDistinct ? (
                <p className="mt-2 text-[0.75rem] font-medium text-ok" aria-live="polite">
                  Confirmado como novo meme. Use o botão enviar para continuar.
                </p>
              ) : null}
            </div>
          </div>
        </Panel>
      ) : null}

      {changed.length ? (
        <p className="flex flex-wrap items-center gap-1.5 text-[0.75rem] text-ink-3">
          <Icons.diff size={13} aria-hidden />
          Campos alterados nesta sessão: {changed.length}
          <span className="sr-only">, sendo eles {changed.join(", ")}</span>
          <span aria-hidden className="text-ink-4">({changed.join(", ")})</span>
        </p>
      ) : null}

      <Panel className="p-4 sm:p-5">
        <MediaPicker
          name="media"
          currentUrl={mediaUrl ?? null}
          required={requiresImage}
          label={requiresImage ? "Imagem do meme" : "Imagem do meme (opcional)"}
        />
        {state.errors?.media ? (
          <p role="alert" className="mt-2 flex items-center gap-1 text-[0.75rem] font-medium text-danger">
            <Icons.warningCircle size={13} aria-hidden />
            {state.errors.media}
          </p>
        ) : null}
      </Panel>

      {/* ---------------------------------------------------------------- */}
      {/* Field groups                                                       */}
      {/* ---------------------------------------------------------------- */}
      {GROUP_ORDER.map((group) => {
        const meta = GROUP_LABEL[group];
        const fields = fieldsByGroup(group);
        return (
          <Panel key={group} className="p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-2.5">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>
                <Icons.text size={14} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[0.9375rem] font-semibold text-ink">{meta.title}</h2>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">{meta.note}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {fields.map((field) => {
                const value = initial[field.key] ?? "";
                const error = state.errors?.[field.key];

                if (field.type === "select") {
                  return (
                    <div key={field.key} className="flex flex-col gap-1.5">
                      <label htmlFor={`f-${field.key}`} className="text-[0.8125rem] font-semibold text-ink">
                        {field.label}
                        <span className="ml-1 text-accent" aria-hidden>*</span>
                        <span className="sr-only"> (obrigatório)</span>
                      </label>
                      <Select
                        id={`f-${field.key}`}
                        name="category_id"
                        defaultValue={value || ""}
                        aria-invalid={Boolean(error)}
                      >
                        <option value="">Escolha a categoria…</option>
                        {categories.map((category) => (
                          <option key={category.id} value={String(category.id)}>
                            {category.group_name} › {category.name}
                          </option>
                        ))}
                      </Select>
                      {error ? (
                        <p role="alert" className="flex items-center gap-1 text-[0.75rem] font-medium text-danger">
                          <Icons.warningCircle size={13} aria-hidden />
                          {error}
                        </p>
                      ) : field.hint ? (
                        <p className="text-[0.75rem] text-ink-3">{field.hint}</p>
                      ) : null}
                    </div>
                  );
                }

                if (field.type === "tags") {
                  return (
                    <div key={field.key} className="flex flex-col gap-1.5">
                      <TagsField name="tags" defaultValue={value} label={field.label} hint={field.hint} />
                      {error ? (
                        <p role="alert" className="flex items-center gap-1 text-[0.75rem] font-medium text-danger">
                          <Icons.warningCircle size={13} aria-hidden />
                          {error}
                        </p>
                      ) : null}
                    </div>
                  );
                }

                if (field.type === "richtext") {
                  return (
                    <MarkupEditor
                      key={field.key}
                      id={`f-${field.key}`}
                      name={field.key}
                      label={field.label}
                      hint={field.hint}
                      error={error}
                      defaultValue={value}
                      rows={field.rows}
                    />
                  );
                }

                if (field.type === "textarea") {
                  return (
                    <Field
                      key={field.key}
                      label={field.label}
                      hint={field.hint}
                      error={error}
                      htmlFor={`f-${field.key}`}
                      required
                    >
                      <Textarea
                        id={`f-${field.key}`}
                        name={field.key}
                        rows={field.rows ?? 3}
                        defaultValue={value}
                        placeholder={field.placeholder}
                        aria-invalid={Boolean(error)}
                      />
                    </Field>
                  );
                }

                return (
                  <Field
                    key={field.key}
                    label={field.label}
                    hint={field.hint}
                    error={error}
                    htmlFor={`f-${field.key}`}
                  >
                    <Input
                      id={`f-${field.key}`}
                      name={field.key}
                      type={field.type === "number" ? "number" : "text"}
                      inputMode={field.type === "number" ? "numeric" : undefined}
                      min={field.type === "number" ? 1900 : undefined}
                      max={field.type === "number" ? 2100 : undefined}
                      defaultValue={value}
                      placeholder={field.placeholder}
                      aria-invalid={Boolean(error)}
                    />
                  </Field>
                );
              })}
            </div>
          </Panel>
        );
      })}

      {/* ---------------------------------------------------------------- */}
      {/* Review meta + submit                                               */}
      {/* ---------------------------------------------------------------- */}
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>
              <Icons.shield size={14} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[0.9375rem] font-semibold text-ink">Envio e revisão</h2>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                Toda contribuição passa por triagem automática e depois pela fila de revisão. Você acompanha
                o resultado em “Minhas contribuições”.
              </p>
            </div>
          </div>

          <Field label="Nota para a equipe de revisão" htmlFor="f-note">
            <Textarea
              id="f-note"
              name={mode === "edit" ? "note" : "submission_note"}
              rows={3}
              maxLength={1000}
              placeholder={
                mode === "edit"
                  ? "Explique o que mudou e por quê — isso agiliza a aprovação."
                  : "Conte onde encontrou o meme, fontes, o que já verificou…"
              }
            />
          </Field>

          {challenge ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-challenge" className="text-[0.8125rem] font-semibold text-ink">
                Confirmação humana
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-control border border-line bg-sunken px-3 py-2 font-mono text-sm text-ink select-all">
                  {challenge.prompt}
                </span>
                <Input
                  id="f-challenge"
                  name="challenge_answer"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-28"
                  placeholder="= ?"
                  aria-invalid={Boolean(state.errors?.challenge_answer)}
                />
              </div>
              <input type="hidden" name="challenge_id" value={challenge.id} />
              {state.errors?.challenge_answer ? (
                <p role="alert" className="flex items-center gap-1 text-[0.75rem] font-medium text-danger">
                  <Icons.warningCircle size={13} aria-hidden />
                  {state.errors.challenge_answer}
                </p>
              ) : (
                <p className="text-[0.75rem] text-ink-3">Um teste simples contra envios automatizados.</p>
              )}
            </div>
          ) : null}

          {allowDirectPublish ? (
            <Checkbox name="publish_direct" label="Publicar direto, sem fila de revisão" description="Disponível para a equipe; cria uma nova versão no histórico imediatamente." />
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
            <SubmitButton pendingLabel={mode === "edit" ? "Enviando alteração…" : "Enviando contribuição…"}>
              <Icons.send size={15} aria-hidden />
              {mode === "edit" ? "Enviar alteração" : "Enviar para revisão"}
            </SubmitButton>
            {mode === "edit" && slug ? (
              <ButtonLink href={`/meme/${slug}`} variant="ghost" size="md">
                Cancelar
              </ButtonLink>
            ) : null}
            <p className="text-[0.75rem] text-ink-4">Nada é publicado sem passar pela revisão.</p>
          </div>
        </div>
      </Panel>
    </form>
  );
}
