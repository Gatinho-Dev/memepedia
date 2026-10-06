import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { all } from "@/lib/db";
import { transferOwnershipAction } from "@/app/actions/admin";
import { OwnershipForm } from "../admin-forms";
import { CAPABILITY_CATALOG, can } from "@/lib/permissions";
import { ROLE_LABEL, ROLE_RANK, ROLES, type Role } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { Alert, Avatar, Badge, Panel, PanelHeader, StatTile } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata = { title: "Permissões" };

interface StaffRow {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  is_owner: number;
  created_at: string;
  last_seen_at: string | null;
}

export default async function AdminPermissionsPage() {
  const user = await requireCap("user.assign_role_admin");
  const canTransfer = can(user.role, "user.assign_role_owner");

  const staff = all<StaffRow>(
    `SELECT id, username, display_name, role, is_owner, created_at, last_seen_at
       FROM users
      WHERE role IN ('moderator','admin','owner') OR is_owner = 1
      ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, display_name`,
  );

  const totalCapabilities = CAPABILITY_CATALOG.reduce((sum, group) => sum + group.items.length, 0);
  const owner = staff.find((person) => person.is_owner === 1 || person.role === "owner");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Permissões</h1>
          <p className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink-2">
            A matriz de capacidades é definida em código — de propósito. Um sistema de permissões editável pela
            interface é o caminho clássico para escalada de privilégio. O que muda aqui é{" "}
            <strong className="text-ink">quem ocupa cada papel</strong> e quem é o OWNER.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">{totalCapabilities} capacidades</Badge>
          <Badge tone="outline">{ROLES.length} papéis</Badge>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Pessoas na equipe" value={staff.length} hint="moderadores, admins e owner" icon={<Icons.users size={15} aria-hidden />} />
        <StatTile label="Administradores" value={staff.filter((p) => p.role === "admin").length} hint="acesso amplo ao painel" />
        <StatTile label="Moderadores" value={staff.filter((p) => p.role === "moderator").length} hint="fila, denúncias e reversões" />
        <StatTile
          label="Capacidade crítica"
          value={can(user.role, "content.hard_delete") ? "sim" : "não"}
          hint="você pode excluir permanentemente"
          tone={can(user.role, "content.hard_delete") ? "danger" : "neutral"}
        />
      </section>

      <Panel className="p-4 sm:p-5">
        <PanelHeader
          title="Quem está na equipe"
          description="Papéis são atribuídos em /admin/usuarios. O OWNER só muda aqui."
          icon={<Icons.shield size={16} aria-hidden />}
        />
        <ul className="mt-3 flex flex-col gap-2">
          {staff.map((person) => (
            <li key={person.id} className="flex flex-wrap items-center gap-3 rounded-control bg-sunken p-3">
              <Avatar name={person.display_name} size={32} role={person.role} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[0.875rem] font-medium text-ink">
                  <Link href={`/perfil/${person.username}`} className="hover:text-accent">
                    {person.display_name}
                  </Link>
                  <span className="text-[0.75rem] font-normal text-ink-4">@{person.username}</span>
                  <Badge tone={person.is_owner ? "accent" : "outline"}>{ROLE_LABEL[person.role]}</Badge>
                </p>
                <p className="mt-0.5 text-[0.6875rem] text-ink-4">
                  rank {ROLE_RANK[person.role]}
                  {person.last_seen_at ? ` · visto ${relativeTime(person.last_seen_at)}` : ""}
                </p>
              </div>
              <Link
                href={`/admin/usuarios?q=${encodeURIComponent(person.username)}`}
                className="text-[0.75rem] font-medium text-accent hover:underline"
              >
                Gerenciar
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <PanelHeader
          title="Matriz de capacidades"
          description="Papel mínimo exigido para cada ação. A checagem acontece sempre no servidor."
          icon={<Icons.lock size={16} aria-hidden />}
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {CAPABILITY_CATALOG.map((group) => (
            <div key={group.group}>
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-4">
                {group.group}
              </h3>
              <ul className="mt-2 flex flex-col divide-y divide-line-soft overflow-hidden rounded-control border border-line">
                {group.items.map((item) => (
                  <li key={item.cap} className="flex flex-wrap items-center gap-2 bg-surface px-3 py-2">
                    <span className="min-w-0 flex-1 text-[0.8125rem] text-ink-2">{item.label}</span>
                    <Badge tone={ROLE_RANK[item.min] >= ROLE_RANK.admin ? "danger" : ROLE_RANK[item.min] >= 40 ? "warn" : "info"}>
                      {ROLE_LABEL[item.min]}+
                    </Badge>
                    <span className="font-mono text-[0.6875rem] text-ink-4">{item.cap}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[0.75rem] text-ink-4">
          Capacidade atual da sua sessão:{" "}
          <span className="font-medium text-ink-2">{ROLE_LABEL[user.role]}</span> (rank {ROLE_RANK[user.role]}).
        </p>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <PanelHeader
          title="Transferência do papel OWNER"
          description="Operação irreversível pela interface: só o novo OWNER pode devolver o papel."
          icon={<Icons.warningOctagon size={16} aria-hidden />}
        />
        {canTransfer ? (
          <div className="mt-4 flex flex-col gap-4">
            <Alert tone="danger" title="Leia antes de continuar">
              Ao confirmar, sua conta vira <strong>Administrador</strong> e a conta informada assume o controle total:
              configurações, exclusão permanente, transferência de dono e acesso a esta tela. Confirme a senha e o
              nome de usuário corretos — não existe desfazer.
            </Alert>
            {owner ? (
              <p className="text-[0.8125rem] text-ink-2">
                OWNER atual: <strong className="text-ink">{owner.display_name}</strong> (@{owner.username}).
              </p>
            ) : null}
            <OwnershipForm action={transferOwnershipAction} />
          </div>
        ) : (
          <Alert tone="warn" title="Somente o OWNER pode transferir o papel">
            Sua conta tem o papel {ROLE_LABEL[user.role]}. O papel OWNER pertence a{" "}
            {owner ? `@${owner.username}` : "outra conta"} e apenas essa conta pode transferi-lo.
          </Alert>
        )}
      </Panel>
    </div>
  );
}
