import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { categoriesWithCounts } from "@/lib/memes";
import { deleteCategoryAction, saveCategoryAction } from "@/app/actions/admin";
import { CategoryForm } from "../admin-forms";
import { DangerForm } from "../admin-forms";
import { buttonClass, Alert, Badge, EmptyState, Panel, PanelHeader, Tabs } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata = { title: "Categorias" };

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string; erro?: string; excluida?: string }>;
}) {
  await requireCap("category.manage");
  const query = await searchParams;
  const categories = categoriesWithCounts();
  const groups = [...new Set(categories.map((category) => category.group_name))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const groupFilter = groups.includes(query.grupo ?? "") ? query.grupo! : "all";
  const visible = groupFilter === "all" ? categories : categories.filter((c) => c.group_name === groupFilter);
  const emptyCategories = categories.filter((category) => category.meme_count === 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Categorias</h1>
          <p className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink-2">
            A categoria principal de uma página define onde ela aparece no catálogo. Categorias vazias podem ser
            removidas sem perder conteúdo.
          </p>
        </div>
        <Badge tone="neutral">
          {categories.length} categorias · {groups.length} grupos
        </Badge>
      </header>

      {query.excluida ? <Alert tone="ok" title="Categoria removida">A categoria saiu do catálogo.</Alert> : null}
      {query.erro === "em-uso" ? (
        <Alert tone="warn" title="Categoria em uso">
          Existem páginas publicadas nesta categoria. Mova essas páginas para outra categoria antes de excluir, ou
          apenas renomeie a categoria atual.
        </Alert>
      ) : null}

      <Panel className="p-4 sm:p-5">
        <PanelHeader
          title="Nova categoria"
          description="Crie uma categoria nova ou um grupo novo. Ordem menor aparece antes no catálogo."
          icon={<Icons.plus size={16} aria-hidden />}
        />
        <div className="mt-4">
          <CategoryForm action={saveCategoryAction} />
        </div>
      </Panel>

      <Tabs
        current={groupFilter === "all" ? "Todos os grupos" : groupFilter}
        items={[
          { label: "Todos os grupos", href: "/admin/categorias", count: categories.length },
          ...groups.map((group) => ({
            label: group,
            href: `/admin/categorias?grupo=${encodeURIComponent(group)}`,
            count: categories.filter((category) => category.group_name === group).length,
          })),
        ]}
      />

      {emptyCategories.length ? (
        <Alert tone="info" title={`${emptyCategories.length} categoria(s) sem páginas`}>
          Espaço vazio no catálogo: {emptyCategories.map((category) => category.name).join(", ")}. Considere mesclar
          ou remover.
        </Alert>
      ) : null}

      {visible.length ? (
        <ul className="flex flex-col gap-3">
          {visible.map((category) => (
            <li key={category.id}>
              <Panel className="p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.9375rem] font-semibold text-ink">{category.name}</span>
                      <Badge tone="outline">{category.group_name}</Badge>
                      <Badge tone={category.meme_count ? "accent" : "neutral"}>
                        {category.meme_count} página(s)
                      </Badge>
                      <span className="font-mono text-[0.6875rem] text-ink-4">ordem {category.sort_order}</span>
                    </div>
                    <p className="mt-1 text-[0.75rem] text-ink-3">
                      <Link href={`/categoria/${category.slug}`} className="underline underline-offset-2 hover:text-ink">
                        /categoria/{category.slug}
                      </Link>
                      {category.description ? ` · ${category.description}` : " · sem descrição"}
                    </p>
                  </div>

                  <details className="w-full sm:w-80">
                    <summary className={buttonClass("secondary", "sm")}>Editar categoria</summary>
                    <div className="mt-3 rounded-control bg-sunken p-3">
                      <CategoryForm action={saveCategoryAction} category={category} />
                    </div>
                  </details>

                  <DangerForm
                    action={deleteCategoryAction}
                    fields={{ category_id: category.id }}
                    triggerLabel="Excluir"
                    title={`Excluir a categoria “${category.name}”?`}
                    description="A exclusão só é permitida quando não há páginas publicadas nesta categoria. A ação é registrada no log de auditoria."
                    confirmLabel="Excluir categoria"
                    variant="quiet"
                  />
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Icons.category size={22} aria-hidden />}
          title="Nenhuma categoria neste grupo"
          description="Troque o grupo ou crie uma categoria nova no formulário acima."
        />
      )}

      <Panel className="p-4">
        <p className="text-[0.8125rem] leading-relaxed text-ink-3">
          Renomear o endereço de uma categoria quebra links externos. Se a intenção é só ajustar o nome exibido,
          mantenha o campo “Endereço” como está.
        </p>
      </Panel>
    </div>
  );
}
