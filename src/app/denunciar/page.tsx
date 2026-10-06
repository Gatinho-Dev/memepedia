import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { reportContentAction } from "@/app/actions/meme";
import { emptyAction, fail, type ActionState } from "@/lib/forms";
import { Badge, ButtonLink, Panel } from "@/components/ui";
import { Icons } from "@/components/icons";
import { ReportForm } from "./report-form";

export const metadata: Metadata = {
  title: "Denunciar conteúdo",
  description: "Reporte problemas de conteúdo, direitos autorais ou conduta para a moderação da Memepedia.",
};

/** Resolves a pasted path like /meme/doge or /perfil/clarice into (target_type, target_id). */
function resolveTarget(raw: string): { type: "meme" | "user"; id: number } | null {
  const path = raw.trim().split("#")[0].split("?")[0];
  const memeMatch = path.match(/^\/meme\/([a-z0-9-]+)\/?$/i);
  if (memeMatch) {
    const meme = get<{ id: number }>("SELECT id FROM memes WHERE slug = ?", memeMatch[1].toLowerCase());
    if (meme) return { type: "meme", id: meme.id };
  }
  const userMatch = path.match(/^\/perfil\/([a-z0-9._-]+)\/?$/i);
  if (userMatch) {
    const user = get<{ id: number }>("SELECT id FROM users WHERE username = ?", userMatch[1].toLowerCase());
    if (user) return { type: "user", id: user.id };
  }
  return null;
}

export default async function ReportPage() {
  const user = await currentUser();
  if (!user) redirect("/entrar?proximo=/denunciar");

  const action = async (_state: ActionState, form: FormData): Promise<ActionState> => {
    "use server";
    const target = resolveTarget(String(form.get("target_url") ?? ""));
    if (!target) {
      return fail("Não encontramos essa página. Confira o endereço — deve começar com /meme/ ou /perfil/.", {
        target_url: "Endereço não reconhecido.",
      });
    }
    form.set("target_type", target.type);
    form.set("target_id", String(target.id));
    return reportContentAction(_state, form);
  };

  return (
    <main id="conteudo" className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-12">
      <Badge tone="warn">Moderação</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Denunciar conteúdo
      </h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
        Vimos denúncias a sério: cada uma gera uma notificação para a equipe e um registro permanente. Se for
        sobre direitos autorais, leia a{" "}
        <Link href="/politica-de-conteudo" className="font-semibold text-accent underline underline-offset-2">
          política de conteúdo
        </Link>{" "}
        — o processo está descrito na seção 5.
      </p>

      <Panel className="mt-6 p-5">
        <ReportForm action={action} />
      </Panel>

      <div className="mt-4 flex flex-wrap gap-3">
        <ButtonLink href="/memes" variant="secondary" size="sm">
          <Icons.compass size={14} aria-hidden />
          Procurar a página no catálogo
        </ButtonLink>
      </div>

      <p className="mt-4 text-[0.8125rem] text-ink-4">
        Denúncias em série ou falsas passam a contar contra o autor, conforme o{" "}
        <Link href="/codigo-de-conduta" className="underline underline-offset-2 hover:text-ink-2">
          código de conduta
        </Link>
        .
      </p>
    </main>
  );
}
