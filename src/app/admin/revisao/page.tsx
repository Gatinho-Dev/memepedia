import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { all } from "@/lib/db";
import {
  contributionChanges,
  listContributions,
  type ContributionRow,
} from "@/lib/moderation";
import { inlineDiff } from "@/lib/memes";
import { can, minRoleFor } from "@/lib/permissions";
import { FIELD_LABEL, ROLE_LABEL, STATUS_LABEL, type ContributionKind, type ContributionStatus } from "@/lib/types";
import { formatDateTime, relativeTime, truncate } from "@/lib/format";
import {
  bulkReviewAction,
  reviewContributionAction,
} from "@/app/actions/admin";
import { buttonClass, Alert, Badge, EmptyState, Field, Input, Panel, Pagination, StatusBadge, Tabs, Textarea } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata = { title: "Fila de revisão" };

const KIND_LABEL: Record<string, string> = {
  new_meme: "Meme novo",
  correction: "Correção",
  media: "Mídia",
  delete_request: "Pedido de exclusão",
};

const KINDS: { key: string; label: string }[] = [
  { key: "all", label: "Todos os tipos" },
  { key: "new_meme", label: "Memes novos" },
  { key: "correction", label: "Correções" },
  { key: "media", label: "Mídia" },
  { key: "delete_request", label: "Exclusões" },
];

const PER_PAGE = 10;

function kindTone(kind: string) {
  if (kind === "new_meme") return "accent" as const;
  if (kind === "correction") return "info" as const;
  if (kind === "delete_request") return "danger" as const;
  return "neutral" as const;
}

function flagsOf(row: ContributionRow): string[] {
  try {
    const parsed = JSON.parse(row.ai_flags);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function payloadOf(row: ContributionRow): Record<string, unknown> {
  try {
    const parsed = JSON.parse(row.payload || "{}");
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function riskTone(score: number) {
  if (score >= 70) return "danger" as const;
  if (score >= 55) return "warn" as const;
  if (score >= 30) return "info" as const;
  return "ok" as const;
}

/** Fields worth editing inline for a new meme before approving. */
const NEW_MEME_EDITABLE = ["name", "short_description", "approx_year", "approx_period", "country", "region"] as const;

function InlineField({
  field,
  label,
  value,
  multiline,
}: {
  field: string;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <Field label={label} htmlFor={`edit-${field}`}>
      {multiline ? (
        <Textarea id={`edit-${field}`} name={`edit_${field}`} rows={3} defaultValue={value} />
      ) : (
        <Input id={`edit-${field}`} name={`edit_${field}`} defaultValue={value} />
      )}
    </Field>
  );
}

function ChangeList({ contributionId }: { contributionId: number }) {
  const changes = contributionChanges(contributionId);
  if (!changes.length) {
    return <p className="text-[0.75rem] text-ink-4">Nenhuma alteração de campo registrada.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {changes.map((change) => (
        <li key={change.id} className="rounded-control border border-line-soft bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink">
              {FIELD_LABEL[change.field] ?? change.field}
            </span>
            <Badge tone="outline">{change.field}</Badge>
          </div>
          <div className="mt-2 flex flex-col gap-1.5 text-[0.75rem] leading-relaxed">
            {change.old_value ? (
              <p className="text-ink-3">
                <span className="mr-1 text-ink-4">antes:</span>
                <span className="line-through decoration-danger/60">{truncate(change.old_value, 320)}</span>
              </p>
            ) : null}
            <p className="text-ink-2">
              <span className="mr-1 text-ink-4">depois:</span>
              {inlineDiff(change.old_value, change.new_value)
                .slice(0, 80)
                .map((part, i) => (
                  <span
                    key={i}
                    className={
                      part.kind === "add"
                        ? "rounded-[3px] bg-ok-soft px-0.5 text-ok"
                        : part.kind === "del"
                          ? "rounded-[3px] bg-danger-soft px-0.5 text-danger line-through"
                          : ""
                    }
                  >
                    {part.text}
                  </span>
                ))}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tipo?: string; pagina?: string; resultado?: string; lote?: string; erro?: string }>;
}) {
  const user = await requireCap("contribution.review");
  const query = await searchParams;
  const status = (["pending", "approved", "rejected", "changed", "cancelled", "all"].includes(query.status ?? "")
    ? query.status
    : "pending") as ContributionStatus | "all";
  const kind = (["all", "new_meme", "correction", "media", "delete_request"].includes(query.tipo ?? "")
    ? query.tipo
    : "all") as ContributionKind | "all";
  const page = Math.max(1, Number(query.pagina ?? "1") || 1);

  const { items, total } = listContributions({ status, kind, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const counts = all<{ status: string; n: number }>(
    "SELECT status, COUNT(*) AS n FROM contributions GROUP BY status",
  ).reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.status]: Number(row.n) }), {});
  const kindCounts = all<{ kind: string; n: number }>(
    status === "all"
      ? "SELECT kind, COUNT(*) AS n FROM contributions GROUP BY kind"
      : "SELECT kind, COUNT(*) AS n FROM contributions WHERE status = 'pending' GROUP BY kind",
  ).reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.kind]: Number(row.n) }), {});

  const canDelete = can(user.role, "content.hard_delete");
  const canMedia = can(user.role, "meme.manage_media");
  const pendingItems = items.filter((item) => item.status === "pending");
  const maxRisk = Math.max(0, ...items.map((item) => item.risk_score));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Fila de revisão</h1>
          <p className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink-2">
            Cada linha é uma proposta da comunidade. Aprovar publica uma nova versão no histórico; rejeitar devolve a
            decisão com um motivo que aparece na página “Minhas contribuições” do autor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={counts.pending ? "warn" : "ok"}>{counts.pending ?? 0} pendentes</Badge>
          <Badge tone="neutral">{counts.approved ?? 0} aprovadas</Badge>
          <Badge tone="neutral">{counts.rejected ?? 0} rejeitadas</Badge>
        </div>
      </header>

      {query.resultado === "ok" ? (
        <Alert tone="ok" title="Decisão registrada">A contribuição foi processada e o autor será notificado.</Alert>
      ) : null}
      {query.resultado === "erro" ? (
        <Alert tone="danger" title="Não foi possível concluir">A contribuição não existe mais ou já havia sido avaliada.</Alert>
      ) : null}
      {query.lote ? (
        <Alert tone="ok" title="Aprovação em lote concluída">{query.lote} contribuição(ões) publicada(s).</Alert>
      ) : null}
      {query.erro === "selecao" ? (
        <Alert tone="warn" title="Nada selecionado">Marque ao menos uma contribuição para aprovar em lote.</Alert>
      ) : null}
      {query.erro === "acao" ? (
        <Alert tone="danger" title="Decisão inválida">
          A decisão enviada não é reconhecida. Recarregue a página e use um dos botões de decisão.
        </Alert>
      ) : null}
      {maxRisk >= 55 && status === "pending" ? (
        <Alert tone="warn" title="Há itens de risco alto nesta página">
          A triagem automática marcou {items.filter((i) => i.risk_score >= 55).length} item(ns) com pontuação 55+.
          Leia com atenção antes de aprovar.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3">
        <Tabs
          current={STATUS_LABEL[status as ContributionStatus] ?? "Todos"}
          items={[
            { label: "Pendentes", href: "/admin/revisao?status=pending", count: counts.pending ?? 0 },
            { label: "Aprovadas", href: "/admin/revisao?status=approved", count: counts.approved ?? 0 },
            { label: "Rejeitadas", href: "/admin/revisao?status=rejected", count: counts.rejected ?? 0 },
            { label: "Alteradas", href: "/admin/revisao?status=changed", count: counts.changed ?? 0 },
            { label: "Canceladas", href: "/admin/revisao?status=cancelled", count: counts.cancelled ?? 0 },
            { label: "Todas", href: "/admin/revisao?status=all" },
          ]}
        />
        <Tabs
          current={KINDS.find((k) => k.key === kind)?.label ?? "Todos os tipos"}
          items={KINDS.map((k) => ({
            label: k.label,
            href: `/admin/revisao?status=${status}&tipo=${k.key}`,
            count: k.key === "all" ? undefined : kindCounts[k.key] ?? 0,
          }))}
        />
      </div>

      {status === "pending" && pendingItems.length > 1 ? (
        <Panel className="p-4">
          <p className="text-[0.8125rem] text-ink-2">
            Aprovação em lote só publica contribuições que passam na validação individual. Use com cuidado: revise
            cada item antes de marcar.
          </p>
        </Panel>
      ) : null}

      {items.length ? (
        <div className="flex flex-col gap-3">
          {/* Checkboxes in the list reference this form by id, so the individual
              decision forms below can stay unnested. */}
          <form id="lote" action={bulkReviewAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="bulk_decision" value="approve" />
            <button type="submit" className={buttonClass("secondary", "sm")}>
              <Icons.checkCircle size={14} aria-hidden />
              Aprovar selecionadas
            </button>
            <span className="text-[0.75rem] text-ink-4">
              Apenas contribuições pendentes podem ser aprovadas em lote.
            </span>
          </form>

          <ul className="flex flex-col gap-4">
            {items.map((item) => {
              const flags = flagsOf(item);
              const pending = item.status === "pending";
              return (
                <li key={item.id} id={`contribuicao-${item.id}`} className="scroll-mt-24">
                  <Panel className={pending ? "p-4 sm:p-5" : "p-4 sm:p-5 opacity-90"}>
                    <div className="flex flex-wrap items-start gap-3">
                      {pending ? (
                        <label className="mt-1 flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            name="ids"
                            value={item.id}
                            form="lote"
                            className="size-4 appearance-none rounded-[4px] border border-line-strong bg-sunken checked:border-accent checked:bg-accent"
                            aria-label={`Selecionar contribuição ${item.id} para aprovação em lote`}
                          />
                        </label>
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={item.status} />
                          <Badge tone={kindTone(item.kind)}>{KIND_LABEL[item.kind] ?? item.kind}</Badge>
                          <Badge tone={riskTone(item.risk_score)}>risco {item.risk_score}/100</Badge>
                          {item.reviewed_at ? (
                            <Badge tone="outline">avaliada {relativeTime(item.reviewed_at)}</Badge>
                          ) : null}
                          <span className="ml-auto text-[0.6875rem] text-ink-4" title={formatDateTime(item.created_at)}>
                            {relativeTime(item.created_at)}
                          </span>
                        </div>

                        <h2 className="mt-2 text-[1rem] font-semibold leading-snug text-ink">{item.title}</h2>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-ink-3">
                          <span>
                            por{" "}
                            {item.author_username ? (
                              <Link href={`/perfil/${item.author_username}`} className="underline underline-offset-2 hover:text-ink">
                                {item.author_name ?? item.author_username}
                              </Link>
                            ) : (
                              "usuário removido"
                            )}
                          </span>
                          {item.meme_slug ? (
                            <span className="inline-flex items-center gap-1">
                              ·
                              <Link href={`/meme/${item.meme_slug}`} className="underline underline-offset-2 hover:text-ink">
                                página {item.meme_name}
                              </Link>
                            </span>
                          ) : (
                            <span>· meme novo</span>
                          )}
                          {item.resulting_meme_id ? (
                            <span className="inline-flex items-center gap-1">
                              ·
                              <Link href={`/historico/${item.meme_slug ?? ""}`} className="underline underline-offset-2 hover:text-ink">
                                versão gerada
                              </Link>
                            </span>
                          ) : null}
                        </p>

                        {item.note ? (
                          <p className="mt-2 whitespace-pre-line rounded-control bg-sunken p-3 text-[0.8125rem] leading-relaxed text-ink-2">
                            {item.note}
                          </p>
                        ) : null}

                        {flags.length ? (
                          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.75rem] text-ink-3">
                            <Icons.warningCircle size={13} className="text-warn" aria-hidden />
                            Triagem automática: {flags.join(" · ")}
                          </p>
                        ) : null}

                        {item.review_note ? (
                          <p className="mt-2 rounded-control border border-line-soft p-3 text-[0.8125rem] text-ink-2">
                            <span className="font-medium text-ink">Nota da revisão</span>
                            {item.reviewer_name ? ` (${item.reviewer_name})` : ""}: {item.review_note}
                          </p>
                        ) : null}

                        <details className="mt-3" open={pending}>
                          <summary className="cursor-pointer text-[0.8125rem] font-medium text-accent">
                            Ver alterações campo por campo
                          </summary>
                          <div className="mt-3">
                            <ChangeList contributionId={item.id} />
                          </div>
                        </details>

                        {pending ? (
                          <form action={reviewContributionAction} className="mt-4 flex flex-col gap-3 border-t border-line-soft pt-4">
                            <input type="hidden" name="contribution_id" value={item.id} />
                            <input type="hidden" name="return_to" value={`/admin/revisao?status=${status}&tipo=${kind}&pagina=${page}`} />

                            <Field label="Nota para o autor" htmlFor={`note-${item.id}`} hint="O autor recebe este texto. Explique a decisão.">
                              <Textarea
                                id={`note-${item.id}`}
                                name="review_note"
                                rows={2}
                                maxLength={2000}
                                placeholder="Ex.: Aprovado com ajustes de data conforme a fonte enviada."
                              />
                            </Field>

                            <details>
                              <summary className="cursor-pointer text-[0.8125rem] font-medium text-accent">
                                Corrigir campos antes de aprovar
                              </summary>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {item.kind === "new_meme"
                                  ? NEW_MEME_EDITABLE.map((field) => (
                                      <InlineField
                                        key={field}
                                        field={field}
                                        label={FIELD_LABEL[field] ?? field}
                                        value={String(payloadOf(item)[field] ?? "")}
                                        multiline={field === "short_description"}
                                      />
                                    ))
                                  : contributionChanges(item.id).map((change) => (
                                      <InlineField
                                        key={change.id}
                                        field={change.field}
                                        label={FIELD_LABEL[change.field] ?? change.field}
                                        value={change.new_value}
                                        multiline={change.new_value.length > 80}
                                      />
                                    ))}
                              </div>
                            </details>

                            <div className="flex flex-wrap items-center gap-2">
                              <button type="submit" name="decision" value="approve" className={buttonClass("primary", "sm")}>
                                <Icons.check size={14} aria-hidden />
                                Aprovar e publicar
                              </button>
                              <button
                                type="submit"
                                name="decision"
                                value="approve_with_edits"
                                className={buttonClass("secondary", "sm")}
                              >
                                <Icons.edit size={14} aria-hidden />
                                Aprovar com edições
                              </button>
                              <button
                                type="submit"
                                name="decision"
                                value="request_changes"
                                className={buttonClass("quiet", "sm")}
                              >
                                <Icons.note size={14} aria-hidden />
                                Pedir ajustes
                              </button>
                              <button
                                type="submit"
                                name="decision"
                                value="reject"
                                className={buttonClass("quiet", "sm")}
                              >
                                <Icons.close size={14} aria-hidden />
                                Rejeitar
                              </button>
                              {canDelete ? (
                                <button
                                  type="submit"
                                  name="decision"
                                  value="delete"
                                  className={buttonClass("quiet", "sm", "ml-auto text-danger")}
                                >
                                  <Icons.trash size={14} aria-hidden />
                                  Apagar do banco
                                </button>
                              ) : null}
                            </div>
                            <p className="text-[0.6875rem] text-ink-4">
                              Aprovar cria uma versão nova no histórico da página. Nada é sobrescrito. Revisores
                              precisam de papel {ROLE_LABEL[minRoleFor("contribution.review")]} ou superior.
                            </p>
                          </form>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2 text-[0.75rem] text-ink-4">
                            {canMedia && item.meme_slug ? (
                              <Link href={`/meme/${item.meme_slug}/editar`} className={buttonClass("quiet", "sm")}>
                                <Icons.edit size={13} aria-hidden />
                                Editar página
                              </Link>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon={<Icons.checkCircle size={22} aria-hidden />}
          title="Nenhuma contribuição neste filtro"
          description="Troque o status ou o tipo para ver outros registros."
        />
      )}

      <Pagination
        page={page}
        pages={pages}
        hrefFor={(p) => `/admin/revisao?status=${status}&tipo=${kind}&pagina=${p}`}
      />
    </div>
  );
}
