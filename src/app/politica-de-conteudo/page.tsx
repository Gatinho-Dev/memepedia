import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Panel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Política de conteúdo e direitos autorais",
  description:
    "Como a Memepedia lida com direitos autorais, uso de imagens de terceiros, fontes e remoção de conteúdo.",
};

export default function ContentPolicyPage() {
  return (
    <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <Badge tone="neutral">Política</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Política de conteúdo e direitos autorais
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-2">
        A Memepedia documenta cultura; não comercializa imagens. Esta página explica como tratamos autoria,
        uso de mídia de terceiros e remoção de conteúdo.
      </p>

      <Panel className="mt-8 p-0">
        <section className="article px-5 py-5 sm:px-6">
          <h2>1. O que publicamos</h2>
          <p>
            Artigos descrevem memes, sua origem e uso. As imagens aparecem como <em>referência documental</em>,
            em baixa resolução quando possível, sempre acompanhadas de contexto crítico e, quando identificada,
            da fonte original e do autor. Acreditamos que documentação comentada se encaixa em uso justo
            (<em>fair use</em> / uso livre) na maioria das jurisdições — mas cada pedido de remoção é avaliado
            individualmente.
          </p>

          <h2>2. Contribuições e autoria</h2>
          <p>
            Textos enviados são de responsabilidade de quem envia e licenciados para a plataforma exibir
            publicamente, com atribuição ao autor no histórico da página. Copiar verbetes de outros sites
            (Know Your Meme, Wikipédia) sem reescrita e sem citação da fonte é rejeitado na revisão.
          </p>

          <h2>3. Fontes</h2>
          <p>
            Afirmações verificáveis precisam de fonte. Sem fonte, o texto pode entrar marcado como{" "}
            <em>não confirmado</em>. Curiosidades, datas e origens não confirmadas devem dizer isso
            explicitamente — a enciclopédia prefere honestidade a certeza fabricada.
          </p>

          <h2>4. Conteúdo sensível</h2>
          <p>
            Documentamos memes polêmicos, mas não reproduzimos discurso de ódio, assédio coordenado, conteúdo
            sexual envolvendo menores ou material terrorista, sob nenhuma moldura “educativa”. A triagem
            automática e a revisão humana bloqueiam esses envios; denúncias aceleram a remoção.
          </p>

          <h2>5. Remoção e contestação</h2>
          <p>
            Titulares de direitos podem pedir remoção de mídia específica pela página{" "}
            <Link href="/denunciar">Denunciar conteúdo</Link>, indicando a URL e provando a titularidade. A
            equipe responde registrando a decisão no histórico da página; a remoção de mídia não apaga o verbete,
            que continua valendo como documentação textual.
          </p>

          <h2>6. Histórico é permanente</h2>
          <p>
            Versões publicadas permanecem no histórico com autoria, inclusive após reversões — é o que torna o
            registro confiável. Dados pessoais expostos em versões podem ser suprimidos a pedido, conforme
            legislação de proteção de dados aplicável.
          </p>
        </section>
      </Panel>
    </main>
  );
}
