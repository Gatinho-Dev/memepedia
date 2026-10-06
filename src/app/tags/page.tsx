import Link from "next/link";
import type { Metadata } from "next";
import { tagsWithCounts } from "@/lib/memes";
import { Icons } from "@/components/icons";
import { Breadcrumbs, EmptyState, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Tags",
  description: "Todas as tags usadas nas páginas de meme da Memepedia.",
  alternates: { canonical: "/tags" },
};

export default async function TagsPage() {
  const tags = await tagsWithCounts(200);
  const max = Math.max(1, ...tags.map((t) => t.use_count));

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Tags" }]} />

      <SectionHeading
        as="h1"
        title="Tags"
        description="As tags ligam memes entre si. Quanto maior a contagem, mais páginas compartilham a mesma etiqueta."
      />

      {tags.length ? (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const weight = tag.use_count / max;
            return (
              <li key={tag.slug}>
                <Link
                  href={`/tags/${tag.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-ink-2 transition-colors duration-150 hover:border-accent-line hover:text-ink"
                  style={{ fontSize: `${0.8125 + weight * 0.375}rem` }}
                >
                  <Icons.hash size={12} aria-hidden />
                  {tag.name}
                  <span className="font-mono text-[0.6875rem] text-ink-4 tabular">{tag.use_count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="Nenhuma tag em uso" description="As tags aparecem conforme as páginas vão sendo criadas." />
      )}
    </div>
  );
}
