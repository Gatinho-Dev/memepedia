import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { Badge, ButtonLink, Panel, SectionHeading } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata: Metadata = {
  title: "Contribuir",
  description: "Sugira um meme novo ou proponha correções. Toda contribuição passa por revisão editorial.",
};

const RULES = [
  "Pesquise antes de criar: use o campo de busca para evitar páginas duplicadas.",
  "Escreva para informar. O texto pode ser divertido, mas documentação vem primeiro.",
  "Cite fontes quando existirem — e diga “não confirmado” quando não existirem.",
  "Imagem em boa resolução, sem marca d’água de terceiros quando possível.",
];

export default async function ContributePage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const user = await currentUser();
  const { aba } = await searchParams;
  const correctionMode = aba === "correcao";

  return (
    <main id="conteudo" className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
      <Badge tone="accent">Contribuir</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Ajude a construir a enciclopédia
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">
        A Memepedia é escrita por contribuidores e revisada pela equipe. Escolha o tipo de contribuição:
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Panel className={correctionMode ? "p-5" : "p-5 ring-1 ring-accent"}>
          <div className="flex items-center gap-2">
            <span className="text-accent">
              <Icons.plus size={18} aria-hidden />
            </span>
            <h2 className="text-[1.0625rem] font-semibold text-ink">Sugerir um meme novo</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-3">
            Para memes que ainda não têm página. O formulário pede nome, imagem, descrição, origem, contexto,
            categoria, tags e fontes — o essencial para um artigo bom desde o primeiro dia.
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-[0.8125rem] text-ink-3">
            <li>• Triagem automática contra duplicatas;</li>
            <li>• Fila de revisão com aprovador identificado;</li>
            <li>• Você acompanha o status em Minhas contribuições.</li>
          </ul>
          <div className="mt-4">
            {user ? (
              <ButtonLink href="/contribuir/novo">
                <Icons.edit size={15} aria-hidden />
                Abrir formulário
              </ButtonLink>
            ) : (
              <ButtonLink href="/entrar?proximo=/contribuir/novo">
                <Icons.signIn size={15} aria-hidden />
                Entrar para contribuir
              </ButtonLink>
            )}
          </div>
        </Panel>

        <Panel className={correctionMode ? "p-5 ring-1 ring-accent" : "p-5"}>
          <div className="flex items-center gap-2">
            <span className="text-accent">
              <Icons.diff size={18} aria-hidden />
            </span>
            <h2 className="text-[1.0625rem] font-semibold text-ink">Sugerir uma correção</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-3">
            Para memes que já têm página. Abra o meme, use <strong>Sugerir alteração</strong> e marque o que
            muda: descrição, origem, datas, categoria, tags, imagem. A sugestão é salva como proposta de edição
            com status rastreável.
          </p>
          <p className="mt-3 text-[0.8125rem] text-ink-3">
            Não sabe o endereço do meme? Procure no{" "}
            <Link href="/memes" className="font-semibold text-accent underline underline-offset-2">
              catálogo
            </Link>{" "}
            e use o botão na própria página.
          </p>
        </Panel>
      </div>

      <section className="mt-10">
        <SectionHeading
          title="Antes de enviar"
          description="Quatro regras que evitam a maior parte das rejeições."
        />
        <Panel className="mt-3 p-0">
          <ol className="flex flex-col">
            {RULES.map((rule, i) => (
              <li key={rule} className="flex items-baseline gap-3 border-b border-line-soft px-5 py-3 text-sm text-ink-2 last:border-b-0">
                <span className="font-mono text-[0.75rem] text-ink-4">{i + 1}.</span>
                {rule}
              </li>
            ))}
          </ol>
        </Panel>
      </section>

      {user ? (
        <p className="mt-8 text-sm text-ink-3">
          Suas contribuições:{" "}
          <Link href="/contribuicoes" className="font-semibold text-accent underline underline-offset-2">
            /contribuicoes
          </Link>
        </p>
      ) : null}
    </main>
  );
}
