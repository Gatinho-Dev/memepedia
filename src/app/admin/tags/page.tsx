import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { all } from "@/lib/db";
import { renameTagAction } from "@/app/actions/admin";
import { TagForm } from "../admin-forms";
import { buttonClass, Alert, Badge, EmptyState, Input, Panel, PanelHeader, Tabs } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata = { title: "Tags" };

interface TagRow {
  id: number;
  slug: string;
  name: string;
  use_count: number;
  memes: number;
}

export default async function AdminTagsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ordenar?: string }>;
}) {
  await requireCap("tag.manage");
  const query = await searchParams;
  const q = (query.q ?? "").slice(0, 60);
  const order = query.ordenar === "nome" ? "name" : "count";

  const tags = all<TagRow>(
    `SELECT t.id, t.slug, t.name,
            (SELECT COUNT(*) FROM meme_tags mt JOIN memes m ON m.id = mt.meme_id
              WHERE mt.tag_id = t.id AND m.status = 'published') AS use_count,
            (SELECT COUNT(*) FROM meme_tags mt WHERE mt.tag_id = t.id) AS memes
       FROM tags t
      ${q ? "WHERE t.name LIKE ?" : ""}
      ORDER BY ${order === "name" ? "t.name" : "use_count DESC, t.name"}
      LIMIT 200`,
    ...(q ? [`%${q}%`] : []),
  );

  const unused = tags.filter((tag) => tag.memes === 0);
  const total = all<{ n: number }>("SELECT COUNT(*) AS n FROM tags")[0]?.n ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Tags</h1>
          <p className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink-2">
            Tags conectam memes entre categorias. Ao renomear para um nome que já existe, as duas tags são{" "}
            <strong className="text-ink">mescladas</strong>: as páginas passam para a tag de destino e a antiga é
            removida.
          </p>
        </div>
        <Badge tone="neutral">
          {total} tags · {unused.length} sem uso
        </Badge>
      </header>

      <Panel className="p-4 sm:p-5">
        <PanelHeader
          title="Encontrar uma tag"
          description="Busque pelo nome exibido e renomeie direto na lista."
          icon={<Icons.tag size={16} aria-hidden />}
        />
        <form action="/admin/tags" className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.75rem] font-medium text-ink-2">Buscar tag</span>
            <Input name="q" defaultValue={q} placeholder="Ex.: gato" className="w-56" />
          </label>
          <input type="hidden" name="ordenar" value={order} />
          <button type="submit" className={buttonClass("secondary", "md")}>
            <Icons.search size={15} aria-hidden />
            Buscar
          </button>
          {q ? (
            <Link href="/admin/tags" className={buttonClass("quiet", "md")}>
              Limpar
            </Link>
          ) : null}
        </form>
      </Panel>

      <Tabs
        current={order === "name" ? "Alfabética" : "Mais usadas"}
        items={[
          { label: "Mais usadas", href: `/admin/tags?ordenar=count${q ? `&q=${encodeURIComponent(q)}` : ""}` },
          { label: "Alfabética", href: `/admin/tags?ordenar=nome${q ? `&q=${encodeURIComponent(q)}` : ""}` },
        ]}
      />

      {unused.length && !q ? (
        <Alert tone="info" title={`${unused.length} tag(s) sem nenhum meme associado`}>
          Tags órfãs aparecem em nenhum lugar do site. Renomeie para uma tag existente para mesclar, ou deixe como
          estão — elas não atrapalham a navegação.
        </Alert>
      ) : null}

      {tags.length ? (
        <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface">
          {tags.map((tag) => (
            <li key={tag.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link
                href={`/tags/${tag.slug}`}
                className="inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink hover:text-accent"
              >
                <Icons.hash size={13} aria-hidden className="text-ink-4" />
                {tag.name}
              </Link>
              <Badge tone={tag.use_count ? "accent" : "neutral"}>{tag.use_count} páginas</Badge>
              <span className="font-mono text-[0.6875rem] text-ink-4">/{tag.slug}</span>
              <span className="ml-auto">
                <TagForm action={renameTagAction} tag={{ id: tag.id, name: tag.name, slug: tag.slug, use_count: tag.use_count }} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Icons.tag size={22} aria-hidden />}
          title={q ? `Nenhuma tag encontrada para “${q}”` : "Nenhuma tag cadastrada"}
          description="Tags são criadas automaticamente quando uma página é publicada com o campo de tags preenchido."
          action={
            q ? (
              <Link href="/admin/tags" className={buttonClass("secondary", "sm")}>
                Ver todas
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
