"use client";

import Link from "next/link";
import { Icons } from "./icons";
import { avatarHue } from "@/lib/format";
import { Dropdown, MenuItem, MenuSeparator } from "./ui-client";
import { signOutAction } from "@/app/actions/auth";

export function UserMenu({
  name,
  username,
  avatarUrl,
  roleLabel,
  isOwner,
  canAccessAdmin,
  mustChangePassword,
}: {
  name: string;
  username: string;
  avatarUrl: string | null;
  roleLabel: string;
  isOwner: boolean;
  canAccessAdmin: boolean;
  mustChangePassword: boolean;
}) {
  const hue = avatarHue(name);
  return (
    <Dropdown
      label="Menu da conta"
      align="right"
      trigger={
        <span className="flex items-center gap-2 rounded-full pl-0.5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" width={26} height={26} className="size-[26px] rounded-full object-cover" />
          ) : (
            <span
              aria-hidden
              className="grid size-[26px] place-items-center rounded-full text-[0.6875rem] font-semibold"
              style={{
                background: `oklch(0.92 0.045 ${hue})`,
                color: `oklch(0.32 0.08 ${hue})`,
              }}
            >
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
      }
    >
      <div className="px-2.5 py-2">
        <p className="truncate text-[0.8125rem] font-semibold text-ink">{name}</p>
        <p className="truncate text-[0.75rem] text-ink-3">@{username}</p>
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-line-soft bg-sunken px-2 py-0.5 text-[0.6875rem] font-medium text-ink-2">
          {isOwner ? <Icons.shield size={11} weight="fill" aria-hidden /> : null}
          {isOwner ? "Owner da Memepedia" : roleLabel}
        </p>
      </div>
      <MenuSeparator />
      <MenuItem href={`/perfil/${username}`} icon={<Icons.user size={15} aria-hidden />}>
        Meu perfil
      </MenuItem>
      <MenuItem href="/contribuicoes" icon={<Icons.note size={15} aria-hidden />}>
        Minhas contribuições
      </MenuItem>
      <MenuItem href="/favoritos" icon={<Icons.bookmark size={15} aria-hidden />}>
        Favoritos
      </MenuItem>
      <MenuItem href="/notificacoes" icon={<Icons.bell size={15} aria-hidden />}>
        Notificações
      </MenuItem>
      <MenuSeparator />
      {canAccessAdmin ? (
        <MenuItem href="/admin" icon={<Icons.shield size={15} aria-hidden />}>
          Painel administrativo
        </MenuItem>
      ) : null}
      <MenuItem
        href="/perfil/seguranca"
        icon={mustChangePassword ? <Icons.warning size={15} aria-hidden /> : <Icons.lock size={15} aria-hidden />}
      >
        Segurança da conta
      </MenuItem>
      <MenuSeparator />
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[0.8125rem] font-medium text-danger transition-colors duration-150 hover:bg-danger-soft"
        >
          <Icons.signOut size={15} aria-hidden />
          Sair da conta
        </button>
      </form>
      <MenuSeparator />
      <MenuItem href="/sobre" icon={<Icons.info size={15} aria-hidden />}>
        Sobre a Memepedia
      </MenuItem>
      <MenuItem href="/politica-de-conteudo" icon={<Icons.logs size={15} aria-hidden />}>
        Política de conteúdo
      </MenuItem>
      <MenuItem href="/codigo-de-conduta" icon={<Icons.checkCircle size={15} aria-hidden />}>
        Código de conduta
      </MenuItem>
      <MenuItem href="/api/estatisticas" icon={<Icons.chart size={15} aria-hidden />}>
        Estatísticas abertas
      </MenuItem>
      <MenuSeparator />
      <div className="px-2.5 py-1.5">
        <Link href="/entrar" className="text-[0.75rem] text-ink-3 hover:text-ink">
          Trocar de conta
        </Link>
      </div>
    </Dropdown>
  );
}
