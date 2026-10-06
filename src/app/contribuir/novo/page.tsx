import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, createChallenge, getSettings } from "@/lib/auth";
import { all } from "@/lib/db";
import { submitNewMemeAction } from "@/app/actions/meme";
import { canDirectEditOn } from "@/lib/permissions";
import { MemeEditor } from "@/components/meme-editor";
import { Breadcrumbs, Panel } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata: Metadata = {
  title: "Sugerir um meme novo",
  description: "Envie um meme para a fila de revisão da Memepedia.",
};

export default async function NewMemePage({
  searchParams,
}: {
  searchParams: Promise<{ nome?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/entrar?proximo=/contribuir/novo");

  const { nome } = await searchParams;
  const settings = getSettings();
  const categories = all<{ id: number; name: string; group_name: string }>(
    `SELECT id, name, group_name FROM categories ORDER BY group_name, sort_order, name`,
  );

  const needsChallenge =
    settings.requireCaptchaOnContribute && (user.role === "user" || user.role === "contributor");
  const challenge = needsChallenge ? createChallenge() : null;

  const action = async (state: Parameters<typeof submitNewMemeAction>[0], form: FormData) => {
    "use server";
    return submitNewMemeAction(state, form);
  };

  return (
    <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Contribuir", href: "/contribuir" },
          { label: "Meme novo" },
        ]}
      />
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink">Sugerir um meme novo</h1>
      <p className="mt-2 max-w-2xl text-[0.9375rem] text-ink-2">
        Preencha o que souber — campos de artigo podem ficar para depois, mas quanto mais contexto você enviar,
        mais rápida é a revisão.{" "}
        <Link href="/contribuir" className="font-semibold text-accent underline underline-offset-2">
          Ver as regras de envio
        </Link>
      </p>

      {nome ? (
        <Panel className="mt-4 p-4">
          <p className="flex items-start gap-2 text-sm text-ink-2">
            <Icons.info size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span>
              Você veio de uma busca por <strong>“{nome}”</strong>. Se a página já existe, prefira{" "}
              <Link href="/memes" className="font-semibold text-accent underline underline-offset-2">
                procurar no catálogo
              </Link>{" "}
              e sugerir uma correção nela.
            </span>
          </p>
        </Panel>
      ) : null}

      <div className="mt-6">
        <MemeEditor
          action={action}
          mode="create"
          categories={categories}
          allowDirectPublish={canDirectEditOn(user.role, "free")}
          challenge={challenge}
        />
      </div>
    </main>
  );
}
