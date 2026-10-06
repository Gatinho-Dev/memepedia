import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { pluck } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/types";
import { Icons } from "./icons";
import { Logo } from "./logo";
import { Badge, buttonClass } from "./ui";
import { MobileMenu } from "./mobile-menu";
import { SearchBox, ThemeToggle } from "./ui-client";
import { UserMenu } from "./user-menu";

export const NAV_ITEMS = [
  { label: "Explorar memes", href: "/memes" },
  { label: "Categorias", href: "/categorias" },
  { label: "Populares", href: "/populares" },
  { label: "Recentes", href: "/recentes" },
  { label: "Contribuir", href: "/contribuir" },
];

export async function SiteHeader() {
  const user = await currentUser();
  const unread = user
    ? Number(pluck<number>("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL", user.id) ?? 0)
    : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-4 sm:px-6">
        <Logo withTagline={false} />

        <nav aria-label="Navegação principal" className="ml-3 hidden items-center gap-0.5 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-control px-2.5 py-2 text-[0.8125rem] font-medium text-ink-2 transition-colors duration-150 hover:bg-sunken hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden min-w-0 md:block md:w-52 lg:w-64 xl:w-72">
            <SearchBox />
          </div>

          <Link
            href="/aleatorio"
            className={buttonClass("ghost", "sm", "size-9 px-0")}
            title="Abrir um meme aleatório"
            aria-label="Abrir um meme aleatório"
          >
            <Icons.random size={18} aria-hidden />
          </Link>

          <ThemeToggle initial={user?.theme ?? "system"} />

          {user ? (
            <>
              <Link
                href="/notificacoes"
                className={buttonClass("ghost", "sm", "relative size-9 px-0")}
                aria-label={unread > 0 ? `Notificações, ${unread} não lidas` : "Notificações"}
              >
                <Icons.bell size={18} aria-hidden />
                {unread > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[0.625rem] font-semibold leading-4 text-accent-ink">
                    {unread > 99 ? "99" : unread}
                  </span>
                ) : null}
              </Link>
              <UserMenu
                name={user.displayName}
                username={user.username}
                avatarUrl={user.avatarUrl}
                roleLabel={ROLE_LABEL[user.role]}
                isOwner={user.isOwner}
                canAccessAdmin={user.role !== "user" && user.role !== "contributor"}
                mustChangePassword={user.mustChangePassword}
              />
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link href="/entrar" className={buttonClass("ghost", "sm", "hidden sm:inline-flex")}>
                Entrar
              </Link>
              <Link href="/registrar" className={buttonClass("primary", "sm")}>
                Criar conta
              </Link>
            </div>
          )}

          <MobileMenu
            items={[
              ...NAV_ITEMS,
              { label: "Sobre", href: "/sobre" },
              { label: "Aleatório", href: "/aleatorio" },
            ]}
            user={
              user
                ? {
                    name: user.displayName,
                    username: user.username,
                    avatarUrl: user.avatarUrl,
                    roleLabel: ROLE_LABEL[user.role],
                    canAccessAdmin: user.role !== "user" && user.role !== "contributor",
                  }
                : null
            }
          />
        </div>
      </div>

      {user?.mustChangePassword ? (
        <div className="border-t border-accent-line bg-accent-soft">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-2 text-[0.8125rem] text-ink sm:px-6">
            <Icons.warning size={15} className="text-accent" aria-hidden />
            <span>
              Esta conta ainda usa a senha de instalação.
            </span>
            <Badge tone="outline">Ação recomendada</Badge>
            <Link href="/perfil/seguranca" className="font-semibold underline underline-offset-2">
              Definir uma senha própria
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
