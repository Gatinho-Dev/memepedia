import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getMemeBySlug, diffSnapshots, inlineDiff, parseSnapshot, versionsOf } from "@/lib/memes";
import { can } from "@/lib/permissions";
import { revertVersionAction } from "@/app/actions/meme";
import { formatDateTime, relativeTime } from "@/lib/format";
import { buttonClass, Alert, Badge, Breadcrumbs, EmptyState, Panel, Pagination } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata: Metadata = {
  title: "Histórico de versões",
  description: "Todas as versões de uma página da Memepedia, com diff campo por campo.",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string; restaurada?: string; erro?: string; pagina?: string }>;
};

const SOURCE_LABEL: Record<string, string> = {
  direct: "Edição direta",
  contribution: "Contribuição aprovada",
  revert: "Restauração",
  media: "Atualização de mídia",
  seed: "Importação inicial",
};

const PAGE_SIZE = 10;

function kindClass(kind: "same" | "add" | "del") {
  if (kind === "add") return "rounded-[3px] bg-ok-soft px-0.5 text-ok";
  if (kind === "del") return "rounded-[3px] bg-danger-soft px-0.5 text-danger line-through";
  return "text-ink-2";
}

export default async function HistoryPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const meme = await getMemeBySlug(slug);
  if (!meme) notFound();

  const user = await currentUser();
  const versions = versionsOf(meme.id);
  const page = Math.max(1, Number(query.pagina ?? "1") || 1);
  const pages = Math.max(1, Math.ceil(versions.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageItems = versions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedId = Number(query.v ?? "0");
  const selectedIndex = selectedId
    ? versions.findIndex((version) => version.id === selectedId)
    : 0;
  const selected = selectedIndex >= 0 ? versions[selectedIndex] : versions[0];
  const previous = selected ? versions[versions.findIndex((v) => v.id === selected.id) + 1] : undefined;

  const diffs = selected
    ? diffSnapshots(previous ? parseSnapshot(previous.snapshot) : parseSnapshot(selected.snapshot), parseSnapshot(selected.snapshot))
    : [];
  const changed = diffs.filter((entry) => entry.changed);
  const canRevert = can(user?.role, "meme.revert");

  return (
    <main id="conteudo" className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-12">
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Memes", href: "/memes" },
          { label: meme.name, href: `/meme/${meme.slug}` },
          { label: "Histórico" },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Histórico de versões</h1>
          <p className="mt-2 text-[0.9375rem] text-ink-2">
            Cada alteração publicada em{" "}
            <Link href={`/meme/${meme.slug}`} className="font-semibold text-accent underline underline-offset-2">
              {meme.name}
            </Link>{" "}
            fica registrada aqui. Nada é sobrescrito: o histórico é a cópia de segurança da página.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/meme/${meme.slug}`} className={buttonClass("secondary", "sm")}>
            <Icons.arrowLeft size={14} aria-hidden />
            Voltar à página
          </Link>
        </div>
      </div>

      {query.restaurada ? (
        <Alert tone="ok" title={`Versão ${query.restaurada} restaurada`}>
          O conteúdo voltou a ser o daquela versão e a operação entrou no histórico como uma nova versão.
        </Alert>
      ) : null}
      {query.erro ? (
        <Alert tone="danger" title="Não foi possível concluir a operação">
          {query.erro === "versao"
            ? "A versão informada não existe mais."
            : "A página indicada não existe mais no banco de dados."}
        </Alert>
      ) : null}

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Versões publicadas", value: versions.length },
          { label: "Visualizações", value: meme.views_count },
          { label: "Contribuições", value: meme.contributions_count },
          { label: "Criada em", value: formatDateTime(meme.created_at) },
        ].map((item) => (
          <div key={item.label} className="rounded-card border border-line bg-surface px-4 py-3">
            <dt className="text-[0.6875rem] uppercase tracking-[0.06em] text-ink-4">{item.label}</dt>
            <dd className="mt-1 text-[0.9375rem] font-semibold text-ink tabular">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section>
          <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-4">
            Linha do tempo
          </h2>
          {versions.length ? (
            <ol className="flex flex-col gap-2">
              {pageItems.map((version) => {
                const isSelected = selected?.id === version.id;
                const isCurrent = version.id === versions[0].id;
                return (
                  <li key={version.id}>
                    <Panel
                      className={
                        isSelected
                          ? "p-4 border-accent-line bg-accent-soft/40"
                          : "p-4"
                      }
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={isCurrent ? "ok" : isSelected ? "accent" : "neutral"}>
                          v{version.version_no}
                        </Badge>
                        {isCurrent ? <Badge tone="outline">Atual</Badge> : null}
                        <Badge tone="neutral">{SOURCE_LABEL[version.source] ?? version.source}</Badge>
                        <span className="ml-auto text-[0.6875rem] text-ink-4" title={formatDateTime(version.created_at)}>
                          {relativeTime(version.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-2">
                        {version.reason || "Sem justificativa registrada."}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-3">
                        <span>
                          {version.author_username ? (
                            <Link
                              href={`/perfil/${version.author_username}`}
                              className="hover:text-ink hover:underline"
                            >
                              {version.author_name ?? version.author_username}
                            </Link>
                          ) : (
                            "Sistema"
                          )}
                        </span>
                        {version.restored_from ? <span>restauração de outra versão</span> : null}
                        <span className="ml-auto flex items-center gap-2">
                          <Link
                            href={`/historico/${meme.slug}?v=${version.id}`}
                            className="font-medium text-accent underline underline-offset-2"
                          >
                            {isSelected ? "Comparação aberta" : "Comparar"}
                          </Link>
                          {!isCurrent && canRevert ? (
                            <form action={revertVersionAction}>
                              <input type="hidden" name="version_id" value={version.id} />
                              <input type="hidden" name="return_to" value={`/historico/${meme.slug}`} />
                              <button type="submit" className={buttonClass("quiet", "sm")}>
                                <Icons.revert size={13} aria-hidden />
                                Restaurar
                              </button>
                            </form>
                          ) : null}
                        </span>
                      </div>
                    </Panel>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState
              icon={<Icons.history size={22} aria-hidden />}
              title="Nenhuma versão registrada"
              description="A página ainda não recebeu nenhuma alteração publicada."
            />
          )}

          <div className="mt-4">
            <Pagination
              page={safePage}
              pages={pages}
              hrefFor={(p) => `/historico/${meme.slug}?pagina=${p}${selected ? `&v=${selected.id}` : ""}`}
            />
          </div>
        </section>

        <section className="min-w-0">
          <h2 className="mb-3 flex flex-wrap items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-4">
            Comparação
            {selected ? (
              <Badge tone="neutral">
                v{previous ? previous.version_no : selected.version_no} → v{selected.version_no}
              </Badge>
            ) : null}
          </h2>

          {selected && !previous ? (
            <Alert tone="info" title="Primeira versão da página">
              Não há uma versão anterior para comparar. Esta é a criação da página.
            </Alert>
          ) : null}

          {changed.length ? (
            <ul className="flex flex-col gap-3">
              {changed.map((entry) => (
                <li key={entry.field}>
                  <Panel className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.875rem] font-semibold text-ink">{entry.label}</span>
                      <Badge tone="accent">alterado</Badge>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 text-[0.8125rem] leading-relaxed">
                      {entry.type === "number" ? (
                        <p className="tabular text-ink-2">
                          <span className="text-ink-4">Antes:</span>{" "}
                          <span className="text-danger line-through">{entry.oldValue || "—"}</span>{" "}
                          <span className="text-ink-4">→</span>{" "}
                          <span className="font-semibold text-ok">{entry.newValue || "—"}</span>
                        </p>
                      ) : (
                        <>
                          {entry.oldValue ? (
                            <p className="rounded-control border border-line-soft bg-sunken p-2.5 text-ink-3">
                              {inlineDiff(entry.oldValue, entry.newValue).map((part, i) => (
                                <span key={i} className={kindClass(part.kind)}>
                                  {part.text}
                                </span>
                              ))}
                            </p>
                          ) : null}
                          {!entry.oldValue && entry.newValue ? (
                            <p className="rounded-control border border-line-soft bg-sunken p-2.5">
                              {inlineDiff("", entry.newValue).map((part, i) => (
                                <span key={i} className={kindClass(part.kind)}>
                                  {part.text}
                                </span>
                              ))}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  </Panel>
                </li>
              ))}
            </ul>
          ) : selected && previous ? (
            <Alert tone="info" title="Sem diferenças de conteúdo">
              Esta versão alterou apenas mídia, tags ou metadados — o texto dos campos permaneceu igual.
            </Alert>
          ) : null}

          <Panel className="mt-4 p-4">
            <p className="flex items-start gap-2 text-[0.8125rem] text-ink-2">
              <Icons.shield size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <span>
                Restaurar não apaga o passado: a versão escolhida é copiada para o topo do histórico como uma nova
                versão, com o motivo registrado no log de auditoria.
                {canRevert ? "" : " Somente moderadores e acima podem restaurar versões."}
              </span>
            </p>
          </Panel>
        </section>
      </div>
    </main>
  );
}
