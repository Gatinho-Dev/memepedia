import Link from "next/link";
import { currentUser } from "@/lib/auth";
import {
  categoriesWithCounts,
  featuredMemes,
  listMemes,
  popularMemes,
  recentMemes,
  type ViewRange,
} from "@/lib/memes";
import { compactNumber, formatNumber, plural, truncate } from "@/lib/format";
import { Icons } from "@/components/icons";
import { MemeCard } from "@/components/meme-card";
import { Badge, ButtonLink, EmptyState, Panel, SectionHeading, buttonClass } from "@/components/ui";
import { SearchBox } from "@/components/ui-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Memepedia — A enciclopédia livre dos memes da internet",
  alternates: { canonical: "/" },
};

const RANGE_TABS: { key: ViewRange; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mês" },
  { key: "all", label: "Sempre" },
];

const EXAMPLES = ["Doge", "É sobre isso", "Stonks", "Chaves", "Nazaré confusa"];

const STEPS = [
  {
    icon: <Icons.search size={18} aria-hidden />,
    title: "Pesquise",
    text: "Procure um meme pelo nome, por uma tag ou pelo assunto. A busca considera a origem e o conteúdo das páginas.",
  },
  {
    icon: <Icons.book size={18} aria-hidden />,
    title: "Aprenda",
    text: "Cada página explica de onde o meme veio, como passou a ser usado e como evoluiu, com fontes quando existem.",
  },
  {
    icon: <Icons.plus size={18} aria-hidden />,
    title: "Contribua",
    text: "Viu algo errado ou faltando? Envie uma correção. Ela passa por revisão antes de entrar na enciclopédia.",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const params = await searchParams;
  const range = (RANGE_TABS.find((r) => r.key === params.periodo)?.key ?? "week") as ViewRange;
  const [user, featured, popular, recent, categories, totals] = await Promise.all([
    currentUser(),
    featuredMemes(4),
    popularMemes(range, 6),
    recentMemes(3),
    categoriesWithCounts(),
    Promise.all([listMemes({ perPage: 1 }), listMemes({ perPage: 1, sort: "edited" })]),
  ]);

  const totalMemes = totals[0].total;
  const heroFeature = featured[0];
  const heroSide = featured.slice(1, 3);

  return (
    <div className="flex flex-col gap-16 pb-8 sm:gap-20">
      {/* Hero: split, not centered */}
      <section className="grid items-center gap-10 pt-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:pt-10">
        <div>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.25rem]">
            A Wikipédia dos Memes
          </h1>
          <p className="mt-4 max-w-[54ch] text-[1.0625rem] leading-relaxed text-ink-2">
            Descubra a origem, o contexto e a história dos memes que marcaram a internet.
          </p>

          <div className="mt-6 max-w-xl">
            <SearchBox size="lg" variant="hero" placeholder="Pesquise um meme…" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[0.75rem] text-ink-4">Experimente:</span>
            {EXAMPLES.map((example) => (
              <Link
                key={example}
                href={`/buscar?q=${encodeURIComponent(example)}`}
                className="rounded-full border border-line bg-surface px-2.5 py-1 text-[0.75rem] text-ink-2 transition-colors duration-150 hover:border-accent-line hover:text-ink"
              >
                {example}
              </Link>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <ButtonLink href="/memes" size="lg">
              <Icons.compass size={18} aria-hidden />
              Explorar memes
            </ButtonLink>
            <ButtonLink href="/aleatorio" size="lg" variant="secondary">
              <Icons.random size={18} aria-hidden />
              Meme aleatório
            </ButtonLink>
          </div>

          <p className="mt-6 text-[0.8125rem] text-ink-3">
            {plural(totalMemes, "meme documentado", "memes documentados")} ·{" "}
            {plural(categories.length, "categoria", "categorias")} · revisão humana antes de publicar
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
          {heroFeature ? (
            <div className="sm:col-span-2">
              <MemeCard meme={heroFeature} priority showTags />
            </div>
          ) : null}
          {heroSide.map((meme) => (
            <MemeCard key={meme.id} meme={meme} priority />
          ))}
        </div>
      </section>

      {/* Featured */}
      <section>
        <SectionHeading
          title="Memes em destaque"
          description="Seleção da administração: páginas completas, com origem documentada e contexto de uso."
          action={
            <Link href="/memes" className={buttonClass("ghost", "sm")}>
              Ver todos
              <Icons.arrowRight size={14} aria-hidden />
            </Link>
          }
        />
        {featured.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((meme, i) => (
              <MemeCard key={meme.id} meme={meme} priority={i < 2} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Ainda não há memes em destaque"
            description="A administração pode marcar páginas como destaque no painel administrativo."
          />
        )}
      </section>

      {/* Popular: numbered rows + range filter */}
      <section>
        <SectionHeading
          title="Mais populares"
          description="Ordenado por acessos no período. O ranking muda conforme o que as pessoas pesquisam."
          action={
            <div className="flex flex-wrap gap-1">
              {RANGE_TABS.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.key === "week" ? "/" : `/?periodo=${tab.key}`}
                  scroll={false}
                  className={buttonClass(range === tab.key ? "primary" : "quiet", "sm")}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          }
        />
        {popular.length ? (
          <ol className="grid gap-x-8 gap-y-1 md:grid-cols-2">
            {popular.map((meme, i) => (
              <li
                key={meme.id}
                className="group relative flex items-baseline gap-3 border-b border-line-soft py-3"
              >
                <span className="w-6 shrink-0 font-mono text-[0.8125rem] font-semibold text-ink-4 tabular">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[0.9375rem] font-semibold text-ink">
                    <Link href={`/meme/${meme.slug}`} className="after:absolute after:inset-0">
                      {meme.name}
                    </Link>
                  </h3>
                  <p className="truncate text-[0.75rem] text-ink-3">
                    {meme.category_name ? `${meme.category_name} · ` : ""}
                    {compactNumber(meme.views_count)} visualizações
                  </p>
                </div>
                {meme.verified ? (
                  <Icons.verified
                    size={15}
                    weight="fill"
                    className="shrink-0 text-info"
                    aria-label="Verificado"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="Sem dados de acesso ainda" description="O ranking aparece depois dos primeiros acessos." />
        )}
      </section>

      {/* Recent */}
      <section>
        <SectionHeading
          title="Adicionados recentemente"
          description="Últimas páginas aprovadas pela fila de revisão."
          action={
            <Link href="/recentes" className={buttonClass("ghost", "sm")}>
              Ver todas
              <Icons.arrowRight size={14} aria-hidden />
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((meme) => (
            <MemeCard key={meme.id} meme={meme} />
          ))}
        </div>
      </section>

      {/* Categories: chip cloud */}
      <section>
        <SectionHeading
          title="Navegue por categoria"
          description="As categorias organizam o catálogo por formato, tema, plataforma, região e época."
          action={
            <Link href="/categorias" className={buttonClass("ghost", "sm")}>
              Todas as categorias
            </Link>
          }
        />
        <ul className="flex flex-wrap gap-2">
          {categories
            .filter((c) => c.meme_count > 0)
            .map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/categoria/${category.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[0.8125rem] text-ink-2 transition-colors duration-150 hover:border-accent-line hover:text-ink"
                >
                  {category.name}
                  <span className="font-mono text-[0.6875rem] text-ink-4 tabular">{category.meme_count}</span>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      {/* How it works: three steps, hairline separated */}
      <section>
        <SectionHeading
          title="Como a Memepedia funciona"
          description="Uma enciclopédia é feita de contribuições revisadas. Entenda o caminho até a publicação."
        />
        <div className="grid gap-6 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
          {STEPS.map((step, i) => (
            <div key={step.title} className="md:px-6 md:first:pl-0 md:last:pr-0">
              <div className="flex items-center gap-2 text-accent">
                {step.icon}
                <span className="font-mono text-[0.75rem] font-semibold">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-2.5 text-[1.0625rem] font-semibold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-3">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contribute CTA */}
      <section>
        <Panel className="overflow-hidden">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                Ajude a documentar o próximo meme
              </h2>
              <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-2">
                Não precisa ser um texto perfeito. Uma frase como <em>“esse meme é de 2017 e surgiu no
                Twitter”</em> já transforma a página. Nossa triagem e a revisão humana cuidam do resto.
              </p>
              {user ? null : (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.8125rem] text-ink-3">
                  <Icons.info size={14} aria-hidden />
                  É preciso criar uma conta para contribuir.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/contribuir/novo" size="lg">
                <Icons.plus size={18} aria-hidden />
                Adicionar novo meme
              </ButtonLink>
              <ButtonLink href="/contribuir?aba=correcao" size="lg" variant="secondary">
                <Icons.edit size={18} aria-hidden />
                Sugerir correção
              </ButtonLink>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
