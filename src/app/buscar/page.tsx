import Link from "next/link";
import type { Metadata } from "next";
import { listMemes, listMemesByIds, searchMemes, searchUsers } from "@/lib/memes";
import { formatNumber } from "@/lib/format";
import { Icons } from "@/components/icons";
import { MemeCardGrid } from "@/components/meme-card";
import { Breadcrumbs, EmptyState, Panel, SectionHeading, buttonClass } from "@/components/ui";
import { SearchBox } from "@/components/ui-client";

export const metadata: Metadata = {
  title: "Busca",
  description: "Resultados de busca na enciclopédia de memes.",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();

  if (!term) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Busca" }]} />
        <SectionHeading as="h1" title="Buscar na Memepedia" description="Pesquise por nome, descrição, tag, categoria ou conteúdo da página." />
        <div className="max-w-xl">
          <SearchBox size="lg" autoFocus variant="hero" />
        </div>
      </div>
    );
  }

  const [hits, users, fallback] = await Promise.all([
    searchMemes(term, 24),
    searchUsers(term, 4),
    listMemes({ q: term, perPage: 8, sort: "popular" }),
  ]);
  // Ranked FTS hits are turned back into full cards so the grid stays uniform.
  const items = listMemesByIds(hits.map((hit) => hit.id));

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Busca" }]} />

      <SectionHeading
        as="h1"
        title={`Resultados para “${term}”`}
        description={`${formatNumber(items.length)} página(s) encontrada(s). A busca considera nome, descrição, origem, história, curiosidades, categoria e tags.`}
      />

      <div className="max-w-xl">
        <SearchBox initialValue={term} />
      </div>

      {items.length ? (
        <MemeCardGrid memes={items} showTags />
      ) : (
        <EmptyState
          icon={<Icons.search size={24} aria-hidden />}
          title="Nenhum resultado"
          description={
            fallback.items.length
              ? "Não encontramos no texto completo, mas estes memes são próximos do termo:"
              : "Nada encontrado com esse termo. Se o meme não está catalogado, você pode criar a página."
          }
          action={
            fallback.items.length ? null : (
              <Link href={`/contribuir/novo?nome=${encodeURIComponent(term)}`} className={buttonClass("primary", "sm")}>
                <Icons.plus size={14} aria-hidden />
                Criar página para “{term}”
              </Link>
            )
          }
        />
      )}

      {!items.length && fallback.items.length ? <MemeCardGrid memes={fallback.items} showTags /> : null}

      {users.length ? (
        <section>
          <h2 className="mb-3 text-[0.9375rem] font-semibold text-ink">Usuários com nome parecido</h2>
          <Panel className="divide-y divide-line-soft">
            {users.map((user) => (
              <Link
                key={user.id}
                href={`/perfil/${user.username}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-sunken"
              >
                <Icons.user size={16} className="text-ink-4" aria-hidden />
                <span className="text-[0.875rem] font-medium text-ink">{user.display_name}</span>
                <span className="text-[0.75rem] text-ink-3">@{user.username}</span>
                <Icons.arrowRight size={14} className="ml-auto text-ink-4" aria-hidden />
              </Link>
            ))}
          </Panel>
        </section>
      ) : null}

      {items.length ? (
        <p className="text-[0.75rem] text-ink-4">
          A busca também considera a origem e a história dos memes, não apenas o nome.
        </p>
      ) : null}
    </div>
  );
}
