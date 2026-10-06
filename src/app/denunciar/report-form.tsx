"use client";

import { useActionState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { emptyAction, type ActionState } from "@/lib/forms";
import { REPORT_REASONS } from "@/lib/types";

export function ReportForm({
  action,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, emptyAction);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.ok && state.message ? (
        <p role="status" className="rounded-control border border-line-soft bg-sunken px-4 py-3 text-sm text-ink-2">
          {state.message}
        </p>
      ) : null}
      {state.message && !state.ok ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.message}
        </p>
      ) : null}

      <Field
        label="Endereço do conteúdo"
        htmlFor="target_url"
        required
        hint="Cole o link copiado da página, ex.: /meme/doge ou /perfil/clarice. O sistema identifica a página automaticamente."
        error={state.errors?.target_url}
      >
        <Input id="target_url" name="target_url" required placeholder="/meme/…" />
      </Field>

      <Field label="Motivo" htmlFor="reason" required error={state.errors?.reason}>
        <Select id="reason" name="reason" defaultValue="">
          <option value="" disabled>
            Escolha o motivo…
          </option>
          {/* Same canonical list used by the in-page report dialog, so the
              moderation queue can label every report. */}
          {REPORT_REASONS.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Detalhes"
        htmlFor="details"
        required
        hint="Mínimo de 10 caracteres. Em casos de direitos autorais, diga quem é o titular e onde está a obra original."
        error={state.errors?.details}
      >
        <Textarea id="details" name="details" rows={5} maxLength={2000} required minLength={10} />
      </Field>

      <div>
        <SubmitButton pendingLabel="Enviando denúncia…">Enviar denúncia</SubmitButton>
      </div>
    </form>
  );
}
