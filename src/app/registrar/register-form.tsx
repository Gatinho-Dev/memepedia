"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Checkbox, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { emptyAction, type ActionState } from "@/lib/forms";

export function RegisterForm({
  action,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, emptyAction);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Como quer ser chamado" htmlFor="display_name" required error={state.errors?.display_name}>
          <Input id="display_name" name="display_name" autoComplete="name" required placeholder="Maria Silva" />
        </Field>
        <Field
          label="Nome de usuário"
          htmlFor="username"
          required
          error={state.errors?.username}
          hint="Minúsculas, números, ponto, hífen ou sublinhado."
        >
          <Input id="username" name="username" autoComplete="username" required placeholder="maria.silva" />
        </Field>
      </div>
      <Field label="E-mail" htmlFor="email" required error={state.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@exemplo.com" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Senha" htmlFor="password" required error={state.errors?.password} hint="Mínimo de 10 caracteres, com letras e números.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Confirmar senha" htmlFor="password_confirm" required error={state.errors?.password_confirm}>
          <Input id="password_confirm" name="password_confirm" type="password" autoComplete="new-password" required />
        </Field>
      </div>
      <div className="flex flex-col gap-1">
        <Checkbox
          name="terms"
          label={
            <>
              Li e aceito o{" "}
              <Link href="/codigo-de-conduta" className="underline underline-offset-2">
                código de conduta
              </Link>{" "}
              e a{" "}
              <Link href="/politica-de-conteudo" className="underline underline-offset-2">
                política de conteúdo
              </Link>
              .
            </>
          }
        />
        {state.errors?.terms ? (
          <p role="alert" className="text-[0.75rem] font-medium text-danger">
            {state.errors.terms}
          </p>
        ) : null}
      </div>
      <SubmitButton pendingLabel="Criando conta…" className="w-full justify-center">
        Criar conta
      </SubmitButton>
    </form>
  );
}
