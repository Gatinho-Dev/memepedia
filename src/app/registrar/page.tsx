import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { signUpAction } from "@/app/actions/auth";
import { Panel } from "@/components/ui";
import { Logo } from "@/components/logo";
import { emptyAction, type ActionState } from "@/lib/forms";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta na Memepedia e comece a documentar a história dos memes da internet.",
};

export default async function RegisterPage() {
  const user = await currentUser();
  if (user) redirect("/");

  const action = async (state: ActionState, form: FormData) => {
    "use server";
    return signUpAction(state, form);
  };

  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-12 sm:py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="h-9 w-auto" />
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Criar sua conta</h1>
        <p className="max-w-md text-sm text-ink-3">
          Colaboradores novos podem sugerir memes e correções. Com o tempo e boas contribuições, a equipe pode
          ampliar suas permissões.
        </p>
      </div>

      <Panel className="p-5 sm:p-6">
        <RegisterForm action={action} />
      </Panel>

      <p className="text-center text-sm text-ink-3">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-accent underline underline-offset-2 hover:text-accent-strong">
          Entrar
        </Link>
      </p>

      <p className="text-center text-[0.75rem] text-ink-4">
        Ao criar a conta você aceita o{" "}
        <Link href="/codigo-de-conduta" className="underline underline-offset-2 hover:text-ink-2">
          código de conduta
        </Link>{" "}
        e a{" "}
        <Link href="/politica-de-conteudo" className="underline underline-offset-2 hover:text-ink-2">
          política de conteúdo
        </Link>
        .
      </p>
    </main>
  );
}
