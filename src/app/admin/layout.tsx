import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { count } from "@/lib/db";
import { can, type Capability } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/types";
import { Icons } from "@/components/icons";
import { Badge, Panel, buttonClass } from "@/components/ui";
import { AdminNav, type NavItem } from "./admin-nav";

export const metadata: Metadata = {
  title: { default: "Painel administrativo", template: "%s · Painel · Memepedia" },
  robots: { index: false, follow: false },
};

const ICON_SIZE = 16;

function navIcons(): Record<string, ReactNode> {
  const props = { size: ICON_SIZE, "aria-hidden": true } as const;
  return {
    chart: <Icons.chart {...props} />,
    note: <Icons.note {...props} />,
    book: <Icons.book {...props} />,
    chat: <Icons.chat {...props} />,
    flag: <Icons.flag {...props} />,
    users: <Icons.users {...props} />,
    category: <Icons.category {...props} />,
    tag: <Icons.tag {...props} />,
    logs: <Icons.logs {...props} />,
    lock: <Icons.lock {...props} />,
    settings: <Icons.settings {...props} />,
  };
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireCap("admin.access");

  const capabilities: { cap: Capability; item: Omit<NavItem, "count"> }[] = [
    {
      cap: "admin.access",
      item: { href: "/admin", label: "Visão geral", description: "Resumo da plataforma", icon: "chart" },
    },
    {
      cap: "contribution.review",
      item: { href: "/admin/revisao", label: "Fila de revisão", description: "Contribuições aguardando análise", icon: "note" },
    },
    {
      cap: "meme.delete",
      item: { href: "/admin/memes", label: "Conteúdo", description: "Todos os memes, com ações de moderação", icon: "book" },
    },
    {
      cap: "comment.moderate",
      item: { href: "/admin/comentarios", label: "Comentários", description: "Moderação de comentários", icon: "chat" },
    },
    {
      cap: "report.moderate",
      item: { href: "/admin/denuncias", label: "Denúncias", description: "Denúncias abertas pela comunidade", icon: "flag" },
    },
    {
      cap: "user.suspend",
      item: { href: "/admin/usuarios", label: "Usuários", description: "Papéis, status e histórico", icon: "users" },
    },
    {
      cap: "category.manage",
      item: { href: "/admin/categorias", label: "Categorias", description: "Taxonomia principal do catálogo", icon: "category" },
    },
    {
      cap: "tag.manage",
      item: { href: "/admin/tags", label: "Tags", description: "Renomear e mesclar tags", icon: "tag" },
    },
    {
      cap: "logs.view",
      item: { href: "/admin/logs", label: "Logs de auditoria", description: "Registro imutável de ações", icon: "logs" },
    },
    {
      cap: "user.assign_role_admin",
      item: { href: "/admin/permissoes", label: "Permissões", description: "Matriz de papéis e transferência do OWNER", icon: "lock" },
    },
    {
      cap: "settings.manage",
      item: { href: "/admin/configuracoes", label: "Configurações", description: "Regras gerais da plataforma", icon: "settings" },
    },
  ];

  const items: NavItem[] = capabilities
    .filter((entry) => can(user.role, entry.cap))
    .map((entry) => ({ ...entry.item }));

  const counts = {
    pending: count("SELECT COUNT(*) FROM contributions WHERE status = 'pending'"),
    reports: count("SELECT COUNT(*) FROM reports WHERE status = 'open'"),
    hidden: count("SELECT COUNT(*) FROM memes WHERE status IN ('hidden','deleted')"),
  };

  for (const item of items) {
    if (item.href === "/admin/revisao" && counts.pending) item.count = counts.pending;
    if (item.href === "/admin/denuncias" && counts.reports) {
      item.count = counts.reports;
      item.tone = "danger";
    }
    if (item.href === "/admin/memes" && counts.hidden) item.count = counts.hidden;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:gap-8 lg:py-10">
      <aside className="lg:w-60 lg:shrink-0">
        <div className="lg:sticky lg:top-24">
          <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
            <span className="grid size-8 place-items-center rounded-control bg-ink text-paper" aria-hidden>
              <Icons.shield size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.875rem] font-semibold leading-tight text-ink">Painel administrativo</p>
              <p className="text-[0.6875rem] text-ink-4">
                {ROLE_LABEL[user.role]}
                {user.isOwner ? " · controle total" : ""}
              </p>
            </div>
          </div>

          <AdminNav items={items} icons={navIcons()} />

          <Panel className="mt-4 hidden p-3 lg:block">
            <p className="text-[0.75rem] leading-relaxed text-ink-3">
              Toda ação aqui é registrada no{" "}
              <Link href="/admin/logs" className="font-medium text-accent underline underline-offset-2">
                log de auditoria
              </Link>{" "}
              com autor, data e motivo.
            </p>
          </Panel>
        </div>
      </aside>

      <main id="conteudo" className="min-w-0 flex-1">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Badge tone={user.isOwner ? "accent" : "outline"}>{ROLE_LABEL[user.role]}</Badge>
          {counts.pending ? (
            <Link href="/admin/revisao" className={buttonClass("secondary", "sm")}>
              <Icons.clock size={13} aria-hidden />
              {counts.pending} na fila de revisão
            </Link>
          ) : (
            <Badge tone="ok">Fila de revisão vazia</Badge>
          )}
          {counts.reports ? (
            <Link href="/admin/denuncias" className={buttonClass("secondary", "sm")}>
              <Icons.flag size={13} aria-hidden />
              {counts.reports} denúncia(s) aberta(s)
            </Link>
          ) : null}
        </div>
        {children}
      </main>
    </div>
  );
}
