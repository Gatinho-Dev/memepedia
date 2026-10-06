import Link from "next/link";
import {
  dashboardStats,
  growthTrend,
  mostActiveUsers,
  mostViewed,
  recentActivity,
  topCategories,
  viewsTrend,
} from "@/lib/admin";
import { listContributions, listReports } from "@/lib/moderation";
import { compactNumber, formatDate, formatNumber, relativeTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/types";
import { Icons } from "@/components/icons";
import { RankBars, TrendBars } from "@/components/chart";
import {
  Badge,
  ButtonLink,
  EmptyState,
  Panel,
  PanelHeader,
  StatTile,
  StatusBadge,
} from "@/components/ui";

export const metadata = { title: "Visão geral" };

export default async function AdminDashboardPage() {
  const stats = dashboardStats();
  const views = viewsTrend(14);
  const growth = growthTrend(6);
  const viewed = mostViewed(6);
  const categories = topCategories(6);
  const activeUsers = mostActiveUsers(6);
  const activity = recentActivity(10);
  const queue = listContributions({ status: "pending", limit: 5 });
  const reports = listReports({ status: "open", limit: 5 });

  const approvalRate =
    stats.pendingTotal + stats.versions > 0
      ? Math.round((1 - stats.pendingTotal / Math.max(1, stats.versions + stats.pendingTotal)) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Visão geral</h1>
          <p className="mt-1.5 text-[0.9375rem] text-ink-2">
            O estado da enciclopédia agora: fila de revisão, tráfego, conteúdo e comunidade.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/revisao" size="sm">
            <Icons.note size={14} aria-hidden />
            Abrir fila de revisão
          </ButtonLink>
          <ButtonLink href="/contribuir/novo" variant="secondary" size="sm">
            <Icons.plus size={14} aria-hidden />
            Criar página
          </ButtonLink>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Páginas publicadas"
          value={formatNumber(stats.memes)}
          hint={`${stats.memesHidden} ocultas · ${stats.memesDeleted} excluídas`}
          icon={<Icons.book size={15} aria-hidden />}
        />
        <StatTile
          label="Fila de revisão"
          value={formatNumber(stats.pendingTotal)}
          hint={`${stats.pendingMemes} memes novos · ${stats.highRisk} de alto risco`}
          tone={stats.pendingTotal ? "warn" : "ok"}
          icon={<Icons.clock size={15} aria-hidden />}
        />
        <StatTile
          label="Denúncias abertas"
          value={formatNumber(stats.openReports)}
          hint="Relatos da comunidade aguardando resposta"
          tone={stats.openReports ? "danger" : "ok"}
          icon={<Icons.flag size={15} aria-hidden />}
        />
        <StatTile
          label="Visualizações hoje"
          value={compactNumber(stats.viewsToday)}
          hint={`${compactNumber(stats.viewsWeek)} nos últimos 7 dias`}
          icon={<Icons.eye size={15} aria-hidden />}
        />
        <StatTile
          label="Contas"
          value={formatNumber(stats.users)}
          hint={`${stats.activeUsers} ativas · ${stats.bannedUsers} banidas`}
          icon={<Icons.users size={15} aria-hidden />}
        />
        <StatTile
          label="Versões registradas"
          value={formatNumber(stats.versions)}
          hint={`${stats.comments} comentários visíveis`}
          icon={<Icons.history size={15} aria-hidden />}
        />
        <StatTile
          label="Taxonomia"
          value={`${formatNumber(stats.categories)} / ${formatNumber(stats.tags)}`}
          hint="categorias / tags em uso"
          icon={<Icons.tag size={15} aria-hidden />}
        />
        <StatTile
          label="Páginas protegidas"
          value={formatNumber(stats.protectedPages)}
          hint={`${stats.demoContent} páginas marcadas como demonstração`}
          icon={<Icons.shield size={15} aria-hidden />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-4 sm:p-5">
          <PanelHeader
            title="Visualizações por dia"
            description="Últimos 14 dias. Base para decidir o que destacar na home."
            icon={<Icons.chart size={16} aria-hidden />}
          />
          <div className="mt-4">
            <TrendBars
              ariaLabel="Visualizações por dia nos últimos 14 dias"
              data={views.map((point) => ({
                label: point.day.slice(5),
                value: Number(point.count),
              }))}
              formatValue={compactNumber}
            />
          </div>
        </Panel>

        <Panel className="p-4 sm:p-5">
          <PanelHeader
            title="Crescimento mensal"
            description="Páginas, contas e contribuições por mês nos últimos 6 meses."
            icon={<Icons.popular size={16} aria-hidden />}
          />
          <div className="mt-4 flex flex-col gap-4">
            <TrendBars
              ariaLabel="Novas contribuições por mês"
              data={growth.map((point) => ({ label: point.month, value: Number(point.contributions) }))}
              height={110}
              formatValue={formatNumber}
            />
            <dl className="grid grid-cols-3 gap-3">
              {[
                { key: "memes", label: "Páginas novas" },
                { key: "users", label: "Contas novas" },
                { key: "contributions", label: "Contribuições" },
              ].map((row) => (
                <div key={row.key} className="rounded-control bg-sunken px-3 py-2">
                  <dt className="text-[0.6875rem] uppercase tracking-[0.06em] text-ink-4">{row.label}</dt>
                  <dd className="mt-0.5 font-mono text-[0.9375rem] font-semibold text-ink tabular">
                    {formatNumber(
                      growth.reduce((sum, point) => sum + Number(point[row.key as "memes" | "users" | "contributions"]), 0),
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel className="p-4 sm:p-5">
          <PanelHeader
            title="Fila de revisão"
            description="As cinco contribuições mais antigas aguardando decisão."
            icon={<Icons.clock size={16} aria-hidden />}
            action={
              <Link href="/admin/revisao" className="text-[0.8125rem] font-medium text-accent hover:underline">
                Ver todas ({queue.total})
              </Link>
            }
          />
          {queue.items.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {queue.items.map((item) => (
                <li key={item.id} className="rounded-control border border-line-soft bg-sunken p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    <Badge tone={item.risk_score >= 55 ? "danger" : "neutral"}>
                      risco {item.risk_score}/100
                    </Badge>
                    <span className="ml-auto text-[0.6875rem] text-ink-4">{relativeTime(item.created_at)}</span>
                  </div>
                  <p className="mt-2 text-[0.875rem] font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[0.75rem] text-ink-3">
                    por {item.author_name ?? "usuário removido"}
                    {item.meme_slug ? ` · página ${item.meme_name}` : " · meme novo"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3">
              <EmptyState
                icon={<Icons.checkCircle size={20} aria-hidden />}
                title="Nada na fila"
                description="Todas as contribuições pendentes já foram avaliadas."
              />
            </div>
          )}
        </Panel>

        <Panel className="p-4 sm:p-5">
          <PanelHeader
            title="Denúncias abertas"
            description="Relatos que ainda não tiveram resposta da moderação."
            icon={<Icons.flag size={16} aria-hidden />}
            action={
              <Link href="/admin/denuncias" className="text-[0.8125rem] font-medium text-accent hover:underline">
                Ver todas
              </Link>
            }
          />
          {reports.items.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {reports.items.map((report) => (
                <li key={report.id} className="rounded-control border border-line-soft bg-sunken p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warn">{report.reason}</Badge>
                    <Badge tone="outline">alvo: {report.target_type}</Badge>
                    <span className="ml-auto text-[0.6875rem] text-ink-4">{relativeTime(report.created_at)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[0.8125rem] text-ink-2">{report.details}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3">
              <EmptyState
                icon={<Icons.flag size={20} aria-hidden />}
                title="Nenhuma denúncia aberta"
                description="A comunidade não relatou problemas pendentes."
              />
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel className="p-4 sm:p-5">
          <PanelHeader title="Mais visualizados" icon={<Icons.eye size={16} aria-hidden />} />
          <ul className="mt-3 flex flex-col gap-2">
            {viewed.map((meme) => (
              <li key={meme.id} className="flex items-center justify-between gap-3">
                <Link
                  href={`/meme/${meme.slug}`}
                  className="truncate text-[0.8125rem] text-ink-2 hover:text-accent"
                >
                  {meme.name}
                </Link>
                <span className="font-mono text-[0.75rem] text-ink-3 tabular">
                  {compactNumber(meme.views_count)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-4 sm:p-5">
          <PanelHeader title="Categorias com mais páginas" icon={<Icons.category size={16} aria-hidden />} />
          <div className="mt-3">
            <RankBars
              items={categories.map((category) => ({
                label: category.name,
                value: Number(category.n),
              }))}
            />
          </div>
        </Panel>

        <Panel className="p-4 sm:p-5">
          <PanelHeader title="Quem mais contribui" icon={<Icons.users size={16} aria-hidden />} />
          <ul className="mt-3 flex flex-col gap-2.5">
            {activeUsers.map((person) => (
              <li key={person.id} className="flex items-center gap-2.5">
                <Link href={`/perfil/${person.username}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium text-ink hover:text-accent">
                    {person.display_name}
                  </span>
                  <span className="block text-[0.6875rem] text-ink-4">{ROLE_LABEL[person.role]}</span>
                </Link>
                <span className="text-right">
                  <span className="block font-mono text-[0.8125rem] font-semibold text-ink tabular">
                    {person.contributions}
                  </span>
                  <span className="block text-[0.6875rem] text-ink-4">
                    {person.approved} aprovadas
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <Panel className="p-4 sm:p-5">
        <PanelHeader
          title="Atividade recente"
          description="Últimas ações registradas no log de auditoria."
          icon={<Icons.logs size={16} aria-hidden />}
          action={
            <Link href="/admin/logs" className="text-[0.8125rem] font-medium text-accent hover:underline">
              Abrir logs
            </Link>
          }
        />
        <ul className="mt-3 flex flex-col divide-y divide-line-soft">
          {activity.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="font-mono text-[0.75rem] text-accent">{entry.action}</span>
              <span className="text-[0.8125rem] text-ink-2">{entry.actor_name}</span>
              <span className="text-[0.75rem] text-ink-4">
                {entry.resource_type}
                {entry.resource_id ? ` #${entry.resource_id}` : ""}
              </span>
              <span className="ml-auto text-[0.6875rem] text-ink-4" title={entry.created_at}>
                {relativeTime(entry.created_at)}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <PanelHeader
          title="Saúde editorial"
          description="Indicadores de qualidade usados para priorizar trabalho."
          icon={<Icons.shield size={16} aria-hidden />}
        />
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Aproveitamento", value: `${approvalRate}%`, hint: "pendentes vs. versões publicadas" },
            { label: "Média de versões", value: (stats.versions / Math.max(1, stats.memes)).toFixed(1), hint: "por página publicada" },
            { label: "Visualizações totais", value: compactNumber(stats.viewsAll), hint: "desde a instalação" },
            { label: "Conteúdo de demonstração", value: formatNumber(stats.demoContent), hint: "a revisar e substituir" },
          ].map((item) => (
            <div key={item.label} className="rounded-control bg-sunken px-3 py-2.5">
              <dt className="text-[0.6875rem] uppercase tracking-[0.06em] text-ink-4">{item.label}</dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold text-ink tabular">{item.value}</dd>
              <dd className="mt-0.5 text-[0.6875rem] text-ink-4">{item.hint}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[0.75rem] text-ink-4">
          Instalação criada em {formatDate(new Date().toISOString())} · dados lidos diretamente do banco local.
        </p>
      </Panel>
    </div>
  );
}
