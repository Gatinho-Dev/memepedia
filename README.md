# Memepedia 📖

> **A Wikipédia dos memes** — enciclopédia livre, colaborativa e aberta para documentar a cultura da internet.

A Memepedia funciona como uma enciclopédia comunitária: qualquer pessoa registrada pode **contribuir** com novos memes ou correções, e uma equipe de **moderação** revisa cada versão antes de publicar. Um **console administrativo** completo dá à equipe (do moderador ao dono) controle sobre catálogo, usuários, denúncias, comentários, categorias, tags, permissões, logs e configurações da plataforma.

## Funcionalidades

**Enciclopédia pública**
- Páginas de artigo por meme com histórico de versões e restauração
- Catálogo filtrável, categorias agrupadas, tags, busca com índice FTS5
- Navegação aleatória, páginas de populares e recentes, estatísticas em tempo real
- Interações: favoritos, comentários moderáveis, visualizações e gráficos

**Colaboração**
- Criação de memes e sugestão de correções passando por fila de revisão
- Histórico completo por artigo com diffs de versões
- Notificações de revisão, área de contribuições e favoritos pessoais

**Administração**
- Painel com métricas gerais, fila de revisão e moderação de memes
- Gestão de usuários, papéis e permissões (usuário → contribuidor → moderador → admin → owner)
- Tratamento de denúncias, comentários, logs de auditoria e configurações globais
- Proteção, destaque, ocultação e restauração de artigos

## Stack técnica

| Camada | Tecnologia |
| --- | --- |
| Framework | [Next.js 15](https://nextjs.org) (App Router) + Server Actions |
| Linguagem | TypeScript (modo estrito) |
| Estilo | Tailwind CSS v4 + [@phosphor-icons/react](https://phosphoricons.com) |
| Banco de dados | SQLite via `node:sqlite` (sem dependência externa), com WAL |
| Busca | Índice FTS5 |
| Validação | [zod](https://zod.dev) |

Não há banco externo nem serviços pagos: todos os dados vivem em `data/memepedia.db` e a mídia enviada em `public/uploads/`. Na primeira execução o esquema e um catálogo de demonstração são criados automaticamente.

## Como executar

Requisito: **Node.js 26+** (o `node:sqlite` nativo é usado diretamente).

```bash
npm install
npm run dev        # http://localhost:4310
```

Para produção:

```bash
npm run build
npm run start      # http://localhost:4310
```

### Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento na porta 4310 |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção na porta 4310 |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`) |
| `npm run db:reset` | Apaga o banco local; a seed é recriada no próximo boot |

## Contas de demonstração

A seed cria as contas abaixo para explorar os diferentes papéis:

| Papel | E-mail | Senha |
| --- | --- | --- |
| Owner (dono) | `owner@memepedia.app` | `memepedia-owner-2026` |
| Contribuidor | `clarice@exemplo.com` | `memepedia-demo-2026` |
| Moderador | `tiago@exemplo.com` | `memepedia-demo-2026` |
| Usuário | `rafael@exemplo.com` | `memepedia-demo-2026` |

> As senhas de demonstração são literais no código (`src/lib/seed.ts`) por design — servem apenas para ambientes locais de demonstração e aparecem como dica na tela de login.

## Estrutura do projeto

```
src/
├── app/              # Rotas (App Router): enciclopédia, contribuição, /admin
│   ├── actions/      # Server Actions (auth, meme, admin)
│   ├── admin/        # Console de administração
│   └── ...           # /memes, /meme/[slug], /categorias, /buscar, /entrar, ...
├── components/       # UI compartilhada (cartões, editor, gráficos, header)
└── lib/              # Camada de dados: db.ts (migrações), memes.ts, auth.ts,
                      # seed.ts (catálogo demo), permissions.ts, admin.ts
```

## Diretrizes da comunidade

As políticas que orientam o conteúdo da enciclopédia estão publicadas na própria plataforma: [`/sobre`](http://localhost:4310/sobre), [`/politica-de-conteudo`](http://localhost:4310/politica-de-conteudo) e [`/codigo-de-conduta`](http://localhost:4310/codigo-de-conduta).
