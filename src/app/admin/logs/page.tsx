import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { auditLogList } from "@/lib/admin";
import { formatDateTime, relativeTime } from "@/lib/format";
import { buttonClass, Badge, EmptyState, Input, Panel, Pagination, Tabs } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata = { title: "Logs de auditoria" };

const PER_PAGE = 30;
const TABS = [
  { key: "all", label: "Todas" },
  { key: "ok", label: "Concluídas" },
  { key: "negado", label: "Negadas" },
  { key: "erro", label: "Com erro" },
];

function metaSummary(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return "";
    const entries = Object.entries(parsed as Record<string, unknown>).slice(0, 4);
    return entries
      .map(([key, value]) => {
        const text = Array.isArray(value) ? value.join(", ") : String(value);
        return `${key}: ${text.length > 60 ? `${text.slice(0, 60)}…` : text}`;
      })
      .join(" · ");
  } catch {
    return "";
  }
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; result?: string; pagina?: string }>;
}) {
  await requireCap("logs.view");
  const query = await searchParams;
  const q = (query.q ?? "").slice(0, 80);
  const result = TABS.some((tab) => tab.key === query.result) ? query.result! : "all";
  const page = Math.max(1, Number(query.pagina ?? "1") || 1);

  const { items, total } = auditLogList({
    q,
    result,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Logs de auditoria</h1>
          <p className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink-2">
            Registro incremental de tudo que muda conteúdo, contas e configurações. Só cresce: não existe ação na
            interface capaz de editar ou apagar uma linha daqui.
          </p>
        </div>
        <Badge tone="neutral">{total} registro(s)</Badge>
      </header>

      <Panel className="p-4">
        <form action="/admin/logs" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.75rem] font-medium text-ink-2">Buscar</span>
            <Input name="q" defaultValue={q} placeholder="ação, autor ou tipo de recurso" className="w-72" />
          </label>
          <input type="hidden" name="result" value={result} />
          <button type="submit" className={buttonClass("secondary", "md")}>
            <Icons.search size={15} aria-hidden />
            Buscar
          </button>
          {q ? (
            <Link href={`/admin/logs?result=${result}`} className={buttonClass("quiet", "md")}>
              Limpar
            </Link>
          ) : null}
          <p className="ml-auto text-[0.75rem] text-ink-4">
            Dica: use o nome de um usuário para ver tudo que ele fez.
          </p>
        </form>
      </Panel>

      <Tabs
        current={TABS.find((tab) => tab.key === result)?.label ?? "Todas"}
        items={TABS.map((tab) => ({
          label: tab.label,
          href: `/admin/logs?result=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
        }))}
      />

      {items.length ? (
        <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface">
          {items.map((entry) => {
            const summary = metaSummary(entry.meta);
            return (
              <li key={entry.id} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-[0.75rem] text-accent">{entry.action}</span>
                  <Badge
                    tone={entry.result === "ok" ? "ok" : entry.result === "negado" ? "warn" : "danger"}
                  >
                    {entry.result}
                  </Badge>
                  <span className="text-[0.8125rem] text-ink-2">{entry.actor_name}</span>
                  {entry.resource_type ? (
                    <span className="text-[0.75rem] text-ink-4">
                      {entry.resource_type}
                      {entry.resource_id ? ` #${entry.resource_id}` : ""}
                    </span>
                  ) : null}
                  <span className="ml-auto text-[0.6875rem] text-ink-4" title={formatDateTime(entry.created_at)}>
                    {relativeTime(entry.created_at)}
                  </span>
                </div>
                {summary ? <p className="text-[0.75rem] leading-relaxed text-ink-3">{summary}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<Icons.logs size={22} aria-hidden />}
          title="Nenhum registro encontrado"
          description="Ajuste a busca ou troque o filtro de resultado."
        />
      )}

      <Pagination
        page={page}
        pages={pages}
        hrefFor={(p) => `/admin/logs?result=${result}${q ? `&q=${encodeURIComponent(q)}` : ""}&pagina=${p}`}
      />
    </div>
  );
}
