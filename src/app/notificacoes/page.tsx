import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { all, get, pluck } from "@/lib/db";
import { markNotificationsReadAction } from "@/app/actions/auth";
import { relativeTime } from "@/lib/format";
import { buttonClass, Badge, Breadcrumbs, EmptyState, Panel, Pagination, Tabs } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata: Metadata = {
  title: "Notificações",
  description: "Avisos sobre revisões, alterações nas páginas que você segue e respostas da moderação.",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ filtro?: string; pagina?: string }> };

const FILTERS = [
  { key: "all", label: "Todas" },
  { key: "unread", label: "Não lidas" },
  { key: "review", label: "Revisão" },
  { key: "social", label: "Interação" },
] as const;

const REVIEW_KINDS = ["contribution_new", "contribution_correction", "contribution_add_info", "contribution_review", "report_resolved", "rate_limit"];
const SOCIAL_KINDS = ["meme_change", "comment_reply", "follow", "welcome"];

const PAGE_SIZE = 20;

function iconFor(kind: string, read: boolean) {
  const props = { size: 15, "aria-hidden": true } as const;
  if (!read) return <Icons.bell {...props} />;
  if (kind.startsWith("contribution")) return <Icons.note {...props} />;
  if (kind.startsWith("report")) return <Icons.flag {...props} />;
  if (kind === "meme_change") return <Icons.history {...props} />;
  if (kind === "comment_reply") return <Icons.chat {...props} />;
  return <Icons.info {...props} />;
}

export default async function NotificationsPage({ searchParams }: Props) {
  const user = await currentUser();
  if (!user) redirect("/entrar?proximo=/notificacoes");

  const { filtro = "all", pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? "1") || 1);

  const where: string[] = ["user_id = ?"];
  const params: unknown[] = [user.id];
  if (filtro === "unread") where.push("read_at IS NULL");
  if (filtro === "review") {
    where.push(`kind IN (${REVIEW_KINDS.map(() => "?").join(", ")})`);
    params.push(...REVIEW_KINDS);
  }
  if (filtro === "social") {
    where.push(`kind IN (${SOCIAL_KINDS.map(() => "?").join(", ")})`);
    params.push(...SOCIAL_KINDS);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const total = Number(pluck<number>(`SELECT COUNT(*) FROM notifications ${whereSql}`, ...params) ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pages);

  const items = all<{
    id: number;
    kind: string;
    title: string;
    body: string;
    url: string;
    read_at: string | null;
    created_at: string;
    actor_name: string | null;
    actor_username: string | null;
  }>(
    `SELECT n.id, n.kind, n.title, n.body, n.url, n.read_at, n.created_at,
            u.display_name AS actor_name, u.username AS actor_username
       FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
       ${whereSql} ORDER BY n.id DESC LIMIT ? OFFSET ?`,
    ...params,
    PAGE_SIZE,
    (safePage - 1) * PAGE_SIZE,
  );

  const unread = Number(
    get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL",
      user.id,
    )?.n ?? 0,
  );

  const counts = {
    all: Number(pluck<number>("SELECT COUNT(*) FROM notifications WHERE user_id = ?", user.id) ?? 0),
    review: Number(
      pluck<number>(
        `SELECT COUNT(*) FROM notifications WHERE user_id = ? AND kind IN (${REVIEW_KINDS.map(() => "?").join(", ")})`,
        user.id,
        ...REVIEW_KINDS,
      ) ?? 0,
    ),
    social: Number(
      pluck<number>(
        `SELECT COUNT(*) FROM notifications WHERE user_id = ? AND kind IN (${SOCIAL_KINDS.map(() => "?").join(", ")})`,
        user.id,
        ...SOCIAL_KINDS,
      ) ?? 0,
    ),
  };

  return (
    <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Notificações" }]} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Notificações</h1>
          <p className="mt-2 text-[0.9375rem] text-ink-2">
            Avisos de revisão, mudanças nas páginas que você segue e recados da moderação.
          </p>
        </div>
        {unread > 0 ? (
          <form action={markNotificationsReadAction}>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              <Icons.check size={14} aria-hidden />
              Marcar todas como lidas
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Tabs
          current={FILTERS.find((f) => f.key === filtro)?.label ?? "Todas"}
          items={FILTERS.map((f) => ({
            label: f.label,
            href: `/notificacoes?filtro=${f.key}`,
            count: f.key === "all" ? counts.all : f.key === "review" ? counts.review : f.key === "social" ? counts.social : unread,
          }))}
        />
        {unread > 0 ? <Badge tone="accent">{unread} não lidas</Badge> : null}
      </div>

      {items.length ? (
        <ul className="mt-5 flex flex-col gap-2">
          {items.map((item) => {
            const read = Boolean(item.read_at);
            const content = (
              <Panel className={read ? "p-4" : "border-accent-line bg-accent-soft/40 p-4"}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={read ? "text-ink-4" : "text-accent"}>{iconFor(item.kind, read)}</span>
                  <span className="text-[0.875rem] font-semibold text-ink">{item.title}</span>
                  {!read ? <Badge tone="accent">nova</Badge> : null}
                  <span className="ml-auto text-[0.6875rem] text-ink-4" title={item.created_at}>
                    {relativeTime(item.created_at)}
                  </span>
                </div>
                {item.body ? (
                  <p className="mt-2 whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-2">
                    {item.body}
                  </p>
                ) : null}
                {item.actor_username ? (
                  <p className="mt-2 text-[0.75rem] text-ink-4">
                    Por{" "}
                    <Link
                      href={`/perfil/${item.actor_username}`}
                      className="underline underline-offset-2 hover:text-ink-2"
                    >
                      {item.actor_name ?? item.actor_username}
                    </Link>
                  </p>
                ) : null}
              </Panel>
            );
            return (
              <li key={item.id}>
                {item.url ? (
                  <Link href={item.url} className="block rounded-card transition-colors duration-150 hover:[&>div]:border-line-strong">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-5">
          <EmptyState
            icon={<Icons.bell size={22} aria-hidden />}
            title="Nada por aqui"
            description={
              filtro === "unread"
                ? "Você já leu todas as notificações."
                : "Quando algo acontecer com suas contribuições ou páginas seguidas, o aviso aparece aqui."
            }
            action={
              <Link href="/notificacoes?filtro=all" className={buttonClass("secondary", "sm")}>
                Ver todas
              </Link>
            }
          />
        </div>
      )}

      <div className="mt-5">
        <Pagination
          page={safePage}
          pages={pages}
          hrefFor={(p) => `/notificacoes?filtro=${filtro}&pagina=${p}`}
        />
      </div>
    </main>
  );
}
