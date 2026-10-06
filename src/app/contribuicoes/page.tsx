import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listContributions } from "@/lib/moderation";
import { cancelContributionAction } from "@/app/actions/meme";
import { Tabs, Panel, PanelHeader, StatusBadge, Badge, EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { Icons } from "@/components/icons";
import { relativeTime, formatDateTime, plainText } from "@/lib/format";
import type { ContributionStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Minhas contribuições" };

const TABS: { label: string; status: ContributionStatus | "all" }[] = [
  { label: "Todas", status: "all" },
  { label: "Pendentes", status: "pending" },
  { label: "Aprovadas", status: "approved" },
  { label: "Rejeitadas", status: "rejected" },
  { label: "Alteradas", status: "changed" },
  { label: "Canceladas", status: "cancelled" },
];

export default async function ContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; bemvindo?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/entrar?proximo=/contribuicoes");

  const { status, bemvindo } = await searchParams;
  const current = TABS.find((t) => t.status === status)?.status ?? "all";
  const { items, total } = listContributions({ userId: user.id, status: current, limit: 50 });
  const pendingCount = listContributions({ userId: user.id, status: "pending", limit: 1 }).total;

  const counts = new Map<string, number>();
  for (const tab of TABS) {
    counts.set(
      String(tab.status),
      tab.status === "all" ? total : listContributions({ userId: user.id, status: tab.status, limit: 1 }).total,
    );
  }

  return (
    <main id="conteudo" className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Minhas contribuições</h1>
        <Link href="/contribuir/novo" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline underline-offset-2">
          <Icons.plus size={14} aria-hidden />
          Sugerir meme novo
        </Link>
      </div>

      {bemvindo ? (
        <Panel className="mt-4 p-4">
          <p className="flex items-start gap-2 text-sm text-ink-2">
            <Icons.checkCircle size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden />
            <span>
              Conta criada! Você já pode sugerir memes e correções. Comece pelo{" "}
              <Link href="/memes" className="font-semibold text-accent underline underline-offset-2">
                catálogo
              </Link>{" "}
              — e leia as{" "}
              <Link href="/contribuir" className="font-semibold text-accent underline underline-offset-2">
                regras de envio
              </Link>
              .
            </span>
          </p>
        </Panel>
      ) : null}

      <div className="mt-5">
        <Tabs
          current={TABS.find((t) => t.status === current)?.label ?? "Todas"}
          items={TABS.map((t) => ({ label: t.label, href: `/contribuicoes?status=${t.status}`, count: counts.get(String(t.status)) }))}
        />
      </div>

      <Panel className="mt-4 p-0">
        <PanelHeader
          title={current === "all" ? "Todas as contribuições" : TABS.find((t) => t.status === current)?.label ?? ""}
          description={
            pendingCount > 0
              ? `${pendingCount} contribuição(ões) aguardando revisão.`
              : "Nada na fila neste momento."
          }
          icon={<Icons.note size={16} aria-hidden />}
        />
        {items.length === 0 ? (
          <EmptyState
            icon={<Icons.note size={22} aria-hidden />}
            title="Nenhuma contribuição por aqui"
            description="Quando você sugerir um meme ou uma correção, o status aparece nesta página."
            action={
              <Link href="/contribuir" className="text-sm font-semibold text-accent underline underline-offset-2">
                Fazer minha primeira contribuição
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col">
            {items.map((c) => (
              <li key={c.id} className="border-b border-line-soft px-5 py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={c.status} />
                  <span className="text-[0.9375rem] font-semibold text-ink">{c.title}</span>
                  <Badge tone="neutral">{c.kind === "new_meme" ? "novo meme" : "correção"}</Badge>
                  {c.risk_score > 40 ? <Badge tone="warn">triagem: risco {c.risk_score}</Badge> : null}
                  <span className="ml-auto text-[0.75rem] text-ink-4" title={formatDateTime(c.created_at)}>
                    {relativeTime(c.created_at)}
                  </span>
                </div>

                {c.meme_slug ? (
                  <p className="mt-1 text-[0.8125rem] text-ink-3">
                    Página:{" "}
                    <Link href={`/meme/${c.meme_slug}`} className="font-medium text-accent underline underline-offset-2">
                      {c.meme_name ?? c.meme_slug}
                    </Link>
                  </p>
                ) : null}

                {c.note ? (
                  <p className="mt-1.5 text-[0.8125rem] text-ink-3">
                    <span className="font-medium text-ink-2">Sua nota:</span> {plainText(c.note, 220)}
                  </p>
                ) : null}

                {c.review_note && c.status !== "pending" ? (
                  <p className="mt-1.5 rounded-control border border-line-soft bg-sunken px-3 py-2 text-[0.8125rem] text-ink-2">
                    <span className="font-medium">Revisão{c.reviewer_name ? ` por ${c.reviewer_name}` : ""}:</span>{" "}
                    {plainText(c.review_note, 300)}
                  </p>
                ) : null}

                {c.status === "pending" ? (
                  <form action={cancelContributionAction} className="mt-2">
                    <input type="hidden" name="meme_id" value={c.meme_id ?? ""} />
                    <input type="hidden" name="contribution_id" value={c.id} />
                    <SubmitButton
                      variant="ghost"
                      size="sm"
                      pendingLabel="Cancelando…"
                      confirm="Cancelar esta contribuição? Ela sai da fila de revisão e não pode ser recuperada."
                    >
                      Cancelar contribuição
                    </SubmitButton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  );
}
