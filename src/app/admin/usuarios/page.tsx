import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { listUsersAdmin } from "@/lib/admin";
import { can } from "@/lib/permissions";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/types";
import { formatDate, relativeTime } from "@/lib/format";
import { userRoleAction, userStatusAction } from "@/app/actions/admin";
import { RoleForm, StatusForm } from "../admin-forms";
import { buttonClass, Avatar, Badge, ButtonLink, EmptyState, Input, Panel, Pagination, Select, StatusBadge, Tabs } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata = { title: "Usuários" };

const PER_PAGE = 20;
const STATUS_TABS = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "suspended", label: "Suspensos" },
  { key: "banned", label: "Banidos" },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; papel?: string; status?: string; pagina?: string }>;
}) {
  const user = await requireCap("user.suspend");
  const query = await searchParams;
  const q = (query.q ?? "").slice(0, 80);
  const role = ROLES.some((r) => r.key === query.papel) ? query.papel! : "all";
  const status = STATUS_TABS.some((tab) => tab.key === query.status) ? query.status! : "all";
  const page = Math.max(1, Number(query.pagina ?? "1") || 1);

  const { items, total } = listUsersAdmin({ q, role, status, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const canBan = can(user.role, "user.ban");
  const canManage = can(user.role, "user.manage");
  const assignable: Role[] = user.isOwner
    ? ["user", "contributor", "moderator", "admin"]
    : ["user", "contributor", "moderator"];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Usuários</h1>
          <p className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink-2">
            Papéis, status e histórico de contribuição. Suspender e banir apagam as sessões ativas na hora e
            notificam o usuário com o motivo informado.
          </p>
        </div>
        <Badge tone="neutral">{total} conta(s)</Badge>
      </header>

      <Panel className="flex flex-wrap items-end gap-3 p-4">
        <form action="/admin/usuarios" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.75rem] font-medium text-ink-2">Buscar</span>
            <Input name="q" defaultValue={q} placeholder="nome, @usuário ou e-mail" className="w-60" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.75rem] font-medium text-ink-2">Papel</span>
            <Select name="papel" defaultValue={role} className="w-40">
              <option value="all">Todos</option>
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </label>
          <input type="hidden" name="status" value={status} />
          <button type="submit" className={buttonClass("secondary", "md")}>
            <Icons.filter size={15} aria-hidden />
            Filtrar
          </button>
          {q || role !== "all" ? (
            <ButtonLink href={`/admin/usuarios?status=${status}`} variant="quiet" size="md">
              Limpar
            </ButtonLink>
          ) : null}
        </form>
      </Panel>

      <Tabs
        current={STATUS_TABS.find((tab) => tab.key === status)?.label ?? "Todos"}
        items={STATUS_TABS.map((tab) => ({
          label: tab.label,
          href: `/admin/usuarios?status=${tab.key}&papel=${role}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
        }))}
      />

      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((person) => {
            const isOwnerRow = person.is_owner === 1 || person.role === "owner";
            return (
              <li key={person.id}>
                <Panel className="p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <Avatar name={person.display_name} size={40} role={person.role} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/perfil/${person.username}`}
                          className="text-[0.9375rem] font-semibold text-ink hover:text-accent"
                        >
                          {person.display_name}
                        </Link>
                        <span className="text-[0.75rem] text-ink-4">@{person.username}</span>
                        <Badge tone={isOwnerRow ? "accent" : "outline"}>{ROLE_LABEL[person.role]}</Badge>
                        <StatusBadge status={person.status} />
                      </div>

                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-3 tabular">
                        <span>{person.email}</span>
                        <span>
                          {person.contributions} contribuições · {person.approved} aprovadas · {person.rejected}{" "}
                          rejeitadas
                        </span>
                        <span className="text-ink-4">
                          entrou em {formatDate(person.created_at)}
                          {person.last_seen_at ? ` · visto ${relativeTime(person.last_seen_at)}` : ""}
                        </span>
                      </p>

                      {person.status_reason ? (
                        <p className="mt-2 rounded-control border border-warn/40 bg-warn-soft px-3 py-2 text-[0.75rem] text-ink-2">
                          <span className="font-medium text-ink">Motivo do status:</span> {person.status_reason}
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {canManage ? (
                          <RoleForm
                            action={userRoleAction}
                            userId={person.id}
                            username={person.username}
                            current={person.role}
                            allowed={assignable}
                            disabledReason={
                              isOwnerRow
                                ? "A conta do OWNER só muda em /admin/permissoes."
                                : ROLE_LABEL[person.role] === "Administrador" && !user.isOwner
                                  ? "Somente o OWNER altera papéis de administrador."
                                  : undefined
                            }
                          />
                        ) : null}

                        <details className="min-w-64">
                          <summary className="cursor-pointer text-[0.8125rem] font-medium text-accent">
                            Alterar status
                          </summary>
                          <div className="mt-3">
                            {isOwnerRow ? (
                              <p className="text-[0.75rem] text-ink-4">
                                A conta do OWNER não pode ser suspensa nem banida.
                              </p>
                            ) : (
                              <StatusForm
                                action={userStatusAction}
                                userId={person.id}
                                username={person.username}
                                status={person.status}
                                canBan={canBan}
                              />
                            )}
                          </div>
                        </details>

                        <Link
                          href={`/admin/logs?q=${encodeURIComponent(person.username)}`}
                          className={buttonClass("quiet", "sm")}
                        >
                          <Icons.logs size={13} aria-hidden />
                          Ver ações
                        </Link>
                      </div>
                    </div>
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<Icons.users size={22} aria-hidden />}
          title="Nenhuma conta encontrada"
          description="Ajuste a busca ou os filtros de papel e status."
        />
      )}

      <Pagination
        page={page}
        pages={pages}
        hrefFor={(p) =>
          `/admin/usuarios?status=${status}&papel=${role}${q ? `&q=${encodeURIComponent(q)}` : ""}&pagina=${p}`
        }
      />

      <Panel className="p-4">
        <h2 className="text-[0.875rem] font-semibold text-ink">Como funcionam os papéis</h2>
        <dl className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r.key} className="rounded-control bg-sunken p-3">
              <dt className="text-[0.8125rem] font-semibold text-ink">
                {r.label} <span className="font-mono text-[0.6875rem] text-ink-4">rank {r.rank}</span>
              </dt>
              <dd className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-3">{r.description}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
