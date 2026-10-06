import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { signInAction } from "@/app/actions/auth";
import { Panel } from "@/components/ui";
import { Logo } from "@/components/logo";
import { emptyAction, type ActionState } from "@/lib/forms";
import { DEMO_PASSWORD, OWNER_PASSWORD } from "@/lib/seed";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta da Memepedia para contribuir, revisar e acompanhar suas edições.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; proximo?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect("/");

  // requireUser() redirects with ?next=, hand-written links use ?proximo=.
  const { next: rawNext, proximo } = await searchParams;
  const candidate = rawNext ?? proximo ?? "/";
  const next = candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
  const action = async (state: ActionState, form: FormData) => {
    "use server";
    return signInAction(state, form);
  };

  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="h-9 w-auto" />
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Entrar na Memepedia</h1>
        <p className="max-w-sm text-sm text-ink-3">
          Entre para sugerir memes, propor correções e acompanhar suas contribuições.
        </p>
      </div>

      <Panel className="p-5 sm:p-6">
        <SignInForm action={action} next={next} />
      </Panel>

      <p className="text-center text-sm text-ink-3">
        Ainda não tem conta?{" "}
        <Link href="/registrar" className="font-semibold text-accent underline underline-offset-2 hover:text-accent-strong">
          Criar uma conta
        </Link>
      </p>

      <Panel className="p-4">
        <p className="text-[0.8125rem] font-semibold text-ink">Contas de demonstração</p>
        <ul className="mt-2 flex flex-col gap-1 text-[0.8125rem] text-ink-3">
          <li>
            <span className="font-mono text-ink-2">owner@memepedia.app</span> — dono (controle total)
          </li>
          <li>
            <span className="font-mono text-ink-2">clarice@exemplo.com</span> — moderadora
          </li>
          <li>
            <span className="font-mono text-ink-2">tiago@exemplo.com</span> — colaborador
          </li>
          <li>
            <span className="font-mono text-ink-2">rafael@exemplo.com</span> — usuário
          </li>
        </ul>
        <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-4">
          Senha do OWNER: <span className="font-mono text-ink-3">{OWNER_PASSWORD}</span>
          <br />
          Senha das demais contas: <span className="font-mono text-ink-3">{DEMO_PASSWORD}</span>
        </p>
      </Panel>
    </main>
  );
}
