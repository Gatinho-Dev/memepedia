import Link from "next/link";
import type { Metadata } from "next";
import {
  allCategories,
  countries,
  listMemes,
  mediaKinds,
  type ListOptions,
  type MemeSort,
} from "@/lib/memes";
import { formatNumber } from "@/lib/format";
import { Icons } from "@/components/icons";
import { MemeCardGrid } from "@/components/meme-card";
import { Badge, Breadcrumbs, EmptyState, Pagination, SectionHeading, Select, buttonClass } from "@/components/ui";
import { SearchBox } from "@/components/ui-client";

export const metadata: Metadata = {
  title: "Explorar memes",
  description:
    "Catálogo completo da Memepedia: pesquise, filtre por categoria, década, país e tipo de mídia, e ordene por popularidade, data ou número de edições.",
  alternates: { canonical: "/memes" },
};

const SORTS: { key: MemeSort; label: string }[] = [
  { key: "popular", label: "Mais populares" },
  { key: "recent", label: "Mais recentes" },
  { key: "oldest", label: "Mais antigos" },
  { key: "edited", label: "Mais editados" },
  { key: "alpha", label: "Ordem alfabética" },
  { key: "random", label: "Aleatório" },
];

const DECADES = [
  { key: "", label: "Todas as décadas" },
  { key: "anterior", label: "Antes de 2000" },
  { key: "2000", label: "Anos 2000" },
  { key: "2010", label: "Anos 2010" },
  { key: "2020", label: "Anos 2020" },
  { key: "atuais", label: "Atuais (2025+)" },
];

const POPULARITY = [
  { key: "", label: "Qualquer popularidade" },
  { key: "1", label: "Algum acesso" },
  { key: "200", label: "Acessado com frequência" },
  { key: "1000", label: "Muito acessado" },
];

const CREATED = [
  { key: "", label: "Qualquer data de criação" },
  { key: "7", label: "Criado nos últimos 7 dias" },
  { key: "30", label: "Criado no último mês" },
  { key: "180", label: "Criado nos últimos 6 meses" },
];

const UPDATED = [
  { key: "", label: "Qualquer atualização" },
  { key: "1", label: "Atualizado hoje" },
  { key: "7", label: "Atualizado nesta semana" },
  { key: "30", label: "Atualizado neste mês" },
];

const PER_PAGE = 12;

type Params = Record<string, string | undefined>;

function buildHref(params: Params, patch: Params): string {
  const merged: Params = { ...params, ...patch };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value && key !== "pagina") search.set(key, value);
  }
  const qs = search.toString();
  return `/memes${qs ? `?${qs}` : ""}`;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.pagina ?? "1") || 1);
  const sort = (SORTS.find((s) => s.key === params.ordenar)?.key ?? "popular") as MemeSort;
  const minPopularity = params.popularidade ? Number(params.popularidade) : undefined;
  const createdWithin = params.criado ? Number(params.criado) : undefined;
  const updatedWithin = params.atualizado ? Number(params.atualizado) : undefined;

  const options: ListOptions = {
    q: params.q,
    category: params.categoria,
    decade: params.decada,
    country: params.pais,
    kind: params.tipo,
    minPopularity: minPopularity && minPopularity > 0 ? minPopularity : undefined,
    createdWithin,
    updatedWithin,
    sort,
    page,
    perPage: PER_PAGE,
  };

  const [result, categories, countryList, kinds] = await Promise.all([
    listMemes(options),
    allCategories(),
    countries(),
    mediaKinds(),
  ]);

  const hasFilters = Boolean(
    params.q || params.categoria || params.decada || params.pais || params.tipo || params.popularidade || params.criado,
  );

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Explorar memes" }]} />

      <SectionHeading
        as="h1"
        title="Explorar memes"
        description={`${formatNumber(result.total)} páginas catalogadas. Combine filtros para restringir o catálogo ou busque por um nome específico.`}
        action={
          <Link href="/contribuir/novo" className={buttonClass("secondary", "sm")}>
            <Icons.plus size={14} aria-hidden />
            Adicionar meme
          </Link>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="w-full lg:max-w-xs">
          <SearchBox placeholder="Buscar por nome ou conteúdo…" initialValue={params.q ?? ""} />
        </div>

        <form
          method="get"
          action="/memes"
          className="grid flex-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
          role="search"
        >
          {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
          {params.ordenar ? <input type="hidden" name="ordenar" value={params.ordenar} /> : null}

          <label className="flex flex-col gap-1">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-3">Categoria</span>
            <Select name="categoria" defaultValue={params.categoria ?? ""}>
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-3">Década</span>
            <Select name="decada" defaultValue={params.decada ?? ""}>
              {DECADES.map((decade) => (
                <option key={decade.key || "all"} value={decade.key}>
                  {decade.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-3">País</span>
            <Select name="pais" defaultValue={params.pais ?? ""}>
              <option value="">Todos</option>
              {countryList.map((c) => (
                <option key={c.country} value={c.country}>
                  {c.country} ({c.n})
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-3">Tipo de mídia</span>
            <Select name="tipo" defaultValue={params.tipo ?? ""}>
              <option value="">Todos</option>
              {kinds.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.kind === "gif" ? "GIF animado" : k.kind === "video" ? "Vídeo" : "Imagem"} ({k.n})
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-3">Popularidade</span>
            <Select name="popularidade" defaultValue={params.popularidade ?? ""}>
              {POPULARITY.map((p) => (
                <option key={p.key || "all"} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-3">Criação</span>
            <Select name="criado" defaultValue={params.criado ?? ""}>
              {CREATED.map((p) => (
                <option key={p.key || "all"} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-3">Atualização</span>
            <Select name="atualizado" defaultValue={params.atualizado ?? ""}>
              {UPDATED.map((p) => (
                <option key={p.key || "all"} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </label>

          <div className="flex items-end gap-2">
            <button type="submit" className={buttonClass("secondary", "md", "w-full")}>
              <Icons.filter size={15} aria-hidden />
              Aplicar filtros
            </button>
            {hasFilters ? (
              <Link
                href="/memes"
                className={buttonClass("ghost", "md")}
                title="Remover todos os filtros"
                aria-label="Remover todos os filtros"
              >
                <Icons.close size={16} aria-hidden />
              </Link>
            ) : null}
          </div>
        </form>
      </div>

      <div className="scroll-x -mx-1 flex items-center gap-1 border-y border-line-soft px-1 py-2">
        <span className="mr-1 shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-4">
          Ordenar
        </span>
        {SORTS.map((item) => (
          <Link
            key={item.key}
            href={buildHref(params, { ordenar: item.key })}
            scroll={false}
            aria-current={sort === item.key ? "true" : undefined}
            className={buttonClass(sort === item.key ? "primary" : "quiet", "sm", "shrink-0")}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[0.75rem] text-ink-3">Filtros ativos:</span>
          {params.categoria ? (
            <Badge tone="outline" icon={<Icons.close size={10} aria-hidden />}>
              {categories.find((c) => c.slug === params.categoria)?.name ?? params.categoria}
            </Badge>
          ) : null}
          {params.q ? <Badge tone="outline">busca: {params.q}</Badge> : null}
          {params.decada ? <Badge tone="outline">década: {params.decada}</Badge> : null}
          {params.pais ? <Badge tone="outline">país: {params.pais}</Badge> : null}
          {params.tipo ? <Badge tone="outline">tipo: {params.tipo}</Badge> : null}
        </div>
      ) : null}

      {result.items.length ? (
        <>
          <MemeCardGrid memes={result.items} showTags priorityCount={3} />
          <Pagination
            page={result.page}
            pages={result.pages}
            hrefFor={(p) => (p === 1 ? buildHref(params, {}) : `${buildHref(params, {})}&pagina=${p}`)}
          />
        </>
      ) : (
        <EmptyState
          icon={<Icons.search size={24} aria-hidden />}
          title="Nenhum meme encontrado"
          description="Tente remover alguns filtros ou buscar por outro termo. Se o meme ainda não existe na Memepedia, você pode sugerir a criação da página."
          action={
            <Link href="/contribuir/novo" className={buttonClass("primary", "sm")}>
              <Icons.plus size={14} aria-hidden />
              Adicionar este meme
            </Link>
          }
        />
      )}
    </div>
  );
}
