"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "./icons";
import { Logo } from "./logo";
import { avatarHue } from "@/lib/format";
import { buttonClass, cn } from "./ui";
import { SearchBox } from "./ui-client";
import { signOutAction } from "@/app/actions/auth";

export function MobileMenu({
  items,
  user,
}: {
  items: { label: string; href: string }[];
  user: { name: string; username: string; avatarUrl: string | null; roleLabel: string; canAccessAdmin: boolean } | null;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={open}
        className={buttonClass("ghost", "sm", "size-9 px-0")}
      >
        <Icons.menu size={18} aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-paper">
          <div className="flex h-16 items-center justify-between border-b border-line px-4">
            <Logo />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className={buttonClass("ghost", "sm", "size-9 px-0")}
            >
              <Icons.close size={18} aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <SearchBox placeholder="Pesquise um meme…" />

            <nav aria-label="Navegação móvel" className="mt-4 flex flex-col">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between border-b border-line-soft py-3.5 text-[0.9375rem] font-medium text-ink"
                >
                  {item.label}
                  <Icons.caretRight size={14} className="text-ink-4" aria-hidden />
                </Link>
              ))}
            </nav>

            <div className="mt-5 flex flex-col gap-2">
              {user ? (
                <>
                  <Link
                    href={`/perfil/${user.username}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-card border border-line bg-surface p-3"
                  >
                    <span
                      aria-hidden
                      className="grid size-9 shrink-0 place-items-center rounded-full text-[0.8125rem] font-semibold"
                      style={{
                        background: `oklch(0.92 0.045 ${avatarHue(user.name)})`,
                        color: `oklch(0.32 0.08 ${avatarHue(user.name)})`,
                      }}
                    >
                      {user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.875rem] font-semibold text-ink">{user.name}</span>
                      <span className="block text-[0.75rem] text-ink-3">@{user.username} · {user.roleLabel}</span>
                    </span>
                  </Link>

                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/contribuicoes" onClick={() => setOpen(false)} className={buttonClass("secondary", "sm")}>
                      <Icons.note size={15} aria-hidden />
                      Contribuições
                    </Link>
                    <Link href="/favoritos" onClick={() => setOpen(false)} className={buttonClass("secondary", "sm")}>
                      <Icons.bookmark size={15} aria-hidden />
                      Favoritos
                    </Link>
                    <Link href="/notificacoes" onClick={() => setOpen(false)} className={buttonClass("secondary", "sm")}>
                      <Icons.bell size={15} aria-hidden />
                      Notificações
                    </Link>
                    <Link href="/perfil" onClick={() => setOpen(false)} className={buttonClass("secondary", "sm")}>
                      <Icons.user size={15} aria-hidden />
                      Meu perfil
                    </Link>
                    {user.canAccessAdmin ? (
                      <Link
                        href="/admin"
                        onClick={() => setOpen(false)}
                        className={cn(buttonClass("secondary", "sm"), "col-span-2")}
                      >
                        <Icons.shield size={15} aria-hidden />
                        Painel administrativo
                      </Link>
                    ) : null}
                  </div>

                  <form action={signOutAction}>
                    <button type="submit" className={buttonClass("quiet", "sm", "w-full")}>
                      <Icons.signOut size={15} aria-hidden />
                      Sair da conta
                    </button>
                  </form>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/entrar" onClick={() => setOpen(false)} className={buttonClass("secondary", "sm")}>
                    Entrar
                  </Link>
                  <Link href="/registrar" onClick={() => setOpen(false)} className={buttonClass("primary", "sm")}>
                    Criar conta
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
