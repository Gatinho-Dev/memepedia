import "server-only";
import { all, get, pluck, run, tx, dayKey, reindexMeme, reindexUser } from "./db";
import { hashPassword, logAudit } from "./auth";
import { MEME_FIELDS } from "./types";

/**
 * Demo content.
 *
 * These entries describe real memes with hedged, sourced-in-spirit wording.
 * Every seeded media item is flagged `is_placeholder`, and seeded memes carry
 * `is_demo = 1`, so the interface can label them as initial/demo content rather
 * than presenting them as verified editorial work.
 */

export const OWNER_PASSWORD = "memepedia-owner-2026";
export const DEMO_PASSWORD = "memepedia-demo-2026";

const CATEGORIES: { slug: string; name: string; group: string; description: string; order: number }[] = [
  { slug: "reaction", name: "Reaction", group: "Formato", description: "Imagens e vídeos usados para reagir a uma situação.", order: 10 },
  { slug: "humor", name: "Humor", group: "Formato", description: "Memes cujo núcleo é a piada, a ironia ou o absurdo.", order: 20 },
  { slug: "videos-virais", name: "Vídeos virais", group: "Formato", description: "Trechos de vídeo que se tornaram piada recorrente.", order: 30 },
  { slug: "animais", name: "Animais", group: "Tema", description: "Bichos que viraram personagens da internet.", order: 40 },
  { slug: "gaming", name: "Gaming", group: "Tema", description: "Memes nascidos em jogos e comunidades de jogadores.", order: 50 },
  { slug: "filmes", name: "Filmes", group: "Tema", description: "Cenas e falas de cinema reaproveitadas como piada.", order: 60 },
  { slug: "series", name: "Séries", group: "Tema", description: "Memes vindos de séries, novelas e programas de TV.", order: 70 },
  { slug: "celebridades", name: "Celebridades", group: "Tema", description: "Famosos que viraram meme.", order: 80 },
  { slug: "politica", name: "Política", group: "Tema", description: "Memes de contexto político.", order: 90 },
  { slug: "esportes", name: "Esportes", group: "Tema", description: "Momentos esportivos que a internet não esqueceu.", order: 100 },
  { slug: "tecnologia", name: "Tecnologia", group: "Tema", description: "Memes sobre programação, IA e cultura digital.", order: 110 },
  { slug: "tiktok", name: "TikTok", group: "Plataforma", description: "Memes que nasceram ou se espalharam no TikTok.", order: 120 },
  { slug: "instagram", name: "Instagram", group: "Plataforma", description: "Formatos difundidos no feed, nos stories e nos reels.", order: 130 },
  { slug: "youtube", name: "YouTube", group: "Plataforma", description: "Memes originados em vídeos e canais do YouTube.", order: 140 },
  { slug: "brasil", name: "Brasil", group: "Região", description: "Memes criados ou adotados pelo público brasileiro.", order: 150 },
  { slug: "internacional", name: "Internacional", group: "Região", description: "Memes de circulação global.", order: 160 },
  { slug: "classicos-da-internet", name: "Clássicos da internet", group: "Época", description: "Memes que atravessaram mais de uma década.", order: 170 },
  { slug: "memes-de-2000", name: "Memes de 2000", group: "Época", description: "A fase dos fóruns, do Orkut e dos primeiros virais.", order: 180 },
  { slug: "memes-de-2010", name: "Memes de 2010", group: "Época", description: "A década das redes sociais e do Tumblr.", order: 190 },
  { slug: "memes-de-2020", name: "Memes de 2020", group: "Época", description: "Memes da pandemia, do TikTok e do vídeo curto.", order: 200 },
  { slug: "memes-atuais", name: "Memes atuais", group: "Época", description: "O que está circulando agora.", order: 210 },
];

type SeedMeme = {
  slug: string;
  name: string;
  category: string;
  tags: string[];
  approx_year: number;
  approx_period: string;
  country: string;
  region: string;
  short_description: string;
  origin: string;
  history: string;
  usage_notes: string;
  characteristics: string;
  variations: string;
  trivia: string;
  sources: string;
  verified?: boolean;
  featured?: boolean;
  author: string;
  /** deterministic popularity seed */
  heat: number;
};

const MEMES: SeedMeme[] = [
  {
    slug: "doge",
    name: "Doge",
    category: "animais",
    tags: ["cachorro", "shiba-inu", "classico", "sarcasmo", "internacional"],
    approx_year: 2010,
    approx_period: "2010, com pico entre 2013 e 2014",
    country: "Japão",
    region: "Origem fotográfica no Japão; popularização nos Estados Unidos",
    short_description:
      "Doge é um meme baseado na fotografia de uma cachorra da raça Shiba Inu chamada Kabosu, combinada com legendas em inglês quebrado escritas em fonte Comic Sans.",
    origin: `A imagem central do meme é uma fotografia de Kabosu, uma Shiba Inu que vivia com a professora japonesa Atsuko Sato. As fotos foram publicadas em um blog pessoal por volta de **2010** e mostravam a cadela sentada, com as patas dianteiras juntas e um olhar de soslaio.

Segundo relatos da própria tutora, a foto foi feita depois de um resgate: Kabosu havia sido abandonada e foi adotada em 2008. A expressão que a internet leu como "desconfiada" era, na verdade, apenas o jeito da cadela olhar para a câmera.

O formato com legendas surgiu em comunidades do Tumblr e do Reddit entre 2010 e 2012, quando usuários começaram a escrever frases curtas em inglês deliberadamente incorreto, sempre em Comic Sans, como "such wow", "very scare" e "much amaze".`,
    history: `O meme ganhou escala global em **2013**, quando passou a circular fora dos círculos de nicho. Nesse período, a combinação de Shiba Inu + Comic Sans já era reconhecível o suficiente para aparecer em camisetas, campanhas publicitárias e até em uma campanha política nos Estados Unidos.

- **2013** — popularização massiva e criação de dezenas de "doge generators", ferramentas que montavam a imagem com legendas automaticamente.
- **2014** — surgem variações com outros animais, como o gato "Grumpy Cat" adaptado ao formato e versões com corgis e huskies.
- **2021** — o Doge volta ao noticiário por causa do Dogecoin, criptomoeda criada em 2013 como piada e que passou a ter valor de mercado relevante.
- **2024** — a morte de Kabosu, em maio, gerou uma onda de homenagens e reacendeu a circulação do meme.

O Doge é frequentemente citado como um dos primeiros memes a fazer a transição completa de piada de fórum para ativo cultural e financeiro.`,
    usage_notes: `O Doge é usado principalmente como reação leve: a imagem funciona como um selo de surpresa, aprovação ou desconforto. Em vez de dizer "estou confuso", a pessoa publica o cachorro com uma legenda como "much confuse".

Também é comum em contextos onde o humor está no contraste entre a formalidade do assunto e a gramática quebrada do meme, como comentários sobre economia, burocracia ou decisões corporativas.

A estrutura "such X, very Y, much Z" continua sendo reaproveitada mesmo por quem nunca viu a imagem original, o que faz do Doge um formato além de uma imagem.`,
    characteristics: `- **Formato fixo:** foto do cachorro em ângulo levemente lateral, com o rosto ocupando boa parte do quadro.
- **Tipografia característica:** Comic Sans, geralmente multicolorida e sem alinhamento rígido.
- **Gramática própria:** inglês incorreto de forma consistente, com repetição de "such", "very" e "much".
- **Tom:** inocente na aparência, irônico no uso.`,
    variations: `- **Doge original:** apenas a foto com legendas multicoloridas.
- **Iron Doge:** versões em preto e branco ou com legenda em contraste, usadas para piadas mais secas.
- **Crypto Doge:** a mesma foto associada ao Dogecoin e a gráficos de mercado.
- **Outros animais:** gatos, corgis e até animais silvestres adaptados ao mesmo formato de legenda.
- **Doge moderno:** recortes da cabeça usados como figurinha em aplicativos de mensagem.`,
    trivia: `- Segundo relatos amplamente reproduzidos, uma das fotos mais famosas foi tirada num dia frio, e Kabosu aparece sentada porque estava aquecendo as patas.
- A Comic Sans é parte da identidade do meme: trocar a fonte costuma ser tratado como erro de reconstrução.
- O Dogecoin foi criado em 2013 por Billy Markus e Jackson Palmer e chegou a ser a primeira criptomoeda a atingir valor de mercado relevante partindo de uma piada.`,
    sources: `- Blog pessoal de Atsuko Sato (fotos originais de Kabosu).
- Cobertura jornalística de 2013 a 2024 sobre a popularização do meme e o Dogecoin.
- Arquivos de fóruns e do Tumblr do período de 2010 a 2012, usados para datar o formato de legenda.`,
    verified: true,
    featured: true,
    author: "tiagomendonca",
    heat: 100,
  },
  {
    slug: "stonks",
    name: "Stonks",
    category: "humor",
    tags: ["mercado", "ironia", "meme-man", "economia", "internacional"],
    approx_year: 2017,
    approx_period: "2017, com pico em 2019 e 2020",
    country: "Estados Unidos",
    region: "Origem em fóruns de investimento; adoção global",
    short_description:
      "Stonks é uma variação ortográfica proposital de 'stocks' usada sobre a imagem do Meme Man, um rosto humano 3D simplificado, para zombar de decisões financeiras ruins apresentadas como geniais.",
    origin: `O rosto usado no meme é o **Meme Man**, um modelo humano 3D de baixa poliagem criado pelo artista conhecido como Samer il e popularizado em 2017 em comunidades de arte surrealista e de fóruns como o Reddit.

A palavra "stonks" apareceu como erro proposital de "stocks" (ações). A piada funciona porque o personagem tem expressão solene enquanto a decisão descrita é desastrosa.

A combinação consolidou-se em **2018 e 2019** em subreddits de economia e em páginas de humor, quando o formato passou a ser aplicado a qualquer área, não apenas a finanças.`,
    history: `- **2017** — o Meme Man circula em fóruns de arte surrealista com legendas absurdas.
- **2018** — a legenda "STONKS" é associada ao personagem em subreddits de investimento.
- **2019** — o formato se fixa como "homem de terno faz uma pergunta, o Meme Man responde 'stonks'", usado para satirizar conselhos financeiros duvidosos.
- **2020** — a volatilidade do mercado durante a pandemia e o episódio de ações de varejo aumentam a circulação do meme.
- **2021 em diante** — "stonks" vira gíria, usada fora da imagem original para descrever qualquer resultado que foi o contrário de um bom plano.

Hoje o meme é frequentemente citado como exemplo de formato que sobreviveu à própria imagem: a palavra continua em uso mesmo por quem não reconhece o personagem.`,
    usage_notes: `O Stonks aparece em três situações principais:

1. **Zombar de decisão ruim** apresentada como estratégia brilhante.
2. **Comentar resultados inesperadamente positivos** por motivos absurdos ou ilegítimos.
3. **Ironizar previsões** de especialistas quando o oposto acontece.

É comum em memes de duas partes: uma pergunta formal e uma resposta "stonks", com o contraste entre a seriedade do formato e a irracionalidade do resultado.`,
    characteristics: `- **Imagem base:** rosto 3D simplificado, com superfícies lisas e expressão neutra.
- **Fundo:** geralmente removido, aplicado sobre gráficos, telas de terminal ou imagens de mercado.
- **Tipografia:** caixa alta, sans-serif, sem enfeite.
- **Estrutura narrativa:** promessa séria, resultado absurdo.`,
    variations: `- **Not Stonks:** variação invertida, usada quando o resultado foi ruim de verdade.
- **Stonks invertido:** imagem espelhada, sinalizando lucro por acidente.
- **Stonks de outras áreas:** "medicina stonks", "educação stonks" e usos temáticos.
- **Gráficos falsos:** linhas de mercado desenhadas à mão sobre a imagem.`,
    trivia: `- O nome do personagem nunca foi oficialmente definido pelo autor; "Meme Man" foi adotado pela comunidade.
- A grafia "stonks" é parte obrigatória da piada: escrever corretamente costuma ser lido como quebra do formato.
- O meme é usado com frequência em materiais de educação financeira justamente para ilustrar o comportamento que ele satiriza.`,
    sources: `- Arquivos de subreddits de investimento de 2018 a 2020, usados para datar a consolidação do formato.
- Publicações de humor digital sobre a evolução do Meme Man.
- Cobertura jornalística de 2020 sobre o uso do meme em contexto de mercado.`,
    verified: true,
    featured: true,
    author: "brunaokada",
    heat: 86,
  },
  {
    slug: "nazare-confusa",
    name: "Nazaré Confusa",
    category: "reaction",
    tags: ["novela", "brasil", "reaction", "confusao", "gif"],
    approx_year: 2016,
    approx_period: "2016 a 2019",
    country: "Brasil",
    region: "Nacional",
    short_description:
      "Nazaré Confusa é um GIF da personagem Nazaré Tedesco, da novela Senhora do Destino, usado para expressar incompreensão diante de algo absurdo.",
    origin: `A personagem é de **Senhora do Destino**, novela exibida pela TV Globo em 2004 e 2005, interpretada por **Renata Sorrah**. O GIF que virou meme mostra a personagem fazendo uma expressão de espanto contido, com os olhos arregalados e a cabeça levemente inclinada.

Os recortes começaram a circular em grupos de WhatsApp e no Twitter brasileiro por volta de **2016**, quando GIFs de novelas antigas voltaram a ter circulação massiva.

Segundo relatos de páginas de memes da época, a escolha da cena teria sido motivada justamente pela expressão: o rosto funciona para qualquer situação de "eu não entendi nada".`,
    history: `- **2004** — a novela vai ao ar e a personagem se torna uma das vilãs mais lembradas da teledramaturgia brasileira.
- **2016** — o GIF ganha circulação ampla em grupos de mensagens e no Twitter.
- **2017 a 2019** — o meme se consolida como resposta padrão no Brasil a notícias confusas, decisões inexplicáveis e discussões sem sentido.
- **Depois de 2020** — a imagem entra no repertório de figurinhas e passa a ser usada até por quem não assistiu à novela.

O meme é um caso típico de formato brasileiro: nasce de um produto de televisão e sobrevive muito depois do fim da exibição original.`,
    usage_notes: `É usado como reação em três contextos recorrentes:

- Ao receber uma informação contraditória ou sem lógica aparente.
- Como resposta a um comentário que não faz sentido.
- Para marcar ironicamente uma situação em que "a pessoa confusa" é o próprio autor da mensagem.

Em conversas de trabalho, aparece com frequência em reuniões cujo resultado não é claro, o que explica parte da longevidade do formato no ambiente corporativo brasileiro.`,
    characteristics: `- **Formato:** GIF curto, em resolução modesta, com legenda em caixa alta adicionada pela comunidade.
- **Expressão:** espanto contido, sobrancelhas levantadas, olhar desviado.
- **Uso:** predominantemente reativo, sem texto próprio.
- **Duração:** poucos segundos, em looping.`,
    variations: `- **Nazaré com legenda:** "não entendi", "como assim?" e variações.
- **Nazaré desconfortável:** recortes com a personagem em outras cenas.
- **Nazaré computacional:** versões com código ou diagramas ao fundo, comuns entre programadores.
- **Crossovers:** edições que colocam a personagem ao lado de outros memes brasileiros.`,
    trivia: `- A novela que originou o meme foi reprisada várias vezes, o que renovou o público do GIF a cada exibição.
- O meme é citado em listas de "memes brasileiros que atravessaram gerações" por funcionar igualmente para públicos de idades muito diferentes.
- Boa parte das versões em circulação perdeu qualidade de imagem ao longo dos anos, e a pixelização passou a ser tratada como parte do charme.`,
    sources: `- Registros de circulação em redes sociais entre 2016 e 2019.
- Ficha técnica da novela Senhora do Destino, exibida em 2004 e 2005.
- Arquivos de páginas de memes brasileiras do período.`,
    verified: true,
    featured: true,
    author: "rafacavalcante",
    heat: 92,
  },
  {
    slug: "distracted-boyfriend",
    name: "Distracted Boyfriend",
    category: "reaction",
    tags: ["namorado-distraido", "reaction", "banco-de-imagens", "internacional", "tentacao"],
    approx_year: 2015,
    approx_period: "foto em 2015; meme consolidado em 2017",
    country: "Espanha",
    region: "Origem fotográfica em Barcelona; uso global",
    short_description:
      "Distracted Boyfriend é uma foto de banco de imagens em que um homem olha para outra mulher enquanto caminha com a namorada, usada para representar qualquer escolha entre duas opções.",
    origin: `A fotografia foi produzida pelo fotógrafo espanhol **Antonio Guillem** para bancos de imagens, com atores contratados em uma encenação de rua em Barcelona, por volta de **2015**.

Como toda imagem de banco, ela existia sem intenção de se tornar piada. O que a transformou em meme foi a legibilidade instantânea da cena: três pessoas, três papéis, uma tensão evidente.

O formato começou a ser usado como meme por volta de **2017**, sobretudo no Twitter, quando os usuários perceberam que dava para etiquetar os três personagens com qualquer trio de conceitos.`,
    history: `- **2015** — a foto é produzida e distribuída por banco de imagens.
- **2017** — o meme explode com a estrutura de três etiquetas: o casal distraído, a pessoa que causa a distração e o suposto "objeto de desejo".
- **2018** — o formato é incorporado por marcas, veículos de imprensa e campanhas institucionais.
- **2019 em diante** — passa a ser usado como modelo de "meme de escolha" em aulas de comunicação e marketing.

A foto é um dos exemplos mais citados de meme nascido de conteúdo licenciado, o que levanta discussões recorrentes sobre direitos de uso comercial.`,
    usage_notes: `A estrutura clássica tem três posições:

1. **O alvo da escolha** (a pessoa distraída), etiquetada com o compromisso atual.
2. **O objeto de desejo**, etiquetado com a tentação.
3. **Quem é deixado de lado** (a namorada), etiquetada com o que está sendo negligenciado.

O meme é usado para falar de prioridades: trabalho e hobby, plano e impulso, compromisso e novidade. Funciona melhor quando as três etiquetas formam uma contradição reconhecível, não apenas uma piada aleatória.`,
    characteristics: `- **Composição:** três pessoas, plano médio, profundidade de campo marcada.
- **Legibilidade:** a leitura da cena depende de movimento, não de texto.
- **Neutralidade:** a imagem aceita praticamente qualquer conjunto de etiquetas.
- **Qualidade:** alta definição, já que vem de produção profissional.`,
    variations: `- **Distracted Boyfriend comercial:** versões de marcas, com produtos nas etiquetas.
- **Versões institucionais:** usadas por veículos para explicar decisões econômicas ou políticas.
- **Edições temáticas:** com personagens de jogos, filmes e séries.
- **Distracted Boyfriend invertido:** com os papéis embaralhados para inverter a piada.`,
    trivia: `- O fotógrafo relatou, em entrevistas, que a cena foi inteiramente encenada e que as pessoas da foto são modelos contratados.
- A imagem é frequentemente usada em apresentações corporativas, o que gerou discussão sobre o uso de memes em contexto de trabalho.
- O meme é um dos casos mais estudados de "imagem de banco convertida em formato".`,
    sources: `- Entrevistas públicas do fotógrafo Antonio Guillem sobre a produção da imagem.
- Cobertura jornalística de 2017 e 2018 sobre a popularização do formato.
- Página do banco de imagens de origem.`,
    verified: true,
    author: "julianaprado",
    heat: 64,
  },
  {
    slug: "this-is-fine",
    name: "This Is Fine",
    category: "classicos-da-internet",
    tags: ["quadrinhos", "caos", "cachorro", "sarcasmo", "internacional"],
    approx_year: 2013,
    approx_period: "2013, com uso contínuo desde então",
    country: "Estados Unidos",
    region: "Origem em webcomic; adoção global",
    short_description:
      "This Is Fine é um quadrinho em que um cachorro sentado em um ambiente em chamas afirma que está tudo bem, usado para representar crises ignoradas.",
    origin: `A imagem faz parte de uma tira da webcomic **Gunshow**, do cartunista **KC Green**, publicada em **janeiro de 2013** sob o título "The Pills Are Working".

Na tira completa, o cachorro senta em uma sala que começa a pegar fogo enquanto conversa calmamente. O painel final, com a frase "This is fine", é o recorte que virou meme.

O recorte começou a circular isoladamente no **Tumblr e no Reddit** ainda em 2013 e se consolidou em 2016, quando passou a ser aplicado a notícias ruins, crises políticas e instabilidade econômica.`,
    history: `- **2013** — a tira original é publicada e o último painel começa a circular isolado.
- **2016** — o meme se consolida como reação a notícias sucessivas de crise.
- **2017 e 2018** — aparece em capas de revistas, campanhas e produtos licenciados.
- **2020** — a pandemia provoca novo pico de circulação, com dezenas de variações.
- **2021 em diante** — vira expressão cotidiana para descrever sobrecarga e normalização de problemas.

O autor declarou publicamente que passou a licenciar a imagem para uso comercial, mantendo a tira original disponível em seu site.`,
    usage_notes: `O meme funciona como sinal de saturação: a pessoa reconhece que existe um problema grave e comunica, com ironia, que não vai fazer nada a respeito agora.

- **No trabalho:** usado em relatórios informais, descrição de sprints e comentários internos sobre prazos impossíveis.
- **Em notícias:** reação a sequências de acontecimentos ruins.
- **Em conversas pessoais:** resposta a problemas acumulados.

A frase "I'm okay with the events that are unfolding currently" aparece em versões que citam o texto original da tira.`,
    characteristics: `- **Estilo:** traço simples de webcomic, com cor saturada nas chamas.
- **Enquadramento:** o cachorro ocupa o centro-esquerda; o fogo é o contexto.
- **Contraste:** expressão neutra do personagem contra um ambiente destrutivo.
- **Texto:** curto, quase sempre a mesma frase.`,
    variations: `- **This Is Fine com etiquetas:** o fogo ganha legendas com o problema em questão.
- **Voltando ao quadrinho completo:** uso da tira inteira em vez do recorte.
- **Versões animadas:** GIFs com as chamas em movimento.
- **Adaptações temáticas:** sistemas de software com o cachorro ao lado de painéis de monitoramento.`,
    trivia: `- O título original da tira, "The Pills Are Working", raramente aparece nas versões virais.
- O autor disponibiliza a imagem para licenciamento e pede atribuição em usos públicos.
- O meme é citado com frequência em textos sobre saúde mental no trabalho, o que deu ao recorte um segundo significado além da piada.`,
    sources: `- Tira original publicada em Gunshow, janeiro de 2013.
- Entrevistas do cartunista KC Green sobre licenciamento da imagem.
- Cobertura jornalística de 2016 e 2020 sobre o uso do meme.`,
    verified: true,
    featured: true,
    author: "tiagomendonca",
    heat: 74,
  },
  {
    slug: "e-sobre-isso",
    name: "É sobre isso",
    category: "brasil",
    tags: ["brasil", "expressao", "twitter", "frase", "atual"],
    approx_year: 2020,
    approx_period: "2020 em diante",
    country: "Brasil",
    region: "Nacional",
    short_description:
      "É sobre isso é uma expressão brasileira usada para encerrar um assunto concordando de forma enfática e geralmente irônica, muitas vezes acompanhada de 'e tá tudo bem'.",
    origin: `A expressão não nasceu de uma imagem única, mas da consolidação de uma fala que já existia na conversa brasileira. Ela se espalhou massivamente no **Twitter e no TikTok brasileiros por volta de 2020**, em postagens que encerram uma discussão com "é sobre isso e tá tudo bem".

O formato ganhou força porque funciona como ponto final retórico: encerra uma argumentação sem exigir que a outra pessoa concorde ou responda.

É um exemplo de meme que é **texto puro**, sem imagem obrigatória, o que dificulta a datação exata de origem.`,
    history: `- **2020** — a frase se espalha em postagens de Twitter e vira bordão.
- **2021** — aparece em legendas de vídeo curto e em produtos de marcas brasileiras.
- **2022 em diante** — passa a ser usada também de forma crítica, ironizando quem usa o bordão para encerrar debates sem argumento.

Pela ausência de um elemento visual fixo, o meme é datado de forma aproximada a partir de registros de circulação em redes sociais, e não de um post original identificado.`,
    usage_notes: `Aplicações mais comuns:

- **Encerrar uma discussão** com concordância enfática.
- **Reagir a uma observação banal** elevando-a a princípio de vida.
- **Ironizar** alguém que conclui discussões complexas com frases definitivas.

O uso irônico é hoje tão frequente quanto o uso sincero, o que faz da frase uma expressão ambígua: depende inteiramente do contexto em que é publicada.`,
    characteristics: `- **Formato:** texto, geralmente sem imagem.
- **Extensão:** duas partes, "é sobre isso" e "e tá tudo bem".
- **Tom:** afirmativo na superfície, irônico com frequência.
- **Portabilidade:** funciona em legenda, comentário, figurinha e vídeo.`,
    variations: `- **"É sobre isso e tá tudo bem":** versão completa, mais enfática.
- **"Sobre isso aí, é sobre isso":** variação de resposta.
- **"Não é sobre X, é sobre Y":** estrutura derivada usada para reinterpretar situações.
- **Figurinhas:** versões com imagens de brasileiros famosos repetindo a frase.`,
    trivia: `- É um dos memes brasileiros mais difíceis de datar, porque não tem uma imagem ou vídeo original identificável.
- A ausência de elemento visual faz com que o meme seja reaproveitado até em contextos formais, como legendas de reportagens.
- Parte da longevidade vem da adaptabilidade: qualquer pessoa pode usar a frase sem conhecer o meme.`,
    sources: `- Registros de circulação em redes sociais a partir de 2020.
- Publicações brasileiras de análise de linguagem digital sobre bordões da década.
- Arquivos de buscas públicas de termos associados à expressão.`,
    author: "julianaprado",
    heat: 58,
  },
  {
    slug: "surprised-pikachu",
    name: "Pikachu Surpreso",
    category: "reaction",
    tags: ["pokemon", "gaming", "reaction", "anime", "ironia"],
    approx_year: 2018,
    approx_period: "2018, com uso contínuo",
    country: "Japão",
    region: "Origem no anime; popularização nos Estados Unidos",
    short_description:
      "Pikachu Surpreso é um quadro do anime Pokémon em que o personagem abre a boca com espanto, usado para reagir a consequências previsíveis.",
    origin: `O quadro usado no meme vem do **anime Pokémon**, em uma cena em que o personagem faz uma expressão exagerada de surpresa. O recorte começou a circular como meme por volta de **2018**.

O que definiu o formato não foi a imagem em si, mas o uso: ela passou a ilustrar situações em que a pessoa finge surpresa diante de um resultado que ela mesma causou.

A estrutura clássica combina a imagem com um texto que descreve a expectativa do personagem e, em seguida, o resultado evidente.`,
    history: `- **2018** — o recorte circula no Twitter e em fóruns de jogos, com a estrutura de expectativa e resultado.
- **2019** — passa a ser usado em críticas a produtos, serviços e decisões corporativas.
- **2020 em diante** — consolidação como meme de reação geral, usado fora do contexto de jogos.

O meme é um dos poucos casos em que a franquia de origem não participa ativamente da piada: a imagem funciona mesmo para quem nunca assistiu ao anime.`,
    usage_notes: `Formato mais comum:

1. Descrição de uma ação ou decisão.
2. Imagem do Pikachu surpreso.
3. Descrição do resultado óbvio.

É usado para expor falsa ingenuidade, especialmente em discussões sobre tecnologia, atendimento ao cliente e decisões de gestão. Também aparece sozinho, apenas como reação de espanto.`,
    characteristics: `- **Recorte:** boca aberta, olhos arregalados, fundo neutro ou removido.
- **Estrutura:** quase sempre em duas partes de texto.
- **Uso:** reativo e argumentativo.
- **Formato:** imagem estática virou GIF e figurinha.`,
    variations: `- **Pikachu espelhado:** versão invertida usada para variar o layout.
- **Pikachu surpreso duplo:** duas cópias da imagem lado a lado.
- **Variações com outros personagens:** o mesmo enquadramento aplicado a outros animes.
- **Pikachu corporativo:** versões usadas em apresentações sobre gestão de risco.`,
    trivia: `- O meme popularizou, fora do Brasil, a estrutura que aqui costuma ser resumida como "quem diria, né?".
- Pela origem em franquia licenciada, versões comerciais do meme ficam sujeitas a regras de direitos autorais.
- A expressão tornou-se tão associada à falsa surpresa que passou a ser usada como crítica a comunicados oficiais.`,
    sources: `- Registros de circulação em redes sociais a partir de 2018.
- Arquivos de fóruns de jogos do período.
- Cobertura de veículos de cultura digital sobre memes de reação.`,
    author: "brunaokada",
    heat: 47,
  },
  {
    slug: "chaves",
    name: "Chaves",
    category: "series",
    tags: ["chaves", "brasil", "serie", "classico", "figurinha"],
    approx_year: 2005,
    approx_period: "circulação contínua; pico em redes sociais a partir de 2015",
    country: "México",
    region: "Origem mexicana; forte adoção no Brasil",
    short_description:
      "Chaves é um dos conjuntos de memes mais persistentes do Brasil: falas e cenas do seriado mexicano são reaproveitadas há décadas como piada pronta, gerando as chamadas 'figurinhas de Chaves'.",
    origin: `O seriado **El Chavo del Ocho**, criado e protagonizado por **Roberto Gómez Bolaños**, foi produzido no México a partir de 1971 e exibido no Brasil desde os anos 1980 pelo SBT.

A repetição exaustiva das reprises fez com que o público brasileiro memorizasse falas inteiras, o que criou as condições perfeitas para o reaproveitamento como meme: qualquer frase do seriado é reconhecida imediatamente por boa parte do público.

O uso sistemático como meme se intensifica a partir de **2005**, com fóruns e comunidades de humor, e explode com as redes sociais e as figurinhas de aplicativo depois de **2015**.`,
    history: `- **1971** — início da produção do seriado no México.
- **Anos 1980** — estreia e consolidação no Brasil via SBT, com reprises contínuas.
- **2005 a 2010** — comunidades de humor online começam a catalogar falas e cenas como piadas padronizadas.
- **2015 em diante** — as "figurinhas de Chaves" se tornam vocabulário padrão em grupos de mensagens brasileiros.
- **2020** — a morte de Roberto Gómez Bolaños, em 2014, e a saída do seriado de algumas plataformas reacendem discussões sobre preservação e direitos.

O meme é atípico por não ter uma imagem ou cena única: é um **acervo** de falas reaproveitáveis, o que o aproxima mais de um vocabulário do que de um formato.`,
    usage_notes: `Padrões recorrentes:

- **"Põe o dedo aqui":** usado para encerrar brincadeiras e provocar reação.
- **"Foi sem querer querendo":** desculpa irônica para um erro evidente.
- **"Quem cala consente":** resposta rápida em discussões.
- **Cenas de espanto:** usadas como reação a notícias absurdas.

Como o seriado tem uma base de falas muito grande, o meme se adapta a praticamente qualquer situação cotidiana, sobretudo no ambiente de trabalho e em grupos de família.`,
    characteristics: `- **Origem:** produto de televisão com décadas de reprises.
- **Repertório:** muitas falas, muitas cenas, personagens distintos.
- **Formato dominante:** figurinha e imagem com legenda.
- **Base:** familiaridade intergeracional no Brasil.`,
    variations: `- **Figurinhas de figurinha:** imagens recortadas com legendas curtas.
- **Chaves adulto:** piadas que recontextualizam as falas em situações de trabalho.
- **Crossovers:** cenas combinadas com outros memes brasileiros.
- **Áudios:** trechos de falas usados como áudio em vídeo curto.`,
    trivia: `- As reprises constantes são apontadas como o principal motivo da força do seriado como meme no Brasil.
- O volume de variações é tão alto que existem páginas dedicadas exclusivamente a catalogar falas como piada pronta.
- Por ser conteúdo licenciado, boa parte do uso comercial das cenas depende de autorização dos detentores dos direitos.`,
    sources: `- Ficha de produção do seriado El Chavo del Ocho.
- Histórico de exibição no Brasil por emissoras abertas.
- Arquivos de comunidades brasileiras de humor a partir de 2005.`,
    verified: true,
    author: "rafacavalcante",
    heat: 81,
  },
  {
    slug: "cat-jam",
    name: "Gato Dançando (CatJAM)",
    category: "animais",
    tags: ["gato", "tiktok", "danca", "musica", "twitch"],
    approx_year: 2020,
    approx_period: "2020 em diante",
    country: "Estados Unidos",
    region: "Origem em vídeo curto; adoção global",
    short_description:
      "Gato Dançando, conhecido como CatJAM, é a animação em 3D de um gato que balança a cabeça no ritmo de uma música, usada como reação em transmissões ao vivo e vídeos curtos.",
    origin: `A animação foi publicada em **2020** em plataformas de vídeo curto e rapidamente adaptada para o formato de "green screen": o gato sobre um fundo verde, para ser colocado atrás de qualquer pessoa dançando.

O nome CatJAM vem da extensão de transmissões ao vivo que permite exibir animações disparadas por eventos de chat, prática popular na **Twitch**. Nesse contexto, o gato aparece sempre que alguém digita o comando correspondente.

O meme se espalhou sobretudo no **TikTok**, onde a animação passou a ser usada como moldura para vídeos de dança.`,
    history: `- **2020** — a animação circula em vídeo curto e ganha versão com fundo verde.
- **2021** — a extensão de chat para transmissões populares incorpora o gato como reação automática.
- **2022 em diante** — consolidação como reação padrão em transmissões, vídeos de música e comunidades de jogos.

O meme é um exemplo de formato que nasceu da interface das plataformas: o gatilho de chat e a animação de tela foram desenhados para conviver.`,
    usage_notes: `Usos principais:

- **Reação em transmissão:** disparado por comando de chat quando algo bom acontece.
- **Moldura de dança:** aplicado atrás de vídeos de música e coreografia.
- **Marcação de ritmo:** usado para destacar um trecho específico de áudio.

Funciona porque é curto, silencioso e sincronizável com qualquer música, o que permite reuso infinito sem perda de sentido.`,
    characteristics: `- **Formato:** animação em loop, baixa complexidade visual.
- **Fundo verde:** versão predominante é pronta para recorte.
- **Sincronia:** movimento de cabeça fácil de alinhar ao ritmo.
- **Duração:** poucos segundos.`,
    variations: `- **CatJAM com áudio:** aplicado a músicas específicas.
- **Gatos alternativos:** outros animais no mesmo movimento.
- **Versões em 8 bits:** recriações com estética de videogame antigo.
- **Overlays personalizados:** gato adaptado com cores e acessórios de diferentes comunidades.`,
    trivia: `- O meme popularizou o nome "Vibing Cat" para a mesma animação.
- A versão com fundo verde é um dos overlays mais usados em ferramentas de transmissão.
- Por ser uma animação simples, o formato atravessou plataformas sem precisar de adaptação.`,
    sources: `- Registros de circulação em plataformas de vídeo curto a partir de 2020.
- Documentação pública de extensões de chat para transmissões ao vivo.
- Arquivos de comunidades de transmissão que adotaram o overlay.`,
    author: "clarice",
    heat: 39,
  },
  {
    slug: "troll-face",
    name: "Troll Face",
    category: "memes-de-2000",
    tags: ["troll", "classico", "orkut", "internet-antiga", "raiva"],
    approx_year: 2008,
    approx_period: "2008 a 2013, com uso nostálgico desde então",
    country: "Estados Unidos",
    region: "Origem em fórum; forte adoção no Brasil",
    short_description:
      "Troll Face é o rosto desenhado de um garoto rindo de forma provocativa, símbolo da era das pegadinhas de fórum e da chamada 'trollagem' na internet dos anos 2000.",
    origin: `O desenho foi publicado pelo usuário **Carlos Ramirez**, sob o apelido "Whynne", em um concurso de arte no fórum **Something Awful** por volta de **2008**.

O rosto foi criado como uma piada sobre o comportamento de usuários que provocavam os outros em fóruns, prática que na época ficou conhecida como "trolling". O desenho se espalhou primeiro entre comunidades de fóruns e rapidamente migrou para outras plataformas.

No **Brasil**, o Troll Face se popularizou junto com o Orkut e com os primeiros sites de humor, entre 2009 e 2012, tornando-se o símbolo visual mais reconhecível da internet brasileira daquele período.`,
    history: `- **2008** — o desenho é publicado em fórum e adotado como símbolo de provocação.
- **2009 e 2010** — circulação massiva em fóruns e comunidades do Orkut no Brasil.
- **2011 a 2013** — consolidação em quadrinhos de "rage comics", que usavam o rosto como painel final.
- **2014 em diante** — uso nostálgico, como referência à internet dos anos 2000.
- **2020** — reaparece em memes que comparam a internet atual com a das décadas anteriores.

É provavelmente o ícone mais associado à ideia de "internet antiga" na memória coletiva brasileira.`,
    usage_notes: `O meme funciona como painel final de uma piada: alguém descreve uma provocação e o rosto aparece como assinatura de quem a cometeu.

- **Em rage comics:** usado como último quadro, indicando que a história terminou em trollagem.
- **Como selo:** aplicado sobre imagens para marcar ironia.
- **Como nostalgia:** usado em publicações sobre a internet da época do Orkut.

O uso atual é quase sempre afetivo ou irônico, poucas vezes como provocação real.`,
    characteristics: `- **Traço:** rabisco simples, com sorriso exagerado e olhos desviados.
- **Formato:** imagem recortável, aplicável sobre qualquer fundo.
- **Origem comunitária:** desenhado por usuário de fórum, sem vínculo com empresa.
- **Associação:** rage comics e "trollagem".`,
    variations: `- **Troll Face vetorizado:** versões de alta resolução, usadas em camisetas.
- **Troll Face 3D:** recriações tridimensionais.
- **Troll Waffle:** variação com waffle na mão, comum em comunidades de jogos.
- **Troll Face com legendas:** "problema?" e versões em português.`,
    trivia: `- O desenho foi criado para um concurso de arte em fórum, sem intenção de virar logo de uma era da internet.
- Em 2010, a empresa que administrava os direitos autorais das músicas usadas em um vídeo viral tentou registrar o personagem, gerando polêmica.
- No Brasil, o rosto aparece em listas de nostalgia ao lado do Orkut e do MSN Messenger.`,
    sources: `- Registros públicos do fórum Something Awful sobre a criação do desenho, em 2008.
- Cobertura de veículos de tecnologia sobre a disputa de marca registrada em 2010.
- Arquivos de comunidades brasileiras de humor entre 2009 e 2012.`,
    verified: true,
    author: "tiagomendonca",
    heat: 66,
  },
];

const DEMO_USERS: { username: string; display: string; email: string; role: string; bio: string }[] = [
  { username: "clarice", display: "Clarice Ferraz", email: "clarice@exemplo.com", role: "moderator", bio: "Moderadora há três anos. Cuido da fila de revisão e escrevo sobre memes de novela." },
  { username: "tiagomendonca", display: "Tiago Mendonça", email: "tiago@exemplo.com", role: "contributor", bio: "Documento memes da década de 2010. Trabalho com arquivo e pesquisa de imagem." },
  { username: "brunaokada", display: "Bruna Okada", email: "bruna@exemplo.com", role: "contributor", bio: "Gosto de memes de humor absurdo e de rastrear a origem de imagens de banco." },
  { username: "rafacavalcante", display: "Rafael Cavalcante", email: "rafael@exemplo.com", role: "user", bio: "Contribuo com memes brasileiros antigos. Aprendi tudo aqui." },
  { username: "julianaprado", display: "Juliana Prado", email: "juliana@exemplo.com", role: "user", bio: "Escrevo sobre linguagem da internet. Entrei para ajudar a datar bordões." },
];

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function seedDatabase() {
  tx(() => {
    const insertedUsers: Record<string, number> = {};

    const insertUser = (
      username: string,
      display: string,
      email: string,
      role: string,
      password: string,
      bio: string,
      extra: { isOwner?: boolean; mustChange?: boolean; joinedDaysAgo?: number; verified?: boolean } = {},
    ) => {
      const res = run(
        `INSERT INTO users (username, email, password_hash, display_name, role, is_owner, must_change_password, email_verified, created_at, last_seen_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?), datetime('now', ?))`,
        username,
        email,
        hashPassword(password),
        display,
        role,
        extra.isOwner ? 1 : 0,
        extra.mustChange ? 1 : 0,
        extra.verified === false ? 0 : 1,
        `-${extra.joinedDaysAgo ?? 30} days`,
        `-${Math.floor((extra.joinedDaysAgo ?? 30) / 4)} days`,
        `-${Math.floor((extra.joinedDaysAgo ?? 30) / 3)} days`,
      );
      const id = Number(res.lastInsertRowid);
      run("INSERT INTO profiles (user_id, bio) VALUES (?, ?)", id, bio);
      insertedUsers[username] = id;
      reindexUser(id);
      return id;
    };

    const ownerId = insertUser(
      "memepedia",
      "Owner da Memepedia",
      "owner@memepedia.app",
      "owner",
      OWNER_PASSWORD,
      "Proprietário e administrador principal da Memepedia. Reviso a fila de contribuições e mantenho o padrão editorial da enciclopédia.",
      { isOwner: true, mustChange: true, joinedDaysAgo: 420 },
    );
    for (const u of DEMO_USERS) {
      insertUser(u.username, u.display, u.email, u.role, DEMO_PASSWORD, u.bio, {
        joinedDaysAgo: 60 + Math.floor(Math.random() * 300),
      });
    }

    const catIds: Record<string, number> = {};
    for (const c of CATEGORIES) {
      const res = run(
        "INSERT INTO categories (slug, name, description, group_name, sort_order) VALUES (?, ?, ?, ?, ?)",
        c.slug,
        c.name,
        c.description,
        c.group,
        c.order,
      );
      catIds[c.slug] = Number(res.lastInsertRowid);
    }

    const tagIds: Record<string, number> = {};
    const tagId = (name: string) => {
      const slug = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      if (tagIds[slug]) return tagIds[slug];
      const res = run("INSERT INTO tags (slug, name) VALUES (?, ?)", slug, name);
      tagIds[slug] = Number(res.lastInsertRowid);
      return tagIds[slug];
    };

    const memeIds: Record<string, number> = {};
    for (const m of MEMES) {
      const authorId = insertedUsers[m.author] ?? ownerId;
      const res = run(
        `INSERT INTO memes (slug, name, short_description, origin, history, usage_notes,
            characteristics, variations, trivia, sources, approx_year, approx_period,
            country, region, category_id, status, verified, featured, is_demo,
            comments_enabled, created_by, created_at, updated_at, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, 1, 1, ?,
                 datetime('now', ?), datetime('now', ?), datetime('now', ?))`,
        m.slug,
        m.name,
        m.short_description,
        m.origin,
        m.history,
        m.usage_notes,
        m.characteristics,
        m.variations,
        m.trivia,
        m.sources,
        m.approx_year,
        m.approx_period,
        m.country,
        m.region,
        catIds[m.category] ?? null,
        m.verified ? 1 : 0,
        m.featured ? 1 : 0,
        authorId,
        `-${200 + m.heat} days`,
        `-${Math.max(1, Math.floor(m.heat / 9))} days`,
        `-${200 + m.heat} days`,
      );
      const id = Number(res.lastInsertRowid);
      memeIds[m.slug] = id;

      for (const t of m.tags) {
        const tid = tagId(t);
        run("INSERT OR IGNORE INTO meme_tags (meme_id, tag_id) VALUES (?, ?)", id, tid);
        run("UPDATE tags SET use_count = use_count + 1 WHERE id = ?", tid);
      }

      const width = 1200;
      const height = m.slug === "distracted-boyfriend" || m.slug === "this-is-fine" ? 800 : 900;
      run(
        `INSERT INTO meme_media (meme_id, kind, url, thumb_url, alt, caption, width, height, mime,
            is_primary, position, source_url, author, license, rights_notes, is_placeholder, created_by)
         VALUES (?, 'image', ?, ?, ?, '', ?, ?, 'image/jpeg', 1, 0, '', '', '',
                 'Mídia de demonstração: substitua pela imagem original ou por uma versão com licença verificada.', 1, ?)`,
        id,
        `https://picsum.photos/seed/${m.slug}-memepedia/${width}/${height}`,
        `https://picsum.photos/seed/${m.slug}-memepedia/480/360`,
        `Imagem de demonstração para o meme ${m.name}`,
        width,
        height,
        authorId,
      );

      // Version 1: the creation snapshot.
      const snapshot = {
        name: m.name,
        short_description: m.short_description,
        origin: m.origin,
        history: m.history,
        usage_notes: m.usage_notes,
        characteristics: m.characteristics,
        variations: m.variations,
        trivia: m.trivia,
        sources: m.sources,
        approx_year: m.approx_year,
        approx_period: m.approx_period,
        country: m.country,
        region: m.region,
        category_id: catIds[m.category],
        tags: m.tags,
      };
      run(
        `INSERT INTO meme_versions (meme_id, version_no, snapshot, created_by, created_at, reason, source)
         VALUES (?, 1, ?, ?, datetime('now', ?), 'Criação da página', 'seed')`,
        id,
        JSON.stringify(snapshot),
        authorId,
        `-${200 + m.heat} days`,
      );
      run("UPDATE memes SET versions_count = 1 WHERE id = ?", id);
      reindexMeme(id);
    }

    /* ---- Second versions: real edits with a diffable reason ---- */
    const edits: { slug: string; author: string; reason: string; daysAgo: number }[] = [
      {
        slug: "doge",
        author: "clarice",
        reason: "Acrescentei o trecho sobre a morte de Kabosu em 2024 e ajustei a datação do formato de legenda.",
        daysAgo: 12,
      },
      {
        slug: "nazare-confusa",
        author: "tiagomendonca",
        reason: "Corrigi o ano de exibição da novela e complementei o uso corporativo do GIF.",
        daysAgo: 5,
      },
    ];
    for (const e of edits) {
      const id = memeIds[e.slug];
      const base = MEMES.find((m) => m.slug === e.slug)!;
      const authorId = insertedUsers[e.author] ?? ownerId;
      const current = get<{ versions_count: number }>("SELECT versions_count FROM memes WHERE id = ?", id);
      const nextVersion = (current?.versions_count ?? 1) + 1;
      const nextTrivia =
        e.slug === "doge"
          ? `${base.trivia}\n- A morte de Kabosu, em maio de 2024, gerou uma onda de homenagens e reacendeu a circulação do meme.`
          : base.trivia;
      const nextUsage =
        e.slug === "nazare-confusa"
          ? `${base.usage_notes}\n\nEm ambientes corporativos brasileiros, o GIF aparece com frequência em apresentações internas para sinalizar processos confusos, o que ampliou o alcance do meme para além do público de redes sociais.`
          : base.usage_notes;
      const snapshot = {
        name: base.name,
        short_description: base.short_description,
        origin: base.origin,
        history: base.history,
        usage_notes: nextUsage,
        characteristics: base.characteristics,
        variations: base.variations,
        trivia: nextTrivia,
        sources: base.sources,
        approx_year: base.approx_year,
        approx_period: base.approx_period,
        country: base.country,
        region: base.region,
        category_id: catIds[base.category],
        tags: base.tags,
      };
      run(
        `INSERT INTO meme_versions (meme_id, version_no, snapshot, created_by, created_at, reason, source)
         VALUES (?, ?, ?, ?, datetime('now', ?), ?, 'direct')`,
        id,
        nextVersion,
        JSON.stringify(snapshot),
        authorId,
        `-${e.daysAgo} days`,
        e.reason,
      );
      run(
        `UPDATE memes SET versions_count = ?, updated_at = datetime('now', ?), updated_by = ?,
           trivia = ?, usage_notes = ? WHERE id = ?`,
        nextVersion,
        `-${e.daysAgo} days`,
        authorId,
        nextTrivia,
        nextUsage,
        id,
      );
      reindexMeme(id);
    }

    /* ---- View history: 45 days of traffic so every popularity filter has data ---- */
    for (const m of MEMES) {
      const id = memeIds[m.slug];
      const rand = prng(m.heat * 7919 + m.slug.length);
      let total = 0;
      for (let d = 44; d >= 0; d--) {
        const base = Math.round((m.heat / 100) * 46 + 6);
        const recency = 1 + (44 - d) * 0.012;
        const day = Math.round(base * recency * (0.55 + rand() * 0.95));
        const date = new Date();
        date.setDate(date.getDate() - d);
        run("INSERT INTO views (meme_id, day, count) VALUES (?, ?, ?)", id, dayKey(date), day);
        total += day;
      }
      const recent = all<{ c: number }>(
        "SELECT COALESCE(SUM(count), 0) AS c FROM views WHERE meme_id = ? AND day >= date('now', '-30 days')",
        id,
      )[0].c;
      run("UPDATE memes SET views_count = ?, popularity = ? WHERE id = ?", total, recent, id);
    }

    /* ---- Follows + favorites so the personal pages are populated ---- */
    const followingUser = insertedUsers["rafacavalcante"];
    for (const slug of ["doge", "nazare-confusa", "chaves"]) {
      run("INSERT OR IGNORE INTO follows (user_id, meme_id) VALUES (?, ?)", followingUser, memeIds[slug]);
      run("INSERT OR IGNORE INTO favorites (user_id, meme_id) VALUES (?, ?)", insertedUsers["julianaprado"], memeIds[slug]);
    }
    for (const slug of ["doge", "stonks", "troll-face", "cat-jam"]) {
      run("INSERT OR IGNORE INTO favorites (user_id, meme_id) VALUES (?, ?)", ownerId, memeIds[slug]);
    }
    run("UPDATE memes SET followers_count = 1 WHERE id IN (?, ?, ?)", memeIds["doge"], memeIds["nazare-confusa"], memeIds["chaves"]);

    /* ---- Comments ---- */
    const comment = (slug: string, userId: number, body: string, daysAgo: number, reports = 0) =>
      run(
        `INSERT INTO comments (meme_id, user_id, body, created_at, updated_at, reports_count)
         VALUES (?, ?, ?, datetime('now', ?), datetime('now', ?), ?)`,
        memeIds[slug],
        userId,
        body,
        `-${daysAgo} days`,
        `-${daysAgo} days`,
        reports,
      );
    comment("doge", insertedUsers["rafacavalcante"], "A parte da Comic Sans explicada assim faz muito sentido. Sempre achei que fosse só estética.", 9);
    comment("doge", insertedUsers["brunaokada"], "Vale acrescentar que a Kabosu foi adotada depois de ser resgatada de um abrigo. Isso costuma aparecer nas reportagens.", 7);
    comment("nazare-confusa", insertedUsers["julianaprado"], "A novela passou tanto tempo em reprise que hoje tem gente usando o GIF sem saber de onde vem.", 4);
    comment("stonks", insertedUsers["tiagomendonca"], "O melhor desse meme é que ele virou material de aula de educação financeira.", 3);
    comment("chaves", insertedUsers["rafacavalcante"], "Faltou a fala do seu Madruga sobre pagar o aluguel, que é meme diário em grupo de trabalho.", 2);
    comment("this-is-fine", insertedUsers["clarice"], "Sugiro adicionar o título original da tira na seção de curiosidades. Já está lá, ótimo.", 1);

    /* ---- Pending contributions awaiting review ---- */
    const pendingNew: { title: string; kind: string; author: string; payload: Record<string, unknown>; name: string; note: string; risk: number; flags: string[]; hoursAgo: number }[] = [
      {
        title: "Novo meme: Cafezinho antes da reunião",
        kind: "new_meme",
        author: "rafacavalcante",
        name: "Cafezinho antes da reunião",
        note: "Vi circulando em grupos de trabalho neste ano. Ainda não tenho muita fonte, mas o formato está claro.",
        risk: 35,
        flags: ["poucas fontes", "possível duplicata: meme de reunião"],
        hoursAgo: 19,
        payload: {
          name: "Cafezinho antes da reunião",
          short_description:
            "Formato de meme em que uma xícara de café é apresentada como o único elemento capaz de preparar alguém para uma reunião de trabalho.",
          origin:
            "Ainda não há origem confirmada. O formato apareceu em publicações de grupos profissionais, com a imagem de uma xícara de café seguida de uma legenda sobre reuniões.\n\nNão foram localizadas fontes que identifiquem um post original, por isso a datação é aproximada.",
          history: "Sem histórico documentado até o momento.",
          usage_notes: "Usado antes ou logo depois de reuniões longas, principalmente para marcar humor de cansaço no ambiente corporativo.",
          characteristics: "- Imagem simples, geralmente uma xícara de café.\n- Legenda curta, em tom de desabafo.",
          variations: "Variações com chimarrão, tereré e energéticos foram observadas em grupos regionais.",
          trivia: "",
          sources: "",
          approx_year: 2026,
          approx_period: "2026",
          country: "Brasil",
          region: "Nacional",
          category_slug: "humor",
          tags: "cafe, trabalho, brasil",
        },
      },
      {
        title: "Novo meme: Planilha que ninguém abre",
        kind: "new_meme",
        author: "julianaprado",
        name: "Planilha que ninguém abre",
        note: "",
        risk: 58,
        flags: ["descrição genérica", "link suspeito detectado"],
        hoursAgo: 6,
        payload: {
          name: "Planilha que ninguém abre",
          short_description: "Esse é um meme muito engraçado sobre planilhas.",
          origin: "Surgiu no trabalho, todo mundo ri.",
          history: "",
          usage_notes: "",
          characteristics: "",
          variations: "",
          trivia: "",
          sources: "http://bit.ly/planilha-meme-origem",
          approx_year: 2025,
          approx_period: "",
          country: "Brasil",
          region: "",
          category_slug: "humor",
          tags: "trabalho, planilha",
        },
      },
    ];
    for (const p of pendingNew) {
      const res = run(
        `INSERT INTO contributions (kind, meme_id, target_name, title, note, payload, status, submitted_by,
            created_at, ai_flags, risk_score, ip_hash)
         VALUES (?, NULL, ?, ?, ?, ?, 'pending', ?, datetime('now', ?), ?, ?, ?)`,
        p.kind,
        p.name,
        p.title,
        p.note,
        JSON.stringify(p.payload),
        insertedUsers[p.author],
        `-${p.hoursAgo} hours`,
        JSON.stringify(p.flags),
        p.risk,
        "demo0hash",
      );
      const cid = Number(res.lastInsertRowid);
      for (const f of MEME_FIELDS) {
        const value = (p.payload as Record<string, unknown>)[f.key];
        if (value === undefined || value === null || value === "") continue;
        run(
          "INSERT INTO contribution_changes (contribution_id, field, old_value, new_value) VALUES (?, ?, '', ?)",
          cid,
          f.key,
          Array.isArray(value) ? value.join(", ") : String(value),
        );
      }
    }

    /* ---- Pending corrections on existing pages ---- */
    const corrections: { slug: string; author: string; fields: Record<string, string>; note: string; hoursAgo: number; risk: number; flags: string[] }[] = [
      {
        slug: "nazare-confusa",
        author: "rafacavalcante",
        fields: {
          approx_year: "2004",
          approx_period: "2004, com circulação como meme a partir de 2016",
        },
        note: "A data que está na página (2016) é de quando o GIF virou meme, mas a novela é de 2004. Sugiro separar as duas coisas no campo de período.",
        hoursAgo: 30,
        risk: 8,
        flags: [],
      },
      {
        slug: "stonks",
        author: "julianaprado",
        fields: {
          short_description:
            "Stonks é uma variação ortográfica proposital de 'stocks' usada sobre a imagem do Meme Man para zombar de decisões financeiras ruins que são apresentadas como geniais. O formato se popularizou entre 2018 e 2020 e a palavra sobreviveu ao personagem.",
        },
        note: "A descrição curta podia situar melhor o período de popularização, já que os cards usam esse texto.",
        hoursAgo: 11,
        risk: 5,
        flags: [],
      },
      {
        slug: "chaves",
        author: "brunaokada",
        fields: {
          variations:
            "As reprises constantes do seriado no Brasil ampliaram muito o repertório de cenas reaproveitáveis. Entre as famílias mais usadas estão as figurinhas recortadas, os áudios de falas curtas e as edições que colocam personagens em situações de trabalho contemporâneo.",
        },
        note: "Complementei as variações com a família de áudios que circula em vídeo curto.",
        hoursAgo: 3,
        risk: 12,
        flags: [],
      },
    ];
    for (const c of corrections) {
      const memeId = memeIds[c.slug];
      const res = run(
        `INSERT INTO contributions (kind, meme_id, target_name, title, note, payload, status, submitted_by,
            created_at, ai_flags, risk_score, ip_hash)
         VALUES ('correction', ?, ?, ?, ?, ?, 'pending', ?, datetime('now', ?), ?, ?, 'demo0hash')`,
        memeId,
        MEMES.find((m) => m.slug === c.slug)!.name,
        `Correção em ${MEMES.find((m) => m.slug === c.slug)!.name}`,
        c.note,
        JSON.stringify(c.fields),
        insertedUsers[c.author],
        `-${c.hoursAgo} hours`,
        JSON.stringify(c.flags),
        c.risk,
      );
      const cid = Number(res.lastInsertRowid);
      for (const [field, value] of Object.entries(c.fields)) {
        // Only whitelisted content columns are interpolated into SQL.
        if (!MEME_FIELDS.some((f) => f.key === field)) continue;
        const row = get<Record<string, unknown>>(`SELECT ${field} AS v FROM memes WHERE id = ?`, memeId);
        run(
          "INSERT INTO contribution_changes (contribution_id, field, old_value, new_value) VALUES (?, ?, ?, ?)",
          cid,
          field,
          String(row?.v ?? ""),
          value,
        );
      }
    }

    /* ---- A previously reviewed contribution, so statuses are all represented ---- */
    const approved = run(
      `INSERT INTO contributions (kind, meme_id, target_name, title, note, payload, status, submitted_by,
          created_at, reviewed_by, reviewed_at, review_note, ai_flags, risk_score, ip_hash)
       VALUES ('correction', ?, 'Doge', 'Correção em Doge', 'Separei a data da foto da data de popularização do formato.',
               '{}', 'approved', ?, datetime('now', '-40 days'), ?, datetime('now', '-39 days'),
               'Aprovada com ajuste de redação.', '[]', 6, 'demo0hash')`,
      memeIds["doge"],
      insertedUsers["julianaprado"],
      ownerId,
    );
    run(
      "INSERT INTO contribution_changes (contribution_id, field, old_value, new_value) VALUES (?, 'approx_period', '2010', '2010, com pico entre 2013 e 2014')",
      Number(approved.lastInsertRowid),
    );

    const rejected = run(
      `INSERT INTO contributions (kind, meme_id, target_name, title, note, payload, status, submitted_by,
          created_at, reviewed_by, reviewed_at, review_note, ai_flags, risk_score, ip_hash)
       VALUES ('correction', ?, 'Stonks', 'Correção em Stonks', '', '{}', 'rejected', ?, datetime('now', '-8 days'),
               ?, datetime('now', '-7 days'),
               'Sem fonte que sustente a data informada. Reabra a sugestão com uma referência e a gente aprova.',
               '["sem fonte"]', 40, 'demo0hash')`,
      memeIds["stonks"],
      insertedUsers["rafacavalcante"],
      insertedUsers["clarice"],
    );
    run(
      "INSERT INTO contribution_changes (contribution_id, field, old_value, new_value) VALUES (?, 'approx_year', '2017', '2016')",
      Number(rejected.lastInsertRowid),
    );

    /* ---- Reports ---- */
    run(
      `INSERT INTO reports (target_type, target_id, reporter_id, reason, details, status, created_at, ip_hash)
       VALUES ('meme', ?, ?, 'falso', 'A seção de origem não cita nenhuma fonte. Pode ser invenção.', 'open', datetime('now', '-2 days'), 'demo0hash')`,
      memeIds["e-sobre-isso"],
      insertedUsers["brunaokada"],
    );
    run(
      `INSERT INTO reports (target_type, target_id, reporter_id, reason, details, status, created_at, ip_hash)
       VALUES ('comment', ?, ?, 'spam', 'Comentário repetindo link de um site de apostas.', 'open', datetime('now', '-6 hours'), 'demo0hash')`,
      1,
      insertedUsers["tiagomendonca"],
    );
    run(
      `INSERT INTO reports (target_type, target_id, reporter_id, reason, details, status, created_at, resolved_by, resolved_at, resolution_note, ip_hash)
       VALUES ('meme', ?, ?, 'copyright', 'A imagem usada é de banco de imagens e está sem atribuição.', 'resolved', datetime('now', '-20 days'), ?, datetime('now', '-19 days'), 'Adicionamos os campos de fonte e licença na galeria.', 'demo0hash')`,
      memeIds["distracted-boyfriend"],
      insertedUsers["julianaprado"],
      ownerId,
    );

    /* ---- Notifications for the owner ---- */
    notifyOwner(ownerId, "Nova contribuição aguardando revisão", "Cafezinho antes da reunião foi enviado por Rafael Cavalcante.", "/admin/revisao", 19);
    notifyOwner(ownerId, "Nova correção sugerida", "Nazaré Confusa recebeu uma sugestão de correção de data.", "/admin/revisao", 30);
    notifyOwner(ownerId, "Denúncia aberta", "Conteúdo possivelmente sem fonte em É sobre isso.", "/admin/denuncias", 48);

    /* ---- Audit log ---- */
    logAudit({ actorId: ownerId, actorName: "Owner da Memepedia", action: "plataforma.instalada", resourceType: "sistema", resourceId: "seed", meta: { memes: MEMES.length, categorias: CATEGORIES.length } });
    logAudit({ actorId: insertedUsers["clarice"], actorName: "Clarice Ferraz", action: "contribuicao.avaliada", resourceType: "contribution", resourceId: String(rejected.lastInsertRowid), result: "ok", meta: { decisao: "rejeitada" } });
  });
}

function notifyOwner(userId: number, title: string, body: string, url: string, hoursAgo: number) {
  run(
    `INSERT INTO notifications (user_id, kind, title, body, url, created_at)
     VALUES (?, 'admin', ?, ?, ?, datetime('now', ?))`,
    userId,
    title,
    body,
    url,
    `-${hoursAgo} hours`,
  );
}

export function isSeeded(): boolean {
  return (pluck<number>("SELECT COUNT(*) FROM users") ?? 0) > 0;
}
