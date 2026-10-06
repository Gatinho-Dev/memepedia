import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { changePasswordAction, signOutAction } from "@/app/actions/auth";
import { emptyAction, type ActionState } from "@/lib/forms";
import { Panel, PanelHeader, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { Icons } from "@/components/icons";
import { formatDateTime, relativeTime } from "@/lib/format";
import { PasswordForm } from "../profile-forms";

export const metadata: Metadata = { title: "Segurança da conta" };

export default async function SecurityPage() {
  const user = await currentUser();
  if (!user) redirect("/entrar?proximo=/perfil/seguranca");

  const sessions = all<{ id: string; created_at: string; expires_at: string; user_agent: string }>(
    "SELECT id, created_at, expires_at, user_agent FROM sessions WHERE user_id = ? AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 10",
    user.id,
  );
  const total = get<{ c: number }>("SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?", user.id)?.c ?? 0;

  const pwAction = async (state: ActionState, form: FormData) => {
    "use server";
    return changePasswordAction(state, form);
  };

  return (
    <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Segurança da conta</h1>
        <Link href="/perfil" className="text-sm font-semibold text-accent underline underline-offset-2">
          Voltar ao perfil
        </Link>
      </div>

      <Panel className="mt-6 p-0">
        <PanelHeader
          title="Alterar senha"
          description="Ao alterar, todas as outras sessões são encerradas imediatamente."
          icon={<Icons.lock size={16} aria-hidden />}
        />
        <div className="px-5 py-5">
          <PasswordForm action={pwAction} />
        </div>
      </Panel>

      <Panel className="mt-6 p-0">
        <PanelHeader
          title="Sessões ativas"
          description={`${total} sessão(ões) conectada(s) a esta conta. Mostrando as 10 mais recentes.`}
          icon={<Icons.shield size={16} aria-hidden />}
          action={
            <form action={signOutAction}>
              <SubmitButton variant="secondary" size="sm" pendingLabel="Encerrando…">
                <Icons.signOut size={14} aria-hidden />
                Encerrar esta sessão
              </SubmitButton>
            </form>
          }
        />
        <ul className="flex flex-col">
          {sessions.length === 0 ? (
            <li className="px-5 py-6 text-center text-sm text-ink-3">Nenhuma sessão registrada.</li>
          ) : (
            sessions.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft px-5 py-3 text-sm last:border-b-0">
                <Badge tone="neutral">sessão</Badge>
                <span className="min-w-0 flex-1 truncate font-mono text-[0.75rem] text-ink-3">
                  {session.user_agent.slice(0, 80) || "navegador não identificado"}
                </span>
                <span className="text-[0.75rem] text-ink-4" title={formatDateTime(session.created_at)}>
                  iniciada {relativeTime(session.created_at)}
                </span>
              </li>
            ))
          )}
        </ul>
      </Panel>
    </main>
  );
}
