import Link from "next/link";
import type { Metadata } from "next";
import { popularMemes, type ViewRange } from "@/lib/memes";
import { Icons } from "@/components/icons";
import { MemeCardGrid } from "@/components/meme-card";
import { Breadcrumbs, EmptyState, SectionHeading, buttonClass } from "@/components/ui";

export const metadata: Metadata = {
  title: "Mais populares",
  description:
    "Os memes mais acessados da Memepedia hoje, nesta semana, neste mês e de todos os tempos.",
  alternates: { canonical: "/populares" },
};

const RANGES: { key: ViewRange; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mês" },
  { key: "all", label: "Sempre" },
];

export default async function PopularPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const params = await searchParams;
  const range = RANGES.find((r) => r.key === params.periodo)?.key ?? "week";
  const memes = await popularMemes(range, 24);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Mais populares" }]} />

      <SectionHeading
        as="h1"
        title="Mais populares"
        description="Ranking por acessos reais nas páginas de meme. O período selecionado define a janela de contagem."
        action={
          <Link href="/aleatorio" className={buttonClass("secondary", "sm")}>
            <Icons.random size={14} aria-hidden />
            Meme aleatório
          </Link>
        }
      />

      <div className="flex flex-wrap gap-1">
        {RANGES.map((item) => (
          <Link
            key={item.key}
            href={item.key === "week" ? "/populares" : `/populares?periodo=${item.key}`}
            scroll={false}
            aria-current={range === item.key ? "true" : undefined}
            className={buttonClass(range === item.key ? "primary" : "quiet", "sm")}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {memes.length ? (
        <MemeCardGrid memes={memes} columns={4} showTags />
      ) : (
        <EmptyState
          title="Sem acessos neste período"
          description="Nenhuma página foi acessada o suficiente para montar este ranking."
        />
      )}
    </div>
  );
}
