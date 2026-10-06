import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { listReports } from "@/lib/moderation";
import { resolveReportAction } from "@/app/actions/admin";
import { REPORT_REASONS } from "@/lib/types";
import { formatDateTime, relativeTime } from "@/lib/format";
import { buttonClass, Alert, Badge, EmptyState, Field, Panel, Pagination, StatusBadge, Tabs, Textarea } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata = { title: "Denúncias" };

const PER_PAGE = 15;
const TABS = [
  { key: "open", label: "Abertas" },
  { key: "resolved", label: "Resolvidas" },
  { key: "dismissed", label: "Arquivadas" },
  { key: "all", label: "Todas" },
];

const REASON_LABEL: Record<string, string> = Object.fromEntries(REPORT_REASONS.map((r) => [r.key, r.label]));

const TARGET_LABEL: Record<string, string> = {
  meme: "Página de meme",
  comment: "Comentário",
  user: "Conta de usuário",
  media: "Mídia",
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; pagina?: string; resultado?: string }>;
}) {
  const user = await requireCap("report.moderate");
  const query = await searchParams;
  const status = TABS.some((tab) => tab.key === query.status) ? query.status! : "open";
  const page = Math.max(1, Number(query.pagina ?? "1") || 1);

  const { items, total } = listReports({ status, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Denúncias</h1>
          <p className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink-2">
            Relatos enviados pela comunidade. Resolver ou arquivar envia uma notificação automática a quem denunciou,
            com a nota que você escrever.
          </p>
        </div>
        <Badge tone="neutral">{total} registro(s)</Badge>
      </header>

      {query.resultado ? (
        <Alert tone={query.resultado === "resolved" ? "ok" : "info"} title="Denúncia atualizada">
          {query.resultado === "resolved"
            ? "Marcada como resolvida. O denunciante foi notificado."
            : "Arquivada sem ação. O denunciante foi notificado."}
        </Alert>
      ) : null}

      <Tabs
        current={TABS.find((tab) => tab.key === status)?.label ?? "Abertas"}
        items={TABS.map((tab) => ({ label: tab.label, href: `/admin/denuncias?status=${tab.key}` }))}
      />

      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((report) => (
            <li key={report.id}>
              <Panel className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={report.status} />
                  <Badge tone="warn">{REASON_LABEL[report.reason] ?? report.reason}</Badge>
                  <Badge tone="outline">{TARGET_LABEL[report.target_type] ?? report.target_type}</Badge>
                  <span className="ml-auto text-[0.6875rem] text-ink-4" title={formatDateTime(report.created_at)}>
                    {relativeTime(report.created_at)}
                  </span>
                </div>

                <div className="mt-2">
                  <h2 className="text-[0.9375rem] font-semibold leading-snug text-ink">
                    {report.target_url ? (
                      <Link href={report.target_url} className="hover:text-accent">
                        {report.target_label || `#${report.target_id}`}
                      </Link>
                    ) : (
                      report.target_label || `#${report.target_id}`
                    )}
                  </h2>
                  <p className="mt-1 text-[0.75rem] text-ink-3">
                    Denunciado por{" "}
                    {report.reporter_name ? (
                      <span className="text-ink-2">{report.reporter_name}</span>
                    ) : (
                      "conta removida"
                    )}
                    {report.resolver_name ? ` · analisada por ${report.resolver_name}` : ""}
                  </p>
                </div>

                <p className="mt-2 whitespace-pre-line rounded-control bg-sunken p-3 text-[0.8125rem] leading-relaxed text-ink-2">
                  {report.details}
                </p>

                {report.resolution_note ? (
                  <p className="mt-2 text-[0.8125rem] text-ink-2">
                    <span className="font-medium text-ink">Resolução:</span> {report.resolution_note}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={`/admin/logs?q=${encodeURIComponent(report.target_type)}`} className={buttonClass("quiet", "sm")}>
                    <Icons.logs size={13} aria-hidden />
                    Ver histórico relacionado
                  </Link>
                  {report.target_type === "meme" && report.target_url ? (
                    <Link href={`${report.target_url}`} className={buttonClass("secondary", "sm")}>
                      <Icons.eye size={13} aria-hidden />
                      Abrir página
                    </Link>
                  ) : null}
                </div>

                {report.status === "open" ? (
                  <form action={resolveReportAction} className="mt-4 flex flex-col gap-3 border-t border-line-soft pt-4">
                    <input type="hidden" name="report_id" value={report.id} />
                    <Field
                      label="Nota da resolução"
                      htmlFor={`note-${report.id}`}
                      hint="O denunciante recebe este texto. Diga o que foi verificado e o que foi feito."
                    >
                      <Textarea
                        id={`note-${report.id}`}
                        name="note"
                        rows={2}
                        maxLength={1000}
                        placeholder="Ex.: Conferimos a fonte citada e corrigimos a data na página — obrigado pelo aviso."
                      />
                    </Field>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="submit" name="status" value="resolved" className={buttonClass("primary", "sm")}>
                        <Icons.checkCircle size={14} aria-hidden />
                        Marcar como resolvida
                      </button>
                      <button type="submit" name="status" value="dismissed" className={buttonClass("quiet", "sm")}>
                        <Icons.ban size={14} aria-hidden />
                        Arquivar sem ação
                      </button>
                      <p className="ml-auto text-[0.6875rem] text-ink-4">
                        Resolvido por {user.displayName}
                      </p>
                    </div>
                  </form>
                ) : null}
              </Panel>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Icons.flag size={22} aria-hidden />}
          title="Nenhuma denúncia neste filtro"
          description="Troque o status para ver outros registros."
        />
      )}

      <Pagination page={page} pages={pages} hrefFor={(p) => `/admin/denuncias?status=${status}&pagina=${p}`} />
    </div>
  );
}
