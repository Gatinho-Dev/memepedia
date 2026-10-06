import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Panel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Código de conduta",
  description: "Regras de convivência e de contribuição da Memepedia, com o processo de aplicação e recurso.",
};

const RULES = [
  {
    title: "Documente, não vibe",
    text: "Escreva como quem explica, não como quem faz piada. Informação primeiro; humor pode temperar, nunca substituir.",
  },
  {
    title: "Verifique antes de afirmar",
    text: "Data, origem e curiosidades precisam de fonte. Sem fonte, marque como não confirmado — nunca invente precisão.",
  },
  {
    title: "Respeite as pessoas",
    text: "Memes podem ser mordazes; usuários não. Sem ataque pessoal, assédio, doxxing ou discurso de ódio — mesmo citando meme.",
  },
  {
    title: "Não fabrique popularidade",
    text: "Nada de spam, autopromoção disfarçada, votos em massa ou páginas duplicadas para inflar métricas.",
  },
  {
    title: "Sugira, não impulsione",
    text: "Discordou de uma revisão? Abra sugestão com argumento e fonte. Edit wars repetidas resolvem-se em conversa, não em força.",
  },
  {
    title: "Preserve o histórico",
    text: "Nunca apague informação apenas porque incomoda. Corrija com nova versão, com motivo claro; a história fica registrada.",
  },
];

const LADDER = [
  "Aviso privado com link para esta página.",
  "Reversão da edição e anotação no perfil do usuário.",
  "Suspensão temporária de contribuir (de 1 a 30 dias).",
  "Banimento permanente, reservado a assédio, doxxing, vandalismo persistente ou fraudes.",
];

export default function ConductPage() {
  return (
    <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <Badge tone="neutral">Conduta</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Código de conduta
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-2">
        A enciclopédia funciona porque contribuidores confiam uns nos outros. Estas regras são curtas de
        propósito — e aplicáveis por qualquer moderador.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {RULES.map((rule) => (
          <Panel key={rule.title} className="p-4">
            <h2 className="text-[0.9375rem] font-semibold text-ink">{rule.title}</h2>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-3">{rule.text}</p>
          </Panel>
        ))}
      </div>

      <Panel className="mt-6 p-0">
        <div className="border-b border-line-soft px-5 py-4">
          <h2 className="text-[1.0625rem] font-semibold text-ink">Aplicação</h2>
          <p className="mt-1 text-sm text-ink-3">A escalada é progressiva, exceto para faltas graves:</p>
        </div>
        <ol className="flex flex-col">
          {LADDER.map((step, index) => (
            <li key={step} className="flex items-baseline gap-3 border-b border-line-soft px-5 py-3 text-sm text-ink-2 last:border-b-0">
              <span className="font-mono text-[0.75rem] text-ink-4">{index + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
        <div className="px-5 py-4 text-[0.8125rem] text-ink-3">
          Recursos: conteste qualquer decisão escrevendo para a moderação por meio da página{" "}
          <Link href="/denunciar" className="underline underline-offset-2 hover:text-ink">
            Denunciar conteúdo
          </Link>{" "}
          — o caso é revisado por um moderador diferente do que aplicou a sanção.
        </div>
      </Panel>
    </main>
  );
}
