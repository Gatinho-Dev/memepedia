import Link from "next/link";
import { count } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { Icons } from "./icons";
import { Logo } from "./logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Explorar",
    links: [
      { label: "Todos os memes", href: "/memes" },
      { label: "Categorias", href: "/categorias" },
      { label: "Tags", href: "/tags" },
      { label: "Mais populares", href: "/populares" },
      { label: "Adicionados recentemente", href: "/recentes" },
      { label: "Meme aleatório", href: "/aleatorio" },
    ],
  },
  {
    title: "Participar",
    links: [
      { label: "Contribuir com um meme", href: "/contribuir" },
      { label: "Sugerir correção", href: "/contribuir?aba=correcao" },
      { label: "Minhas contribuições", href: "/contribuicoes" },
      { label: "Código de conduta", href: "/codigo-de-conduta" },
      { label: "Denunciar conteúdo", href: "/denunciar" },
    ],
  },
  {
    title: "Projeto",
    links: [
      { label: "Sobre a Memepedia", href: "/sobre" },
      { label: "Como funciona a revisão", href: "/sobre#revisao" },
      { label: "Política de conteúdo e direitos autorais", href: "/politica-de-conteudo" },
      { label: "Painel administrativo", href: "/admin" },
      { label: "API pública de leitura", href: "/api/estatisticas" },
    ],
  },
];

export function SiteFooter() {
  const memes = count("SELECT COUNT(*) FROM memes WHERE status = 'published'");
  const versions = count("SELECT COUNT(*) FROM meme_versions");
  const categories = count("SELECT COUNT(*) FROM categories");

  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <Logo withTagline />
            <p className="mt-4 max-w-sm text-[0.8125rem] leading-relaxed text-ink-3">
              A Memepedia documenta a origem, o contexto e a história dos memes da internet. O conteúdo é
              colaborativo e revisado antes de ser publicado.
            </p>
            <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-4">Memes</dt>
                <dd className="font-mono text-lg font-semibold text-ink tabular">{formatNumber(memes)}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-4">Versões</dt>
                <dd className="font-mono text-lg font-semibold text-ink tabular">{formatNumber(versions)}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-4">Categorias</dt>
                <dd className="font-mono text-lg font-semibold text-ink tabular">{formatNumber(categories)}</dd>
              </div>
            </dl>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-3">
                {column.title}
              </h2>
              <ul className="mt-3.5 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[0.8125rem] text-ink-2 transition-colors duration-150 hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line-soft pt-6 text-[0.75rem] text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Icons.shield size={14} className="text-ink-4" aria-hidden />
            <span>
              Conteúdo sob licença livre, salvo indicação em contrário. A Memepedia não reivindica
              propriedade sobre memes enviados por usuários.
            </span>
          </p>
          <p className="shrink-0">
            <Link href="/politica-de-conteudo" className="underline underline-offset-2 hover:text-ink">
              Direitos autorais e remoção
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
