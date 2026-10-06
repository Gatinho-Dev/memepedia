"use client";

import { useActionState } from "react";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { emptyAction, type ActionState } from "@/lib/forms";

export function SignInForm({
  action,
  next,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  next: string;
}) {
  const [state, formAction] = useActionState(action, emptyAction);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field
        label="E-mail ou usuário"
        htmlFor="identifier"
        required
        error={state.errors?.identifier}
      >
        {/* Field name must stay `identifier`: signInAction reads that key. */}
        <Input
          id="identifier"
          name="identifier"
          autoComplete="username"
          required
          placeholder="voce@exemplo.com"
        />
      </Field>
      <Field label="Senha" htmlFor="password" required error={state.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <input type="hidden" name="next" value={next} />
      <SubmitButton pendingLabel="Entrando…" className="w-full justify-center">
        Entrar
      </SubmitButton>
    </form>
  );
}
