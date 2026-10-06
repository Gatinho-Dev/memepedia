export type Role = "user" | "contributor" | "moderator" | "admin" | "owner";
export type UserStatus = "active" | "suspended" | "banned";
export type MemeStatus = "published" | "hidden" | "deleted";
export type ProtectionLevel = "free" | "moderated" | "protected" | "admin";
export type ContributionKind = "new_meme" | "correction" | "media" | "delete_request";
export type ContributionStatus = "pending" | "approved" | "rejected" | "changed" | "cancelled";
export type ReportStatus = "open" | "resolved" | "dismissed";

export const ROLES: { key: Role; label: string; rank: number; description: string }[] = [
  { key: "user", label: "Usuário", rank: 10, description: "Contribui sugerindo memes e correções que passam por revisão." },
  { key: "contributor", label: "Colaborador", rank: 20, description: "Contribuidor de confiança: publica direto em páginas livres e organiza categorias e tags." },
  { key: "moderator", label: "Moderador", rank: 40, description: "Revisa contribuições, modera denúncias, bloqueia conteúdo e reverte edições." },
  { key: "admin", label: "Administrador", rank: 70, description: "Acesso administrativo amplo sobre conteúdo, usuários e configurações." },
  { key: "owner", label: "Owner", rank: 100, description: "Proprietário da Memepedia. Controle total e irreversível sobre a plataforma." },
];

export const ROLE_LABEL: Record<Role, string> = {
  user: "Usuário",
  contributor: "Colaborador",
  moderator: "Moderador",
  admin: "Administrador",
  owner: "Owner",
};

export const ROLE_RANK: Record<Role, number> = {
  user: 10,
  contributor: 20,
  moderator: 40,
  admin: 70,
  owner: 100,
};

export const STATUS_LABEL: Record<ContributionStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
  changed: "Alterada",
  cancelled: "Cancelada",
};

export const PROTECTION_LABEL: Record<ProtectionLevel, string> = {
  free: "Livre",
  moderated: "Moderada",
  protected: "Protegida",
  admin: "Protegida pelo administrador",
};

export const PROTECTION_HINT: Record<ProtectionLevel, string> = {
  free: "Qualquer usuário autenticado pode sugerir alterações. Colaboradores publicam direto.",
  moderated: "Toda alteração passa por revisão antes de ser publicada.",
  protected: "Somente colaboradores autorizados podem sugerir alterações.",
  admin: "Somente administradores podem editar esta página.",
};

export const REPORT_REASONS = [
  { key: "spam", label: "Spam" },
  { key: "ofensivo", label: "Conteúdo ofensivo" },
  { key: "falso", label: "Informação falsa" },
  { key: "ilegal", label: "Conteúdo ilegal" },
  { key: "copyright", label: "Direitos autorais" },
  { key: "assedio", label: "Assédio" },
  { key: "inadequado", label: "Conteúdo inadequado" },
  { key: "outro", label: "Outro" },
] as const;

export const LIVE_ARTICLE_SECTIONS = [
  { key: "history", label: "História" },
  { key: "usage_notes", label: "Como é usado" },
  { key: "characteristics", label: "Características" },
  { key: "variations", label: "Variações" },
  { key: "trivia", label: "Curiosidades" },
] as const;

export type MemeFieldKey =
  | "name"
  | "short_description"
  | "origin"
  | "approx_year"
  | "approx_period"
  | "country"
  | "region"
  | "category_id"
  | "tags"
  | "history"
  | "usage_notes"
  | "characteristics"
  | "variations"
  | "trivia"
  | "sources";

export interface MemeField {
  key: MemeFieldKey;
  label: string;
  hint: string;
  /** "text" | "textarea" | "number" | "select" | "tags" | "richtext" */
  type: "text" | "textarea" | "number" | "select" | "tags" | "richtext";
  group: "essencial" | "contexto" | "artigo" | "referencias";
  rows?: number;
  placeholder?: string;
}

/**
 * Single source of truth for editable meme content. Drives the editor form,
 * the version diff, contribution payload validation and the seed data, so a
 * new field shows up everywhere at once.
 */
export const MEME_FIELDS: MemeField[] = [
  { key: "name", label: "Nome do meme", hint: "Como o meme é conhecido no Brasil e no exterior.", type: "text", group: "essencial", placeholder: "Doge" },
  { key: "short_description", label: "Descrição curta", hint: "Uma ou duas frases. Aparece nos cards e nos resultados de busca.", type: "textarea", group: "essencial", rows: 2, placeholder: "Meme baseado na foto de um cachorro da raça Shiba Inu..." },
  { key: "origin", label: "Origem", hint: "Onde e como o meme surgiu. Use 'origem não confirmada' quando não houver fonte.", type: "richtext", group: "contexto", rows: 5 },
  { key: "approx_year", label: "Ano aproximado", hint: "Deixe vazio quando a data não for confiável.", type: "number", group: "contexto" },
  { key: "approx_period", label: "Período aproximado", hint: "Ex.: início dos anos 2010, meados de 2017.", type: "text", group: "contexto" },
  { key: "country", label: "País", hint: "País de origem predominante.", type: "text", group: "contexto" },
  { key: "region", label: "Região", hint: "Estado, cidade ou comunidade onde circulou primeiro.", type: "text", group: "contexto" },
  { key: "category_id", label: "Categoria principal", hint: "A categoria define onde o meme aparece no catálogo.", type: "select", group: "essencial" },
  { key: "tags", label: "Tags", hint: "Separe por vírgula. Tags ligam memes entre si.", type: "tags", group: "essencial" },
  { key: "history", label: "História", hint: "Como o meme evoluiu ao longo do tempo.", type: "richtext", group: "artigo", rows: 7 },
  { key: "usage_notes", label: "Como é usado", hint: "Em que situações as pessoas usam esse meme.", type: "richtext", group: "artigo", rows: 6 },
  { key: "characteristics", label: "Características", hint: "Formato, estética, elementos visuais recorrentes.", type: "richtext", group: "artigo", rows: 5 },
  { key: "variations", label: "Variações", hint: "Versões conhecidas e adaptações regionais.", type: "richtext", group: "artigo", rows: 5 },
  { key: "trivia", label: "Curiosidades", hint: "Informações adicionais verificáveis.", type: "richtext", group: "artigo", rows: 4 },
  { key: "sources", label: "Fontes e referências", hint: "Links e publicações que sustentam o texto.", type: "richtext", group: "referencias", rows: 4 },
];

export const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  MEME_FIELDS.map((f) => [f.key, f.label]),
);

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  email: string;
  role: Role;
  isOwner: boolean;
  avatarUrl: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  theme: "light" | "dark" | "system";
  createdAt: string;
  lastSeenAt: string | null;
}
