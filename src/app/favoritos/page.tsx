import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { favoriteMemes, followedMemes } from "@/lib/memes";
import { relativeTime } from "@/lib/format";
import { toggleFavoriteAction } from "@/app/actions/meme";
import { MemeCardGrid } from "@/components/meme-card";
import { buttonClass, Alert, Badge, Breadcrumbs, EmptyState, Panel, SectionHeading } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata: Metadata = {
  title: "Favoritos",
  description: "Os memes que você salvou na Memepedia.",
  robots: { index: false, follow: false },
};

export default async function FavoritesPage() {
  const user = await currentUser();
  if (!user) redirect("/entrar?proximo=/favoritos");

  const [favorites, following] = await Promise.all([
    favoriteMemes(user.id),
    followedMemes(user.id),
  ]);

  return (
    <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-12">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Favoritos" }]} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Favoritos</h1>
          <p className="mt-2 max-w-2xl text-[0.9375rem] text-ink-2">
            Sua lista pessoal de leitura. Favoritar é privado; seguir uma página gera notificação quando ela muda.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="outline" icon={<Icons.bookmark size={11} aria-hidden />}>
            {favorites.length} {favorites.length === 1 ? "salvo" : "salvos"}
          </Badge>
          <Badge tone="outline" icon={<Icons.bell size={11} aria-hidden />}>
            {following.length} seguindo
          </Badge>
        </div>
      </div>

      <section className="mt-8">
        <SectionHeading
          as="h2"
          title="Salvos por você"
          description="Memes que você marcou para voltar depois."
        />
        {favorites.length ? (
          <MemeCardGrid memes={favorites} columns={3} />
        ) : (
          <EmptyState
            icon={<Icons.bookmark size={22} aria-hidden />}
            title="Nenhum meme favoritado ainda"
            description="Abra uma página e use “Favoritar” para guardá-la aqui."
            action={
              <Link href="/memes" className={buttonClass("primary", "sm")}>
                <Icons.compass size={14} aria-hidden />
                Explorar o catálogo
              </Link>
            }
          />
        )}
      </section>

      <section className="mt-10">
        <SectionHeading
          as="h2"
          title="Páginas que você segue"
          description="Você recebe uma notificação quando estas páginas mudam."
        />
        {following.length ? (
          <ul className="flex flex-col gap-2">
            {following.map((item) => (
              <li key={item.id}>
                <Panel className="flex flex-wrap items-center gap-3 p-3">
                  <span className="size-14 shrink-0 overflow-hidden rounded-control bg-sunken">
                    {item.thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumb_url}
                        alt=""
                        width={56}
                        height={56}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="grid size-full place-items-center text-ink-4" aria-hidden>
                        <Icons.media size={18} />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/meme/${item.slug}`}
                      className="text-[0.9375rem] font-semibold text-ink hover:text-accent"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 line-clamp-1 text-[0.8125rem] text-ink-3">
                      {item.short_description || "Sem descrição curta."}
                    </p>
                    <p className="mt-1 text-[0.75rem] text-ink-4 tabular">
                      v{item.versions_count} · atualizada {relativeTime(item.updated_at)}
                    </p>
                  </div>
                  <form action={toggleFavoriteAction}>
                    <input type="hidden" name="meme_id" value={item.id} />
                    <input type="hidden" name="return_to" value="/favoritos" />
                    <button type="submit" className={buttonClass("quiet", "sm")}>
                      <Icons.bookmark size={13} aria-hidden />
                      Favoritar
                    </button>
                  </form>
                  <Link href={`/meme/${item.slug}`} className={buttonClass("secondary", "sm")}>
                    Abrir
                  </Link>
                </Panel>
              </li>
            ))}
          </ul>
        ) : (
          <Alert tone="info" title="Você ainda não segue nenhuma página">
            Na página de um meme, use “Seguir meme” para acompanhar as alterações.
          </Alert>
        )}
      </section>
    </main>
  );
}
