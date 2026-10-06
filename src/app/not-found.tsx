import Link from "next/link";
import { Icons } from "@/components/icons";
import { buttonClass, Panel } from "@/components/ui";

export const metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl py-12">
      <Panel className="p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-sunken text-ink-3" aria-hidden>
          <Icons.search size={22} />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">Esta página não existe</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-3">
          O meme que você procurou pode ter sido renomeado, removido pela administração ou nunca ter sido
          catalogado. Você pode pesquisar pelo nome ou explorar o catálogo completo.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/memes" className={buttonClass("primary", "md")}>
            <Icons.compass size={16} aria-hidden />
            Explorar memes
          </Link>
          <Link href="/contribuir" className={buttonClass("secondary", "md")}>
            <Icons.plus size={16} aria-hidden />
            Adicionar este meme
          </Link>
          <Link href="/" className={buttonClass("ghost", "md")}>
            Voltar ao início
          </Link>
        </div>
      </Panel>
    </div>
  );
}
