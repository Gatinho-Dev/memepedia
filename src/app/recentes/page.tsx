import type { Metadata } from "next";
import { listMemes } from "@/lib/memes";
import { formatNumber } from "@/lib/format";
import { Icons } from "@/components/icons";
import { MemeCardGrid } from "@/components/meme-card";
import { Breadcrumbs, EmptyState, Pagination, SectionHeading } from "@/components/ui";
import { Badge } from "@/components/ui";

export const metadata: Metadata = {
  title: "Adicionados recentemente",
  description: "As últimas páginas de meme aprovadas pela fila de revisão da Memepedia.",
  alternates: { canonical: "/recentes" },
};

const PER_PAGE = 24;

export default async function RecentPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.pagina ?? "1") || 1);
  const result = await listMemes({ sort: "recent", page, perPage: PER_PAGE });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Recentes" }]} />

      <SectionHeading
        as="h1"
        title="Memes adicionados recentemente"
        description={`${formatNumber(result.total)} páginas publicadas. Toda entrada passa por revisão antes de aparecer aqui.`}
        action={<Badge tone="outline" icon={<Icons.clock size={11} aria-hidden />}>Ordenado por criação</Badge>}
      />

      {result.items.length ? (
        <>
          <MemeCardGrid memes={result.items} columns={4} showTags priorityCount={3} />
          <Pagination
            page={result.page}
            pages={result.pages}
            hrefFor={(p) => (p === 1 ? "/recentes" : `/recentes?pagina=${p}`)}
          />
        </>
      ) : (
        <EmptyState
          title="Nada publicado ainda"
          description="As primeiras páginas aprovadas aparecerão nesta lista."
        />
      )}
    </div>
  );
}
