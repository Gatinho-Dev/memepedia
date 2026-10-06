"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "./icons";
import { Alert, Button, buttonClass, Field, Panel, Select, Textarea } from "./ui";
import { Modal, SubmitButton } from "./ui-client";
import { addCommentAction, addInformationAction, reportContentAction } from "@/app/actions/meme";
import { emptyAction } from "@/lib/forms";
import { REPORT_REASONS } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Quick "add information" form                                                */
/* -------------------------------------------------------------------------- */

const INFO_FIELDS = [
  { key: "origin", label: "Origem" },
  { key: "history", label: "História" },
  { key: "usage_notes", label: "Como é usado" },
  { key: "characteristics", label: "Características" },
  { key: "variations", label: "Variações" },
  { key: "trivia", label: "Curiosidades" },
  { key: "approx_year", label: "Ano aproximado" },
  { key: "approx_period", label: "Período aproximado" },
  { key: "country", label: "País" },
  { key: "region", label: "Região" },
  { key: "sources", label: "Fontes e referências" },
];

export function AddInformationPanel({ memeId, memeName }: { memeId: number; memeName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addInformationAction, emptyAction);
  const router = useRouter();
  const done = state.ok && state.queued;

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, state.stamp, router]);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Icons.lightbulb size={15} aria-hidden />
        Adicionar informação
      </Button>
    );
  }

  return (
    <Modal
      open
      onClose={() => setOpen(false)}
      title={`Adicionar informação em ${memeName}`}
      description="Escreva em linguagem simples. A equipe transforma o texto em conteúdo enciclopédico."
    >
      {done ? (
        <Alert tone="ok" title="Informação enviada para revisão">
          {state.message} Você acompanha o status em <strong>Minhas contribuições</strong>.
        </Alert>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="meme_id" value={memeId} />
          <Field label="O que você quer acrescentar?" htmlFor="info-field" required>
            <Select id="info-field" name="field" defaultValue="history">
              {INFO_FIELDS.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Informação"
            htmlFor="info-value"
            required
            hint="Exemplo: “Esse meme é de 2017 e surgiu no Twitter, depois migrou para grupos de WhatsApp.”"
            error={state.errors?.value}
          >
            <Textarea id="info-value" name="value" rows={5} required />
          </Field>
          <Field label="Observação para quem revisa (opcional)" htmlFor="info-note">
            <Textarea id="info-note" name="note" rows={2} />
          </Field>
          {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton size="sm" pendingLabel="Enviando…">
              <Icons.send size={15} aria-hidden />
              Enviar para revisão
            </SubmitButton>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Comments                                                                    */
/* -------------------------------------------------------------------------- */

export function CommentForm({
  memeId,
  parentId = null,
  onDone,
  compact = false,
}: {
  memeId: number;
  parentId?: number | null;
  onDone?: () => void;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(addCommentAction, emptyAction);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
      onDone?.();
    }
  }, [state.ok, state.stamp, router, onDone]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="meme_id" value={memeId} />
      {parentId ? <input type="hidden" name="parent_id" value={parentId} /> : null}
      <label htmlFor={`comment-${parentId ?? "root"}`} className="sr-only">
        {parentId ? "Escreva uma resposta" : "Escreva um comentário"}
      </label>
      <Textarea
        id={`comment-${parentId ?? "root"}`}
        name="body"
        rows={compact ? 2 : 3}
        required
        maxLength={1500}
        placeholder={parentId ? "Escreva uma resposta…" : "Compartilhe uma informação ou observação sobre este meme…"}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.6875rem] text-ink-4">
          Comentários passam por triagem automática. Spam e ofensas são bloqueados.
        </p>
        <SubmitButton size="sm" pendingLabel="Publicando…">
          <Icons.send size={14} aria-hidden />
          {parentId ? "Responder" : "Comentar"}
        </SubmitButton>
      </div>
      {state.message ? (
        <Alert tone={state.ok ? "ok" : "danger"}>{state.message}</Alert>
      ) : null}
    </form>
  );
}

export function ReplyToggle({ memeId, commentId }: { memeId: number; commentId: number }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("ghost", "sm")}>
        <Icons.chat size={14} aria-hidden />
        Responder
      </button>
    );
  }
  return (
    <div className="mt-2">
      <CommentForm memeId={memeId} parentId={commentId} compact onDone={() => setOpen(false)} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Report                                                                      */
/* -------------------------------------------------------------------------- */

export function ReportDialog({
  targetType,
  targetId,
  label = "Denunciar",
  size = "sm",
  variant = "ghost",
}: {
  targetType: "meme" | "comment" | "user";
  targetId: number;
  label?: string;
  size?: "sm" | "md";
  variant?: "ghost" | "quiet" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(reportContentAction, emptyAction);

  useEffect(() => {
    if (state.ok) {
      const timer = window.setTimeout(() => setOpen(false), 2500);
      return () => window.clearTimeout(timer);
    }
  }, [state.ok, state.stamp]);

  return (
    <>
      <button type="button" className={buttonClass(variant, size)} onClick={() => setOpen(true)}>
        <Icons.flag size={14} aria-hidden />
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Denunciar conteúdo"
        description="Descreva o problema. Denúncias abusivas também são registradas no log de auditoria."
      >
        {state.ok ? (
          <Alert tone="ok" title="Denúncia registrada">
            {state.message}
          </Alert>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="target_type" value={targetType} />
            <input type="hidden" name="target_id" value={targetId} />
            <Field label="Motivo" htmlFor="report-reason" required>
              <Select id="report-reason" name="reason" defaultValue="">
                <option value="" disabled>
                  Selecione um motivo
                </option>
                {REPORT_REASONS.map((reason) => (
                  <option key={reason.key} value={reason.key}>
                    {reason.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Detalhes"
              htmlFor="report-details"
              required
              hint="Quanto mais específico, mais rápido a moderação resolve."
              error={state.errors?.details}
            >
              <Textarea id="report-details" name="details" rows={4} required minLength={10} />
            </Field>
            {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <SubmitButton size="sm" variant="danger" pendingLabel="Enviando…">
                Enviar denúncia
              </SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Tag list with a copy affordance                                             */
/* -------------------------------------------------------------------------- */

export function TagPills({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag}>
          <a
            href={`/tags/${encodeURIComponent(
              tag
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, ""),
            )}`}
            className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface px-2.5 py-1 text-[0.75rem] text-ink-2 transition-colors duration-150 hover:border-accent-line hover:text-ink"
          >
            <Icons.hash size={10} aria-hidden />
            {tag}
          </a>
        </li>
      ))}
    </ul>
  );
}

export { Panel };
