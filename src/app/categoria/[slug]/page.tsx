import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategory, listMemes, tagsWithCounts } from "@/lib/memes";
import { formatNumber } from "@/lib/format";
import { Icons } from "@/components/icons";
import { MemeCardGrid } from "@/components/meme-card";
import { Badge, Breadcrumbs, EmptyState, Pagination, SectionHeading } from "@/components/ui";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Categoria não encontrada" };
  return {
    title: category.name,
    description: `Memes da categoria ${category.name} na Memepedia. ${category.description}`,
    alternates: { canonical: `/categoria/${category.slug}` },
    openGraph: { title: `${category.name} — Memepedia`, description: category.description },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = await getCategory(slug);
  if (!category) notFound();

  const page = Math.max(1, Number(query.pagina ?? "1") || 1);
  const result = await listMemes({ category: slug, page, perPage: 12, sort: "popular" });
  const relatedTags = (await tagsWithCounts(40)).filter((tag) => tag.use_count > 0).slice(0, 14);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[{ label: "Início", href: "/" }, { label: "Categorias", href: "/categorias" }, { label: category.name }]}
      />

      <SectionHeading
        as="h1"
        title={category.name}
        description={category.description || `Memes organizados na categoria ${category.name}.`}
        action={<Badge tone="accent">{formatNumber(category.meme_count)} memes</Badge>}
      />

      <div className="flex flex-wrap gap-1.5">
        {relatedTags.map((tag) => (
          <Link
            key={tag.slug}
            href={`/tags/${tag.slug}`}
            className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface px-2.5 py-1 text-[0.75rem] text-ink-2 transition-colors duration-150 hover:border-accent-line hover:text-ink"
          >
            <Icons.hash size={10} aria-hidden />
            {tag.name}
            <span className="font-mono text-[0.625rem] text-ink-4 tabular">{tag.use_count}</span>
          </Link>
        ))}
      </div>

      {result.items.length ? (
        <>
          <MemeCardGrid memes={result.items} showTags priorityCount={2} />
          <Pagination
            page={result.page}
            pages={result.pages}
            hrefFor={(p) => (p === 1 ? `/categoria/${slug}` : `/categoria/${slug}?pagina=${p}`)}
          />
        </>
      ) : (
        <EmptyState
          title="Nenhum meme nesta categoria"
          description="Ainda não há páginas aprovadas aqui. Você pode ser a primeira pessoa a contribuir."
          action={
            <Link href="/contribuir/novo" className="text-[0.8125rem] font-medium text-accent underline underline-offset-2">
              Adicionar um meme
            </Link>
          }
        />
      )}
    </div>
  );
}
