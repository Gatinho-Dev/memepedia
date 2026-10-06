import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createChallenge, currentUser, getSettings } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { getMemeBySlug, mediaForMeme, snapshotOf, versionsOf } from "@/lib/memes";
import { submitCorrectionAction } from "@/app/actions/meme";
import { canDirectEditOn, canProposeOn } from "@/lib/permissions";
import { PROTECTION_HINT, PROTECTION_LABEL } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { MemeEditor } from "@/components/meme-editor";
import { Alert, Badge, Breadcrumbs, Panel } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata: Metadata = {
  title: "Editar página",
  description: "Edite uma página da Memepedia. Alterações ficam registradas no histórico.",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ slug: string }> };

export default async function EditMemePage({ params }: Props) {
  const { slug } = await params;
  const meme = await getMemeBySlug(slug);
  if (!meme || meme.status === "deleted") notFound();

  const user = await currentUser();
  if (!user) redirect(`/entrar?proximo=/meme/${slug}/editar`);

  const canDirect = canDirectEditOn(user.role, meme.protection);
  const canPropose = canProposeOn(user.role, meme.protection);
  if (!canPropose) redirect(`/meme/${slug}`);

  const snapshot = snapshotOf(meme.id);
  if (!snapshot) notFound();

  const settings = getSettings();
  const categories = all<{ id: number; name: string; group_name: string }>(
    `SELECT id, name, group_name FROM categories ORDER BY group_name, sort_order, name`,
  );

  const needsChallenge =
    !canDirect && settings.requireCaptchaOnContribute && (user.role === "user" || user.role === "contributor");
  const challenge = needsChallenge ? createChallenge() : null;
  const primary = mediaForMeme(meme.id).find((m) => m.is_primary) ?? mediaForMeme(meme.id)[0] ?? null;
  const lastVersion = versionsOf(meme.id)[0];
  const pending = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM contributions WHERE meme_id = ? AND status = 'pending'",
    meme.id,
  );

  return (
    <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Memes", href: "/memes" },
          { label: meme.name, href: `/meme/${meme.slug}` },
          { label: "Editar" },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Editar página</h1>
        <Badge tone={canDirect ? "ok" : "warn"}>
          {canDirect ? "Publicação direta liberada" : "Passa por revisão"}
        </Badge>
      </div>

      <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-2">
        Você está editando <strong className="text-ink">{meme.name}</strong>.{" "}
        {canDirect
          ? "As alterações são publicadas na hora, mas geram uma nova versão no histórico — nada é sobrescrito."
          : "Ao enviar, suas alterações viram uma sugestão que a moderação revisa antes de publicar."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone="outline" icon={<Icons.shield size={11} aria-hidden />}>
          Proteção: {PROTECTION_LABEL[meme.protection]}
        </Badge>
        {lastVersion ? (
          <Badge tone="neutral" icon={<Icons.history size={11} aria-hidden />}>
            {lastVersion.version_no} versões · atualizada {relativeTime(lastVersion.created_at)}
          </Badge>
        ) : null}
        {pending?.n ? (
          <Badge tone="warn" icon={<Icons.clock size={11} aria-hidden />}>
            {pending.n} contribuição(ões) pendente(s)
          </Badge>
        ) : null}
        <Link
          href={`/historico/${meme.slug}`}
          className="text-[0.8125rem] text-ink-3 underline underline-offset-2 hover:text-ink"
        >
          Ver histórico completo
        </Link>
      </div>

      {!canDirect ? (
        <Alert tone="warn" title={`Página com proteção ${PROTECTION_LABEL[meme.protection]}`}>
          {PROTECTION_HINT[meme.protection]} Você pode enviar uma sugestão, mas ela precisa de aprovação.
        </Alert>
      ) : null}

      <Panel className="mt-4 p-4">
        <p className="flex items-start gap-2 text-[0.8125rem] text-ink-2">
          <Icons.info size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>
            Edite apenas o que você consegue justificar com uma fonte. O campo de nota no fim do formulário é lido por
            quem revisa e fica registrado no histórico da página.
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
          allowDirectPublish={canDirect}
          challenge={challenge}
          mediaUrl={primary?.url ?? null}
        />
      </div>
    </main>
  );
}
