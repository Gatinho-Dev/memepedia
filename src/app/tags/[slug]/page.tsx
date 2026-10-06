import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTag, listMemes, tagsWithCounts } from "@/lib/memes";
import { Icons } from "@/components/icons";
import { MemeCardGrid } from "@/components/meme-card";
import { Breadcrumbs, EmptyState, Pagination, SectionHeading } from "@/components/ui";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTag(slug);
  if (!tag) return { title: "Tag não encontrada" };
  return {
    title: `Tag: ${tag.name}`,
    description: `Memes marcados com a tag “${tag.name}” na Memepedia.`,
    alternates: { canonical: `/tags/${tag.slug}` },
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const tag = await getTag(slug);
  if (!tag) notFound();

  const page = Math.max(1, Number(query.pagina ?? "1") || 1);
  const result = await listMemes({ tag: slug, page, perPage: 12, sort: "popular" });
  const others = (await tagsWithCounts(30)).filter((t) => t.slug !== slug).slice(0, 12);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[{ label: "Início", href: "/" }, { label: "Tags", href: "/tags" }, { label: tag.name }]}
      />

      <SectionHeading
        as="h1"
        title={`#${tag.name}`}
        description="Todos os memes que compartilham esta etiqueta."
        action={
          <Link href="/memes" className="text-[0.8125rem] font-medium text-accent underline underline-offset-2">
            Ver todo o catálogo
          </Link>
        }
      />

      {result.items.length ? (
        <>
          <MemeCardGrid memes={result.items} showTags priorityCount={2} />
          <Pagination
            page={result.page}
            pages={result.pages}
            hrefFor={(p) => (p === 1 ? `/tags/${slug}` : `/tags/${slug}?pagina=${p}`)}
          />
        </>
      ) : (
        <EmptyState title="Nenhum meme com esta tag" description="A etiqueta pode ter sido removida durante uma revisão." />
      )}

      {others.length ? (
        <section className="border-t border-line-soft pt-5">
          <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-3">Outras tags</h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/tags/${other.slug}`}
                  className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface px-2.5 py-1 text-[0.75rem] text-ink-2 transition-colors duration-150 hover:border-accent-line hover:text-ink"
                >
                  <Icons.hash size={10} aria-hidden />
                  {other.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
