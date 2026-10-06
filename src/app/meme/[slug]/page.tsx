import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import {
  getMemeBySlug,
  isFavorite,
  isFollowing,
  mediaForMeme,
  memeStats,
  recordView,
  relatedMemes,
  tagsForMeme,
} from "@/lib/memes";
import { listComments } from "@/lib/moderation";
import { compactNumber, formatNumber, plural, relativeTime } from "@/lib/format";
import { canDirectEditOn, canProposeOn } from "@/lib/permissions";
import { PROTECTION_HINT, PROTECTION_LABEL } from "@/lib/types";
import { Icons } from "@/components/icons";
import { MemeCardGrid } from "@/components/meme-card";
import { RichText } from "@/components/rich-text";
import {
  AddInformationPanel,
  CommentForm,
  ReplyToggle,
  ReportDialog,
  TagPills,
} from "@/components/meme-interactions";
import {
  Alert,
  Badge,
  Breadcrumbs,
  DemoBadge,
  EmptyState,
  MetaRow,
  Panel,
  SectionHeading,
  VerifiedBadge,
  buttonClass,
} from "@/components/ui";
import { toggleFavoriteAction, toggleFollowAction } from "@/app/actions/meme";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4310";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meme = await getMemeBySlug(slug);
  if (!meme) return { title: "Meme não encontrado" };
  const cover = mediaForMeme(meme.id).find((m) => m.is_primary);
  const description =
    meme.short_description || `Conheça a origem, história e contexto do meme ${meme.name}.`;
  return {
    title: `${meme.name} — Memepedia`,
    description,
    alternates: { canonical: `/meme/${meme.slug}` },
    openGraph: {
      type: "article",
      title: `${meme.name} — Memepedia`,
      description,
      url: `/meme/${meme.slug}`,
      images: cover ? [{ url: cover.url, alt: cover.alt }] : undefined,
      modifiedTime: meme.updated_at,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title: `${meme.name} — Memepedia`,
      description,
      images: cover ? [cover.url] : undefined,
    },
  };
}

const SECTIONS = [
  { key: "origin", title: "Origem", anchor: "origem" },
  { key: "history", title: "História", anchor: "historia" },
  { key: "usage_notes", title: "Como é usado", anchor: "como-e-usado" },
  { key: "characteristics", title: "Características", anchor: "caracteristicas" },
  { key: "variations", title: "Variações", anchor: "variacoes" },
  { key: "trivia", title: "Curiosidades", anchor: "curiosidades" },
  { key: "sources", title: "Fontes e referências", anchor: "fontes" },
] as const;

export default async function MemePage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const meme = await getMemeBySlug(slug);
  if (!meme || meme.status === "deleted") notFound();

  const user = await currentUser();
  const [media, tags, related, stats, comments, following, favoriting] = await Promise.all([
    mediaForMeme(meme.id),
    tagsForMeme(meme.id),
    relatedMemes(meme, 4),
    memeStats(meme.id),
    listComments(meme.id),
    isFollowing(user?.id, meme.id),
    isFavorite(user?.id, meme.id),
  ]);

  if (meme.status === "published") recordView(meme.id);

  const primary = media.find((m) => m.is_primary) ?? media[0];
  const gallery = media.filter((m) => !primary || m.id !== primary.id);
  const canDirect = canDirectEditOn(user?.role, meme.protection);
  const canPropose = canProposeOn(user?.role, meme.protection);
  const visibleSections = SECTIONS.filter((section) => (meme[section.key] ?? "").trim().length > 0);
  const viewHref = `/meme/${meme.slug}`;
  const statusNote =
    meme.status === "hidden"
      ? "Esta página está oculta e visível apenas para a equipe de moderação."
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${meme.name} — Memepedia`,
    description: meme.short_description,
    url: `${SITE_URL}/meme/${meme.slug}`,
    datePublished: meme.published_at ?? meme.created_at,
    dateModified: meme.updated_at,
    image: primary?.url ? `${SITE_URL}${primary.url}` : undefined,
    author: { "@type": "Organization", name: "Comunidade Memepedia" },
    publisher: { "@type": "Organization", name: "Memepedia" },
    about: meme.category_name ? { "@type": "Thing", name: meme.category_name } : undefined,
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/ViewAction", userInteractionCount: meme.views_count },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: comments.length },
    ],
  };

  return (
    <div className="flex flex-col gap-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {meme.protection !== "free" ? (
        <Alert tone="warn" title={`Página com proteção ${PROTECTION_LABEL[meme.protection]}`}>
          {PROTECTION_HINT[meme.protection]}
        </Alert>
      ) : null}
      {statusNote ? <Alert tone="danger">{statusNote}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Breadcrumbs
          items={[
            { label: "Início", href: "/" },
            { label: "Memes", href: "/memes" },
            ...(meme.category_name
              ? [{ label: meme.category_name, href: `/categoria/${meme.category_slug}` }]
              : []),
            { label: meme.name },
          ]}
        />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {canDirect ? (
            <Link href={`/meme/${meme.slug}/editar`} className={buttonClass("primary", "sm")}>
              <Icons.edit size={14} aria-hidden />
              Editar
            </Link>
          ) : canPropose ? (
            <Link href={`/meme/${meme.slug}/sugerir`} className={buttonClass("primary", "sm")}>
              <Icons.edit size={14} aria-hidden />
              Sugerir alteração
            </Link>
          ) : (
            <span className="text-[0.75rem] text-ink-3">Edições restritas nesta página</span>
          )}
          {canPropose && canDirect ? (
            <Link href={`/meme/${meme.slug}/sugerir`} className={buttonClass("secondary", "sm")}>
              Sugerir alteração
            </Link>
          ) : null}
          {user ? <AddInformationPanel memeId={meme.id} memeName={meme.name} /> : null}
          <Link href={`/historico/${meme.slug}`} className={buttonClass("secondary", "sm")}>
            <Icons.history size={14} aria-hidden />
            Ver histórico
          </Link>
        </div>
      </div>

      {/* Article header */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
        <div className="order-2 lg:order-1">
          {primary ? (
            <figure>
              <div className="overflow-hidden rounded-card border border-line bg-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={primary.url}
                  alt={primary.alt || `Mídia principal do meme ${meme.name}`}
                  width={primary.width ?? 1200}
                  height={primary.height ?? 800}
                  className="h-auto w-full object-cover"
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
              <figcaption className="mt-2 text-[0.75rem] leading-relaxed text-ink-3">
                {primary.caption ? <span className="block text-ink-2">{primary.caption}</span> : null}
                {primary.source_url ? (
                  <a href={primary.source_url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 hover:text-ink">
                    Fonte original
                  </a>
                ) : null}
                {primary.is_placeholder ? (
                  <span className="mt-1 block">Mídia de demonstração: substitua por uma imagem com licença verificada.</span>
                ) : null}
              </figcaption>
            </figure>
          ) : (
            <div className="grid aspect-[4/3] place-items-center rounded-card border border-dashed border-line bg-sunken text-ink-4">
              <Icons.media size={32} aria-hidden />
            </div>
          )}
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-2">
          <div className="flex flex-wrap items-center gap-2">
            {meme.verified ? <VerifiedBadge /> : null}
            {meme.featured ? (
              <Badge tone="accent" icon={<Icons.star size={12} weight="fill" aria-hidden />}>
                Destaque
              </Badge>
            ) : null}
            {meme.country ? <Badge tone="outline">{meme.country}</Badge> : null}
            {meme.is_demo ? <DemoBadge /> : null}
          </div>

          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-[-0.03em] text-ink sm:text-4xl">
              {meme.name}
            </h1>
            {meme.short_description ? (
              <p className="mt-3 max-w-[62ch] text-[1.0625rem] leading-relaxed text-ink-2">
                {meme.short_description}
              </p>
            ) : null}
          </div>

          <MetaRow
            items={[
              {
                icon: <Icons.calendar size={13} aria-hidden />,
                text: meme.approx_year ? `Aproximadamente ${meme.approx_year}` : "Data não confirmada",
              },
              ...(meme.category_name
                ? [{ icon: <Icons.category size={13} aria-hidden />, text: meme.category_name }]
                : []),
              ...(meme.region ? [{ icon: <Icons.pin size={13} aria-hidden />, text: meme.region }] : []),
            ]}
          />

          <TagPills tags={tags} />

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-4">
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-[0.06em] text-ink-4">Visualizações</dt>
              <dd className="font-mono text-lg font-semibold text-ink tabular">{compactNumber(meme.views_count)}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-[0.06em] text-ink-4">Versões</dt>
              <dd className="font-mono text-lg font-semibold text-ink tabular">{meme.versions_count}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-[0.06em] text-ink-4">Contribuições</dt>
              <dd className="font-mono text-lg font-semibold text-ink tabular">{meme.contributions_count}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-[0.06em] text-ink-4">Última atualização</dt>
              <dd className="text-[0.8125rem] font-medium text-ink-2">{relativeTime(meme.updated_at)}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-1.5">
            {user ? (
              <>
                <form action={toggleFollowAction}>
                  <input type="hidden" name="meme_id" value={meme.id} />
                  <input type="hidden" name="return_to" value={viewHref} />
                  <button type="submit" className={buttonClass(following ? "quiet" : "secondary", "sm")}>
                    {following ? <Icons.check size={14} aria-hidden /> : <Icons.bell size={14} aria-hidden />}
                    {following ? "Seguindo este meme" : "Seguir meme"}
                  </button>
                </form>
                <form action={toggleFavoriteAction}>
                  <input type="hidden" name="meme_id" value={meme.id} />
                  <input type="hidden" name="return_to" value={viewHref} />
                  <button type="submit" className={buttonClass(favoriting ? "quiet" : "secondary", "sm")}>
                    <Icons.bookmark size={14} aria-hidden />
                    {favoriting ? "Nos favoritos" : "Favoritar"}
                  </button>
                </form>
              </>
            ) : (
              <Link href="/entrar" className={buttonClass("secondary", "sm")}>
                <Icons.signIn size={14} aria-hidden />
                Entrar para seguir ou favoritar
              </Link>
            )}
            {user ? <ReportDialog targetType="meme" targetId={meme.id} /> : null}
            <p className="ml-auto text-[0.75rem] text-ink-3">
              {plural(meme.versions_count, "versão", "versões")} ·{" "}
              <Link href={`/historico/${meme.slug}`} className="underline underline-offset-2 hover:text-ink">
                Ver histórico completo
              </Link>
            </p>
          </div>
        </div>
      </section>

      {meme.status === "hidden" ? (
        <Alert tone="danger" title="Página oculta">
          Esta página foi ocultada pela moderação e não aparece no catálogo.
        </Alert>
      ) : null}

      {/* Article body */}
      {visibleSections.length ? (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,0.22fr)_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="Seções da página" className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-4">
              Nesta página
            </h2>
            <ul className="mt-2.5 space-y-1.5">
              {visibleSections.map((section) => (
                <li key={section.key}>
                  <a
                    href={`#${section.anchor}`}
                    className="text-[0.8125rem] text-ink-2 transition-colors duration-150 hover:text-accent"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
              {gallery.length ? (
                <li>
                  <a href="#galeria" className="text-[0.8125rem] text-ink-2 hover:text-accent">
                    Galeria
                  </a>
                </li>
              ) : null}
              <li>
                <a href="#comentarios" className="text-[0.8125rem] text-ink-2 hover:text-accent">
                  Comentários ({comments.length})
                </a>
              </li>
            </ul>
          </nav>

          <div className="article min-w-0">
            {visibleSections.map((section) => (
              <div key={section.key} className="mb-8">
                <h2 id={section.anchor} className="mb-2 scroll-mt-24 text-xl font-semibold tracking-tight text-ink">
                  {section.title}
                </h2>
                <RichText value={meme[section.key]} />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <Alert tone="info" title="Página sem conteúdo ainda">
          Esta página existe mas não tem texto publicado. Você pode ser a primeira pessoa a escrever a origem
          deste meme.
        </Alert>
      )}

      {gallery.length ? (
        <section id="galeria" className="scroll-mt-24">
          <SectionHeading
            as="h2"
            title="Galeria"
            description="Versões, variações e mídias complementares enviadas pela comunidade."
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((item) => (
              <li key={item.id}>
                <figure className="overflow-hidden rounded-card border border-line bg-surface">
                  <div className="aspect-[4/3] bg-sunken">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.alt || "Imagem da galeria"}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  </div>
                  <figcaption className="flex flex-col gap-1 p-3 text-[0.75rem] text-ink-3">
                    {item.caption ? <span className="text-ink-2">{item.caption}</span> : null}
                    {item.author ? <span>Autor: {item.author}</span> : null}
                    {item.license ? <span>Licença: {item.license}</span> : null}
                    {item.source_url ? (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-ink"
                      >
                        Fonte
                        <Icons.external size={11} aria-hidden />
                      </a>
                    ) : null}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Comments */}
      <section id="comentarios" className="scroll-mt-24">
        <SectionHeading
          as="h2"
          title={`Comentários (${comments.length})`}
          description="Discussões curtas e observações. Para alterar o conteúdo da página, use “Sugerir alteração”."
          action={
            meme.comments_enabled ? (
              <Badge tone="outline" icon={<Icons.chat size={11} aria-hidden />}>
                Comentários abertos
              </Badge>
            ) : (
              <Badge tone="neutral">Comentários desativados nesta página</Badge>
            )
          }
        />
        {meme.comments_enabled && user ? <Panel className="mb-4 p-4"><CommentForm memeId={meme.id} /></Panel> : null}
        {meme.comments_enabled && !user ? (
          <Alert tone="info">
            <Link href="/entrar" className="font-medium underline underline-offset-2">
              Entre na sua conta
            </Link>{" "}
            para comentar nesta página.
          </Alert>
        ) : null}

        {comments.length ? (
          <ul className="flex flex-col gap-2">
            {comments
              .filter((c) => !c.parent_id)
              .map((comment) => (
                <li key={comment.id}>
                  <Panel className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.8125rem] font-semibold text-ink">
                        {comment.author_name ?? "Usuário removido"}
                      </span>
                      <span className="text-[0.75rem] text-ink-4">{relativeTime(comment.created_at)}</span>
                      {user ? (
                        <span className="ml-auto">
                          <ReportDialog targetType="comment" targetId={comment.id} label="Denunciar" />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-line text-[0.875rem] leading-relaxed text-ink-2">
                      {comment.body}
                    </p>
                    {user ? (
                      <div className="mt-2">
                        <ReplyToggle memeId={meme.id} commentId={comment.id} />
                      </div>
                    ) : null}

                    {comments.filter((c) => c.parent_id === comment.id).length ? (
                      <ul className="mt-3 space-y-2 border-l-2 border-line-soft pl-3">
                        {comments
                          .filter((c) => c.parent_id === comment.id)
                          .map((reply) => (
                            <li key={reply.id} className="rounded-control bg-sunken p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[0.75rem] font-semibold text-ink">
                                  {reply.author_name ?? "Usuário removido"}
                                </span>
                                <span className="text-[0.6875rem] text-ink-4">{relativeTime(reply.created_at)}</span>
                              </div>
                              <p className="mt-1 whitespace-pre-line text-[0.8125rem] text-ink-2">{reply.body}</p>
                            </li>
                          ))}
                      </ul>
                    ) : null}
                  </Panel>
                </li>
              ))}
          </ul>
        ) : meme.comments_enabled ? (
          <EmptyState
            icon={<Icons.chat size={22} aria-hidden />}
            title="Nenhum comentário ainda"
            description="Seja a primeira pessoa a comentar nesta página."
          />
        ) : null}
      </section>

      {related.length ? (
        <section>
          <SectionHeading
            as="h2"
            title="Memes relacionados"
            description="Recomendações por categoria, tags compartilhadas e termos em comum."
          />
          <MemeCardGrid memes={related} columns={4} />
        </section>
      ) : null}

      {query.novo ? (
        <Alert tone="ok" title="Página criada">
          A página foi publicada e já está no catálogo.
        </Alert>
      ) : null}
      {query.editado ? (
        <Alert tone="ok" title="Alterações publicadas">
          Uma nova versão foi registrada no histórico da página.
        </Alert>
      ) : null}
      {query.restaurada ? (
        <Alert tone="ok" title="Versão restaurada">
          O conteúdo da versão selecionada volta a ser o atual, e a operação ficou registrada no histórico.
        </Alert>
      ) : null}
    </div>
  );
}
