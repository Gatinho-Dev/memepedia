import Link from "next/link";
import { getSettings, requireCap } from "@/lib/auth";
import { pageLocks, dashboardStats, auditLogList } from "@/lib/admin";
import { saveSettingsAction } from "@/app/actions/admin";
import { SettingsForm } from "../admin-forms";
import { PROTECTION_LABEL, type ProtectionLevel } from "@/lib/types";
import { formatDate, relativeTime } from "@/lib/format";
import { Alert, Badge, Panel, PanelHeader, StatTile } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata = { title: "Configurações" };

export default async function AdminSettingsPage() {
  const user = await requireCap("settings.manage");
  const settings = getSettings();
  const stats = dashboardStats();
  const locks = pageLocks();
  const recentSettings = auditLogList({ q: "configuracoes", limit: 8 });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Configurações</h1>
          <p className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink-2">
            Regras gerais da plataforma. Só o papel OWNER chega a esta tela — você é a única pessoa capaz de mudar a
            postura do site inteiro.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent" icon={<Icons.shield size={11} aria-hidden />}>
            OWNER
          </Badge>
          <Badge tone="neutral">alterado por último em {formatDate(new Date().toISOString())}</Badge>
        </div>
      </header>

      <Alert tone="info" title="Efeito imediato">
        Estas opções valem para novas requisições assim que salvas: limites de contribuição, comentários, cadastro e
        confirmação humana passam a valer na hora, sem reiniciar nada.
      </Alert>

      <Panel className="p-4 sm:p-5">
        <PanelHeader
          title="Parâmetros gerais"
          description="Identidade, limites e travas de segurança."
          icon={<Icons.settings size={16} aria-hidden />}
        />
        <div className="mt-4">
          <SettingsForm action={saveSettingsAction} settings={settings} />
        </div>
      </Panel>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Fila de revisão"
          value={stats.pendingTotal}
          hint={`${stats.highRisk} de alto risco`}
          tone={stats.pendingTotal ? "warn" : "ok"}
        />
        <StatTile
          label="Conteúdo de demonstração"
          value={stats.demoContent}
          hint="substitua por informação documentada"
        />
        <StatTile label="Páginas protegidas" value={stats.protectedPages} hint="proteção acima de Livre" />
        <StatTile label="Contas ativas" value={stats.activeUsers} hint={`${stats.users} no total`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-4 sm:p-5">
          <PanelHeader
            title="Páginas com proteção ativa"
            description="Trava editorial por página. Alterar o nível em /admin/memes."
            icon={<Icons.lock size={16} aria-hidden />}
          />
          {locks.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {locks.slice(0, 8).map((lock) => (
                <li key={lock.id} className="rounded-control bg-sunken p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/meme/${lock.slug}`} className="text-[0.8125rem] font-medium text-ink hover:text-accent">
                      {lock.name}
                    </Link>
                    <Badge tone="warn">{PROTECTION_LABEL[lock.level as ProtectionLevel] ?? lock.level}</Badge>
                    <span className="ml-auto text-[0.6875rem] text-ink-4">{relativeTime(lock.set_at)}</span>
                  </div>
                  <p className="mt-1 text-[0.75rem] text-ink-3">
                    {lock.reason || "Sem motivo registrado"}
                    {lock.actor ? ` · por ${lock.actor}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[0.8125rem] text-ink-3">
              Nenhuma página protegida no momento. Todas seguem a regra padrão de edição colaborativa.
            </p>
          )}
        </Panel>

        <Panel className="p-4 sm:p-5">
          <PanelHeader
            title="Alterações recentes de configuração"
            description="Quem mudou o quê, direto do log de auditoria."
            icon={<Icons.logs size={16} aria-hidden />}
          />
          {recentSettings.items.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {recentSettings.items.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
                  <span className="text-ink-2">{entry.actor_name}</span>
                  <span className="font-mono text-[0.75rem] text-accent">{entry.action}</span>
                  <span className="ml-auto text-[0.6875rem] text-ink-4">{relativeTime(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[0.8125rem] text-ink-3">Nenhuma alteração registrada ainda.</p>
          )}
          <p className="mt-3 text-[0.75rem] text-ink-4">
            Última sessão administrativa de {user.displayName}.
          </p>
        </Panel>
      </div>

      <Panel className="p-4 sm:p-5">
        <PanelHeader
          title="Contas de demonstração"
          description="Criadas na instalação para você testar cada nível de permissão."
          icon={<Icons.users size={16} aria-hidden />}
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-[0.8125rem]">
            <thead className="text-[0.6875rem] uppercase tracking-[0.06em] text-ink-4">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Conta</th>
                <th className="pb-2 pr-4 font-semibold">Papel</th>
                <th className="pb-2 font-semibold">Para que serve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {[
                { email: "owner@memepedia.app", role: "OWNER", use: "Controle total: configurações, exclusão permanente, transferência de dono." },
                { email: "clarice@exemplo.com", role: "Moderador", use: "Revisar fila, resolver denúncias, reverter versões." },
                { email: "tiago@exemplo.com", role: "Colaborador", use: "Publicar direto em páginas livres." },
                { email: "rafael@exemplo.com", role: "Usuário", use: "Sugerir memes e correções que passam por revisão." },
              ].map((row) => (
                <tr key={row.email}>
                  <td className="py-2 pr-4 font-mono text-[0.75rem] text-ink">{row.email}</td>
                  <td className="py-2 pr-4 text-ink-2">{row.role}</td>
                  <td className="py-2 text-ink-3">{row.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[0.75rem] text-ink-4">
          A senha de todas as contas de demonstração está na documentação do projeto. Troque-as antes de publicar o
          site de verdade.
        </p>
      </Panel>
    </div>
  );
}
