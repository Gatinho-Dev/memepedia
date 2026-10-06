import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { all, count } from "@/lib/db";
import { moderateCommentAction } from "@/app/actions/admin";
import { formatDateTime, relativeTime, truncate } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/lib/types";
import { buttonClass, Alert, Avatar, Badge, EmptyState, Input, Panel, Pagination, StatusBadge, Tabs } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata = { title: "Comentários" };

const PER_PAGE = 20;
const TABS = [
  { key: "visible", label: "Visíveis" },
  { key: "hidden", label: "Ocultos" },
  { key: "deleted", label: "Excluídos" },
  { key: "all", label: "Todos" },
];

interface CommentRow {
  id: number;
  body: string;
  status: string;
  created_at: string;
  reports_count: number;
  parent_id: number | null;
  meme_slug: string;
  meme_name: string;
  author_name: string | null;
  author_username: string | null;
  author_role: string | null;
}

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; pagina?: string; only?: string }>;
}) {
  await requireCap("comment.moderate");
  const query = await searchParams;
  const status = TABS.some((tab) => tab.key === query.status) ? query.status! : "visible";
  const q = (query.q ?? "").slice(0, 80);
  const reportedOnly = query.only === "denunciados";
  const page = Math.max(1, Number(query.pagina ?? "1") || 1);

  const where: string[] = [];
  const params: unknown[] = [];
  if (status !== "all") {
    where.push("c.status = ?");
    params.push(status);
  }
  if (q) {
    where.push("(c.body LIKE ? OR m.name LIKE ? OR u.username LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (reportedOnly) where.push("c.reports_count > 0");
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = count(
    `SELECT COUNT(*) FROM comments c JOIN memes m ON m.id = c.meme_id LEFT JOIN users u ON u.id = c.user_id ${whereSql}`,
    ...params,
  );
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const items = all<CommentRow>(
    `SELECT c.id, c.body, c.status, c.created_at, c.reports_count, c.parent_id,
            m.slug AS meme_slug, m.name AS meme_name,
            u.display_name AS author_name, u.username AS author_username, u.role AS author_role
       FROM comments c
       JOIN memes m ON m.id = c.meme_id
       LEFT JOIN users u ON u.id = c.user_id
       ${whereSql}
      ORDER BY c.reports_count DESC, c.created_at DESC
      LIMIT ? OFFSET ?`,
    ...params,
    PER_PAGE,
    (page - 1) * PER_PAGE,
  );

  const reportedTotal = count("SELECT COUNT(*) FROM comments WHERE reports_count > 0 AND status = 'visible'");

  const returnTo = `/admin/comentarios?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}${
    reportedOnly ? "&only=denunciados" : ""
  }&pagina=${page}`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Comentários</h1>
          <p className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink-2">
            Comentários são discussão, não conteúdo enciclopédico. Ocultar mantém o registro para auditoria; excluir
            marca o texto como removido e ele deixa de aparecer para todos, inclusive para o autor.
          </p>
        </div>
        <Badge tone={reportedTotal ? "danger" : "ok"}>{reportedTotal} comentário(s) com denúncia</Badge>
      </header>

      <Panel className="flex flex-wrap items-end gap-3 p-4">
        <form action="/admin/comentarios" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.75rem] font-medium text-ink-2">Buscar</span>
            <Input name="q" defaultValue={q} placeholder="texto, página ou @autor" className="w-60" />
          </label>
          <input type="hidden" name="status" value={status} />
          {reportedOnly ? <input type="hidden" name="only" value="denunciados" /> : null}
          <button type="submit" className={buttonClass("secondary", "md")}>
            <Icons.search size={15} aria-hidden />
            Buscar
          </button>
          {q ? (
            <Link
              href={`/admin/comentarios?status=${status}${reportedOnly ? "&only=denunciados" : ""}`}
              className={buttonClass("quiet", "md")}
            >
              Limpar
            </Link>
          ) : null}
        </form>
        <Link
          href={
            reportedOnly
              ? `/admin/comentarios?status=${status}`
              : `/admin/comentarios?status=${status}&only=denunciados`
          }
          className={buttonClass(reportedOnly ? "primary" : "secondary", "sm", "ml-auto")}
        >
          <Icons.flag size={13} aria-hidden />
          {reportedOnly ? "Mostrando apenas denunciados" : "Só com denúncia"}
        </Link>
      </Panel>

      <Tabs
        current={TABS.find((tab) => tab.key === status)?.label ?? "Visíveis"}
        items={TABS.map((tab) => ({
          label: tab.label,
          href: `/admin/comentarios?status=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${
            reportedOnly ? "&only=denunciados" : ""
          }`,
        }))}
      />

      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((comment) => (
            <li key={comment.id}>
              <Panel className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={comment.status} />
                  {comment.parent_id ? <Badge tone="outline">resposta</Badge> : null}
                  {comment.reports_count ? (
                    <Badge tone="danger" icon={<Icons.flag size={11} aria-hidden />}>
                      {comment.reports_count} denúncia(s)
                    </Badge>
                  ) : null}
                  {comment.author_role && comment.author_role !== "user" ? (
                    <Badge tone="info">{ROLE_LABEL[comment.author_role as Role] ?? comment.author_role}</Badge>
                  ) : null}
                  <span className="ml-auto text-[0.6875rem] text-ink-4" title={formatDateTime(comment.created_at)}>
                    {relativeTime(comment.created_at)}
                  </span>
                </div>

                <div className="mt-3 flex items-start gap-3">
                  <Avatar name={comment.author_name ?? "Removido"} size={32} role={comment.author_role ?? undefined} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.75rem] text-ink-3">
                      {comment.author_username ? (
                        <Link href={`/perfil/${comment.author_username}`} className="font-medium text-ink-2 hover:text-accent">
                          {comment.author_name ?? comment.author_username}
                        </Link>
                      ) : (
                        "conta removida"
                      )}{" "}
                      em{" "}
                      <Link href={`/meme/${comment.meme_slug}#comentarios`} className="underline underline-offset-2 hover:text-ink">
                        {comment.meme_name}
                      </Link>
                    </p>
                    <p className="mt-1.5 whitespace-pre-line rounded-control bg-sunken p-3 text-[0.8125rem] leading-relaxed text-ink-2">
                      {truncate(comment.body, 900)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/meme/${comment.meme_slug}#comentarios`}
                    className={buttonClass("quiet", "sm")}
                  >
                    <Icons.external size={13} aria-hidden />
                    Ver na página
                  </Link>
                  {comment.status !== "visible" ? (
                    <form action={moderateCommentAction}>
                      <input type="hidden" name="comment_id" value={comment.id} />
                      <input type="hidden" name="status" value="visible" />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button type="submit" className={buttonClass("secondary", "sm")}>
                        <Icons.check size={13} aria-hidden />
                        Restaurar visibilidade
                      </button>
                    </form>
                  ) : null}
                  {comment.status !== "hidden" ? (
                    <form action={moderateCommentAction}>
                      <input type="hidden" name="comment_id" value={comment.id} />
                      <input type="hidden" name="status" value="hidden" />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button type="submit" className={buttonClass("quiet", "sm")}>
                        <Icons.eyeOff size={13} aria-hidden />
                        Ocultar
                      </button>
                    </form>
                  ) : null}
                  {comment.status !== "deleted" ? (
                    <form action={moderateCommentAction}>
                      <input type="hidden" name="comment_id" value={comment.id} />
                      <input type="hidden" name="status" value="deleted" />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button type="submit" className={buttonClass("quiet", "sm", "text-danger")}>
                        <Icons.trash size={13} aria-hidden />
                        Marcar como excluído
                      </button>
                    </form>
                  ) : null}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Icons.chat size={22} aria-hidden />}
          title="Nenhum comentário neste filtro"
          description="Troque o status, limpe a busca ou desative o filtro de denúncias."
        />
      )}

      <Pagination
        page={page}
        pages={pages}
        hrefFor={(p) =>
          `/admin/comentarios?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}${
            reportedOnly ? "&only=denunciados" : ""
          }&pagina=${p}`
        }
      />

      <Alert tone="info" title="Comentários não alteram o artigo">
        Se o comentário traz informação melhor do que o texto publicado, aprove o conteúdo via{" "}
        <Link href="/admin/revisao" className="font-medium underline underline-offset-2">
          fila de revisão
        </Link>{" "}
        e remova o comentário redundante depois.
      </Alert>
    </div>
  );
}
