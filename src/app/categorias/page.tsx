import Link from "next/link";
import type { Metadata } from "next";
import { categoriesWithCounts } from "@/lib/memes";
import { Icons } from "@/components/icons";
import { Breadcrumbs, EmptyState, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Categorias",
  description:
    "Todas as categorias da Memepedia, agrupadas por formato, tema, plataforma, região e época.",
  alternates: { canonical: "/categorias" },
};

export default async function CategoriesPage() {
  const categories = await categoriesWithCounts();
  const groups = new Map<string, typeof categories>();
  for (const category of categories) {
    const list = groups.get(category.group_name) ?? [];
    list.push(category);
    groups.set(category.group_name, list);
  }

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Categorias" }]} />

      <SectionHeading
        as="h1"
        title="Categorias"
        description="Cada meme tem uma categoria principal e pode pertencer a outras. Escolha uma para ver o catálogo correspondente."
      />

      {categories.length === 0 ? (
        <EmptyState title="Nenhuma categoria criada" description="A administração cria as categorias no painel administrativo." />
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {[...groups.entries()].map(([group, list]) => (
            <section key={group}>
              <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-3">{group}</h2>
              <ul className="mt-3 divide-y divide-line-soft border-t border-line-soft">
                {list.map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={`/categoria/${category.slug}`}
                      className="flex items-center justify-between gap-3 py-3 transition-colors duration-150 hover:text-accent"
                    >
                      <span className="min-w-0">
                        <span className="block text-[0.9375rem] font-medium text-ink">{category.name}</span>
                        {category.description ? (
                          <span className="mt-0.5 block truncate text-[0.75rem] text-ink-3">
                            {category.description}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 font-mono text-[0.75rem] text-ink-3 tabular">
                        {category.meme_count}
                        <Icons.caretRight size={12} className="text-ink-4" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
