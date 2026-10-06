import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createChallenge, currentUser, getSettings } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { getMemeBySlug, mediaForMeme, snapshotOf } from "@/lib/memes";
import { submitCorrectionAction } from "@/app/actions/meme";
import { canProposeOn } from "@/lib/permissions";
import { PROTECTION_HINT, PROTECTION_LABEL } from "@/lib/types";
import { MemeEditor } from "@/components/meme-editor";
import { Alert, Badge, Breadcrumbs, Panel } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata: Metadata = {
  title: "Sugerir alteração",
  description: "Sugira uma correção ou complemento para uma página da Memepedia.",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ slug: string }> };

export default async function SuggestChangePage({ params }: Props) {
  const { slug } = await params;
  const meme = await getMemeBySlug(slug);
  if (!meme || meme.status === "deleted") notFound();

  const user = await currentUser();
  if (!user) redirect(`/entrar?proximo=/meme/${slug}/sugerir`);

  if (!canProposeOn(user.role, meme.protection)) redirect(`/meme/${slug}`);

  const snapshot = snapshotOf(meme.id);
  if (!snapshot) notFound();

  const settings = getSettings();
  const categories = all<{ id: number; name: string; group_name: string }>(
    `SELECT id, name, group_name FROM categories ORDER BY group_name, sort_order, name`,
  );

  const needsChallenge =
    settings.requireCaptchaOnContribute && (user.role === "user" || user.role === "contributor");
  const challenge = needsChallenge ? createChallenge() : null;
  const pending = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM contributions WHERE meme_id = ? AND submitted_by = ? AND status = 'pending'",
    meme.id,
    user.id,
  );

  return (
    <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Memes", href: "/memes" },
          { label: meme.name, href: `/meme/${meme.slug}` },
          { label: "Sugerir alteração" },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Sugerir alteração</h1>
        <Badge tone="warn">Sempre passa por revisão</Badge>
      </div>

      <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-2">
        Você propõe uma nova versão de <strong className="text-ink">{meme.name}</strong>. A moderação compara sua
        sugestão com a versão atual, campo por campo, antes de publicar. Mudanças pequenas e bem explicadas são
        aprovadas mais rápido.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone="outline" icon={<Icons.shield size={11} aria-hidden />}>
          Proteção: {PROTECTION_LABEL[meme.protection]}
        </Badge>
        {pending?.n ? (
          <Badge tone="warn" icon={<Icons.clock size={11} aria-hidden />}>
            Você já tem {pending.n} sugestão(ões) pendente(s) nesta página
          </Badge>
        ) : null}
        <Link
          href={`/meme/${meme.slug}`}
          className="text-[0.8125rem] text-ink-3 underline underline-offset-2 hover:text-ink"
        >
          Voltar para a página
        </Link>
      </div>

      <Alert tone="info" title="O que costuma ser aprovado">
        Correções de data, origem e ortografia; fontes novas; detalhes verificáveis. Opinião, texto copiado de outro
        site e mudanças sem justificativa são rejeitados.
      </Alert>

      {meme.protection !== "free" ? (
        <Alert tone="warn" title={`Página com proteção ${PROTECTION_LABEL[meme.protection]}`}>
          {PROTECTION_HINT[meme.protection]}
        </Alert>
      ) : null}

      <Panel className="mt-4 p-4">
        <p className="flex items-start gap-2 text-[0.8125rem] text-ink-2">
          <Icons.info size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>
            O formulário já vem preenchido com o texto publicado. Alterar apenas o que é necessário deixa o diff
            claro para quem revisa e reduz a chance de rejeição.
          </span>
        </p>
      </Panel>

      <div className="mt-6">
        <MemeEditor
          action={submitCorrectionAction}
          mode="edit"
          memeId={meme.id}
          memeName={meme.name}
          slug={meme.slug}
          initial={snapshot}
          categories={categories}
          challenge={challenge}
          mediaUrl={mediaForMeme(meme.id)[0]?.url ?? null}
        />
      </div>
    </main>
  );
}
