"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { emptyAction, type ActionState } from "@/lib/forms";

export function ProfileEditForm({
  action,
  defaults,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  defaults: { display_name: string; bio: string; location: string; website: string };
}) {
  const [state, formAction] = useActionState(action, emptyAction);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field label="Nome de exibição" htmlFor="display_name" required error={state.errors?.display_name}>
        <Input id="display_name" name="display_name" defaultValue={defaults.display_name} required />
      </Field>
      <Field label="Bio" htmlFor="bio" hint="Até 600 caracteres. Aparece no perfil público.">
        <Textarea id="bio" name="bio" rows={3} defaultValue={defaults.bio} maxLength={600} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Localização" htmlFor="location">
          <Input id="location" name="location" defaultValue={defaults.location} placeholder="São Paulo, Brasil" />
        </Field>
        <Field label="Site" htmlFor="website" error={state.errors?.website}>
          <Input id="website" name="website" type="url" defaultValue={defaults.website} placeholder="https://…" />
        </Field>
      </div>
      <div>
        <SubmitButton pendingLabel="Salvando…">Salvar perfil</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm({
  action,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, emptyAction);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Senha atual" htmlFor="current_password" required error={state.errors?.current_password}>
          <Input id="current_password" name="current_password" type="password" autoComplete="current-password" required />
        </Field>
        <Field label="Nova senha" htmlFor="new_password" required error={state.errors?.new_password}>
          <Input id="new_password" name="new_password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Confirmar" htmlFor="new_password_confirm" required error={state.errors?.new_password_confirm}>
          <Input id="new_password_confirm" name="new_password_confirm" type="password" autoComplete="new-password" required />
        </Field>
      </div>
      <div>
        <SubmitButton pendingLabel="Alterando…" variant="secondary">
          Alterar senha
        </SubmitButton>
      </div>
    </form>
  );
}
