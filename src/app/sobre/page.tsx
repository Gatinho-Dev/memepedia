import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, Panel } from "@/components/ui";
import { Icons } from "@/components/icons";

export const metadata: Metadata = {
  title: "Sobre a Memepedia",
  description:
    "A Memepedia é a enciclopédia livre dos memes da internet: origem, contexto e história documentados de forma colaborativa, com curadoria editorial.",
};

const STEPS = [
  {
    icon: <Icons.edit size={16} aria-hidden />,
    title: "1. Contribuição",
    text: "Qualquer pessoa autenticada pode sugerir um meme novo ou corrigir uma página existente. Nada entra no ar imediatamente: o envio vai para a fila de revisão.",
  },
  {
    icon: <Icons.shield size={16} aria-hidden />,
    title: "2. Triagem automática",
    text: "Um sistema de triagem verifica risco de vandalismo, completude e semelhança com páginas existentes. Contribuições de baixo risco aceleram na fila.",
  },
  {
    icon: <Icons.checkCircle size={16} aria-hidden />,
    title: "3. Revisão editorial",
    text: "Moderadores e administradores aprovam, pedem alterações ou rejeitam com motivo registrado. Aprovada, a contribuição vira conteúdo oficial e cria uma versão no histórico.",
  },
  {
    icon: <Icons.history size={16} aria-hidden />,
    title: "4. Histórico permanente",
    text: "Cada mudança publicada é uma versão. Qualquer leitor consulta o histórico, compara versões e a equipe pode reverter em um clique.",
  },
];

export default function AboutPage() {
  return (
    <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <Badge tone="accent">Sobre o projeto</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        A enciclopédia livre dos memes da internet
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">
        A Memepedia cataloga, documenta e preserva memes — não como galeria de imagens, mas como base de
        conhecimento: de onde vieram, como são usados e como evoluíram. O conteúdo é construído de forma
        colaborativa, no espírito da Wikipédia, com curadoria editorial para manter a qualidade.
      </p>

      <Panel className="mt-8 overflow-hidden p-0">
        <div className="border-b border-line-soft px-5 py-4">
          <h2 id="revisao" className="text-[1.0625rem] font-semibold text-ink">
            Como funciona a revisão
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            Colaborativo não significa sem controle. Todo conteúdo passa por este pipeline antes de ser oficial.
          </p>
        </div>
        <ol className="grid gap-0 sm:grid-cols-2">
          {STEPS.map((step) => (
            <li key={step.title} className="border-b border-line-soft px-5 py-4 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0">
              <div className="flex items-center gap-2 text-ink">
                <span className="text-accent">{step.icon}</span>
                <h3 className="text-sm font-semibold">{step.title}</h3>
              </div>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-3">{step.text}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <section className="article mt-8">
        <h2>Papéis e permissões</h2>
        <p>
          A plataforma tem seis níveis de acesso. <strong>Visitantes</strong> leem, pesquisam e exploram tudo.{" "}
          <strong>Usuários autenticados</strong> sugerem memes, propõem correções e comentam.{" "}
          <strong>Colaboradores</strong> recebem benefícios de taxa de envio após contribuições bem avaliadas.{" "}
          <strong>Moderadores</strong> revisam a fila e cuidam de denúncias. <strong>Administradores</strong>{" "}
          administram categorias, usuários e configurações. E existe um papel único,{" "}
          <strong>OWNER</strong>, com controle absoluto sobre a plataforma — incluindo administrar os próprios
          administradores e transferir a titularidade. Não há caminho que conceda privilégios de OWNER a outro
          usuário: só o próprio dono, ou a transferência formal feita por ele.
        </p>

        <h2>Por que revisão?</h2>
        <p>
          Memes vivem de contexto — e contexto errado é pior que nenhum contexto. A fila de revisão existe para
          garantir que datas, origens e usos descritos sejam verificáveis. Quando uma informação não tem fonte,
          ela é marcada como não confirmada em vez de removida: a enciclopédia prefere honestidade a certeza
          falsa.
        </p>

        <h2>Código aberto de conduta editorial</h2>
        <p>
          Escrevemos de forma informativa, não como piada: um artigo de meme pode ser divertido, mas a prioridade
          é documentar. Sem fonte, sem afirmação categórica. Sem curiosidade verificável, sem curiosidade. O
          <Link href="/codigo-de-conduta"> código de conduta</Link> detalha o que esperamos de contribuições e de
          convivência.
        </p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/contribuir">
          <Icons.plus size={16} aria-hidden />
          Contribuir com um meme
        </ButtonLink>
        <ButtonLink href="/memes" variant="secondary">
          <Icons.compass size={16} aria-hidden />
          Explorar o catálogo
        </ButtonLink>
      </div>
    </main>
  );
}
