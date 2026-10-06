import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { listMemesAdmin } from "@/lib/admin";
import { can } from "@/lib/permissions";
import { PROTECTION_LABEL, type ProtectionLevel } from "@/lib/types";
import { compactNumber, relativeTime } from "@/lib/format";
import {
  HardDeleteForm,
  MemeFlagButton,
  ProtectForm,
  type FlagAction,
} from "./meme-actions";
import { memeFlagAction } from "@/app/actions/admin";
import {
  Badge,
  ButtonLink,
  EmptyState,
  Input,
  Panel,
  Pagination,
  StatusBadge,
  Tabs,
} from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata = { title: "Conteúdo" };

const STATUS_TABS = [
  { key: "all", label: "Todos" },
  { key: "published", label: "Publicados" },
  { key: "hidden", label: "Ocultos" },
  { key: "deleted", label: "Excluídos" },
];

export default async function AdminMemesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; pagina?: string; resultado?: string; excluido?: string; erro?: string }>;
}) {
  const user = await requireCap("meme.delete");
  const query = await searchParams;
  const status = STATUS_TABS.some((tab) => tab.key === query.status) ? query.status! : "all";
  const page = Math.max(1, Number(query.pagina ?? "1") || 1);
  const q = (query.q ?? "").slice(0, 80);

  const { items, total, perPage } = listMemesAdmin({ q, status, page, perPage: 20 });
  const pages = Math.max(1, Math.ceil(total / perPage));

  const canVerify = can(user.role, "meme.verify");
  const canFeature = can(user.role, "meme.feature");
  const canProtect = can(user.role, "meme.protect");
  const canRestore = can(user.role, "meme.restore");
  const canHardDelete = can(user.role, "content.hard_delete");
  const canEditContent = can(user.role, "meme.edit_direct");

  const flag = (action: FlagAction, memeId: number): { action: FlagAction; meme_id: number } => ({ action, meme_id: memeId });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Conteúdo</h1>
          <p className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink-2">
            Todas as páginas, inclusive ocultas e excluídas logicamente. Ocultar é reversível e some do catálogo;
            excluir permanentemente apaga versões, mídias e comentários e não tem volta.
          </p>
        </div>
        <Badge tone="neutral">{total} página(s)</Badge>
      </header>

      {query.resultado === "ok" ? (
        <Panel className="border-ok/40 bg-ok-soft p-3 text-[0.8125rem] text-ink">
          Ação aplicada e registrada no log de auditoria.
        </Panel>
      ) : null}
      {query.excluido ? (
        <Panel className="border-danger/40 bg-danger-soft p-3 text-[0.8125rem] text-ink">
          A página foi excluída permanentemente do banco de dados.
        </Panel>
      ) : null}
      {query.resultado === "erro" ? (
        <Panel className="border-warn/40 bg-warn-soft p-3 text-[0.8125rem] text-ink">
          Não foi possível aplicar a ação. Verifique se a página ainda existe.
        </Panel>
      ) : null}
      {query.erro ? (
        <Panel className="border-warn/40 bg-warn-soft p-3 text-[0.8125rem] text-ink">
          {query.erro === "nivel"
            ? "Nível de proteção inválido. Escolha uma das quatro opções disponíveis."
            : query.erro === "meme"
              ? "A página não existe mais no banco de dados."
              : "Ação não reconhecida. Recarregue a página e tente novamente."}
        </Panel>
      ) : null}

      <Panel className="flex flex-wrap items-end gap-3 p-4">
        <form className="flex flex-wrap items-end gap-2" action="/admin/memes">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.75rem] font-medium text-ink-2">Buscar por nome</span>
            <Input name="q" defaultValue={q} placeholder="Ex.: doge" className="w-56" />
          </label>
          <input type="hidden" name="status" value={status} />
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-control border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-line-strong"
          >
            <Icons.search size={15} aria-hidden />
            Filtrar
          </button>
          {q ? (
            <ButtonLink href={`/admin/memes?status=${status}`} variant="quiet" size="md">
              Limpar
            </ButtonLink>
          ) : null}
        </form>
        <div className="ml-auto flex flex-wrap gap-2">
          <ButtonLink href="/contribuir/novo" variant="secondary" size="sm">
            <Icons.plus size={14} aria-hidden />
            Nova página
          </ButtonLink>
        </div>
      </Panel>

      <Tabs
        current={STATUS_TABS.find((tab) => tab.key === status)?.label ?? "Todos"}
        items={STATUS_TABS.map((tab) => ({
          label: tab.label,
          href: `/admin/memes?status=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
        }))}
      />

      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((meme) => (
            <li key={meme.id}>
              <Panel className="p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <span className="size-20 shrink-0 overflow-hidden rounded-control bg-sunken">
                    {meme.thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={meme.thumb_url}
                        alt=""
                        width={80}
                        height={80}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="grid size-full place-items-center text-ink-4" aria-hidden>
                        <Icons.media size={20} />
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={meme.status} />
                      <Badge tone={meme.protection === "free" ? "neutral" : "warn"}>
                        {PROTECTION_LABEL[meme.protection as ProtectionLevel] ?? meme.protection}
                      </Badge>
                      {meme.verified ? <Badge tone="info">verificado</Badge> : null}
                      {meme.featured ? <Badge tone="accent">destaque</Badge> : null}
                      {meme.is_demo ? <Badge tone="neutral">demonstração</Badge> : null}
                      {meme.pending ? <Badge tone="warn">{meme.pending} pendente(s)</Badge> : null}
                    </div>

                    <h2 className="mt-1.5 text-[1rem] font-semibold leading-snug text-ink">
                      <Link href={`/meme/${meme.slug}`} className="hover:text-accent">
                        {meme.name}
                      </Link>
                    </h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-3 tabular">
                      <span>{meme.category_name ?? "sem categoria"}</span>
                      <span>{compactNumber(meme.views_count)} visualizações</span>
                      <span>{meme.versions_count} versões</span>
                      <span>{meme.contributions_count} contribuições</span>
                      <span className="text-ink-4">atualizada {relativeTime(meme.updated_at)}</span>
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {meme.status !== "deleted" ? (
                        <ButtonLink href={`/meme/${meme.slug}`} variant="secondary" size="sm">
                          <Icons.eye size={13} aria-hidden />
                          Abrir
                        </ButtonLink>
                      ) : null}
                      <ButtonLink href={`/historico/${meme.slug}`} variant="quiet" size="sm">
                        <Icons.history size={13} aria-hidden />
                        Histórico
                      </ButtonLink>
                      {canEditContent && meme.status !== "deleted" ? (
                        <ButtonLink href={`/meme/${meme.slug}/editar`} variant="quiet" size="sm">
                          <Icons.edit size={13} aria-hidden />
                          Editar
                        </ButtonLink>
                      ) : null}
                      {canVerify ? (
                        <MemeFlagButton
                          action={flag(meme.verified ? "unverify" : "verify", meme.id)}
                          serverAction={memeFlagAction}
                          label={meme.verified ? "Remover verificação" : "Verificar"}
                          icon={meme.verified ? "checkCircle" : "verified"}
                        />
                      ) : null}
                      {canFeature ? (
                        <MemeFlagButton
                          action={flag(meme.featured ? "unfeature" : "feature", meme.id)}
                          serverAction={memeFlagAction}
                          label={meme.featured ? "Remover destaque" : "Destacar"}
                          icon="star"
                        />
                      ) : null}
                      {meme.comments_enabled ? (
                        <MemeFlagButton
                          action={{ action: "toggle_comments", meme_id: meme.id, enabled: "" }}
                          serverAction={memeFlagAction}
                          label="Desativar comentários"
                          icon="chat"
                        />
                      ) : (
                        <MemeFlagButton
                          action={{ action: "toggle_comments", meme_id: meme.id, enabled: "1" }}
                          serverAction={memeFlagAction}
                          label="Ativar comentários"
                          icon="chat"
                        />
                      )}
                      {meme.status === "published" ? (
                        <HardDeleteForm
                          variant="hide"
                          memeId={meme.id}
                          name={meme.name}
                          serverAction={memeFlagAction}
                        />
                      ) : null}
                      {meme.status === "hidden" && canRestore ? (
                        <HardDeleteForm
                          variant="restore"
                          memeId={meme.id}
                          name={meme.name}
                          serverAction={memeFlagAction}
                        />
                      ) : null}
                      {meme.status !== "deleted" && can(user.role, "meme.delete") ? (
                        <HardDeleteForm
                          variant="delete"
                          memeId={meme.id}
                          name={meme.name}
                          serverAction={memeFlagAction}
                        />
                      ) : null}
                      {meme.status === "deleted" && canRestore ? (
                        <HardDeleteForm
                          variant="restore"
                          memeId={meme.id}
                          name={meme.name}
                          serverAction={memeFlagAction}
                        />
                      ) : null}
                      {canHardDelete ? (
                        <HardDeleteForm
                          variant="hard"
                          memeId={meme.id}
                          name={meme.name}
                        />
                      ) : null}
                    </div>
                  </div>

                  {canProtect ? (
                    <div className="w-full border-t border-line-soft pt-3 sm:w-56 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                      <ProtectForm memeId={meme.id} protection={meme.protection} serverAction={memeFlagAction} />
                    </div>
                  ) : null}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Icons.book size={22} aria-hidden />}
          title="Nenhuma página neste filtro"
          description="Ajuste a busca ou troque o status para ver outros registros."
          action={
            <ButtonLink href="/admin/memes" variant="secondary" size="sm">
              Ver todas
            </ButtonLink>
          }
        />
      )}

      <Pagination
        page={page}
        pages={pages}
        hrefFor={(p) => `/admin/memes?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}&pagina=${p}`}
      />
    </div>
  );
}
