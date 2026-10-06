import type { ProtectionLevel, Role } from "./types";
import { ROLE_RANK } from "./types";

/**
 * Capability matrix.
 *
 * Deliberately code-defined rather than database-editable. A mutable permission
 * table reachable from the admin UI is the classic path to privilege
 * escalation. What the OWNER can change at runtime is *who holds which role*,
 * plus role labels and rank metadata (see /admin/permissoes).
 */
export type Capability =
  | "admin.access"
  | "meme.suggest"
  | "meme.edit_direct"
  | "meme.delete"
  | "meme.restore"
  | "meme.revert"
  | "meme.protect"
  | "meme.verify"
  | "meme.feature"
  | "meme.manage_media"
  | "contribution.review"
  | "comment.create"
  | "comment.moderate"
  | "report.create"
  | "report.moderate"
  | "category.manage"
  | "tag.manage"
  | "user.manage"
  | "user.suspend"
  | "user.ban"
  | "user.assign_role_admin"
  | "user.assign_role_owner"
  | "logs.view"
  | "settings.manage"
  | "content.hard_delete";

const CAPS: Record<Capability, Role> = {
  "admin.access": "moderator",
  "meme.suggest": "user",
  "meme.edit_direct": "contributor",
  "meme.delete": "moderator",
  "meme.restore": "moderator",
  "meme.revert": "moderator",
  "meme.protect": "admin",
  "meme.verify": "moderator",
  "meme.feature": "admin",
  "meme.manage_media": "contributor",
  "contribution.review": "moderator",
  "comment.create": "user",
  "comment.moderate": "moderator",
  "report.create": "user",
  "report.moderate": "moderator",
  "category.manage": "admin",
  "tag.manage": "contributor",
  "user.manage": "admin",
  "user.suspend": "moderator",
  "user.ban": "admin",
  "user.assign_role_admin": "owner",
  "user.assign_role_owner": "owner",
  "logs.view": "admin",
  "settings.manage": "owner",
  "content.hard_delete": "owner",
};

/** Human-readable matrix for the admin UI. */
export const CAPABILITY_CATALOG: { group: string; items: { cap: Capability; label: string; min: Role }[] }[] = [
  {
    group: "Conteúdo",
    items: [
      { cap: "meme.suggest", label: "Sugerir meme ou correção", min: CAPS["meme.suggest"] },
      { cap: "meme.edit_direct", label: "Editar e publicar direto em páginas livres", min: CAPS["meme.edit_direct"] },
      { cap: "meme.manage_media", label: "Gerenciar mídia e galeria", min: CAPS["meme.manage_media"] },
      { cap: "meme.revert", label: "Restaurar versões anteriores", min: CAPS["meme.revert"] },
      { cap: "meme.delete", label: "Ocultar ou excluir memes", min: CAPS["meme.delete"] },
      { cap: "meme.restore", label: "Restaurar memes removidos", min: CAPS["meme.restore"] },
      { cap: "content.hard_delete", label: "Exclusão permanente (irreversível)", min: CAPS["content.hard_delete"] },
    ],
  },
  {
    group: "Curadoria",
    items: [
      { cap: "meme.verify", label: "Marcar meme como verificado", min: CAPS["meme.verify"] },
      { cap: "meme.feature", label: "Destacar meme", min: CAPS["meme.feature"] },
      { cap: "meme.protect", label: "Alterar nível de proteção da página", min: CAPS["meme.protect"] },
      { cap: "category.manage", label: "Administrar categorias", min: CAPS["category.manage"] },
      { cap: "tag.manage", label: "Administrar tags", min: CAPS["tag.manage"] },
    ],
  },
  {
    group: "Moderação",
    items: [
      { cap: "contribution.review", label: "Revisar fila de contribuições", min: CAPS["contribution.review"] },
      { cap: "report.moderate", label: "Resolver denúncias", min: CAPS["report.moderate"] },
      { cap: "comment.moderate", label: "Moderar comentários", min: CAPS["comment.moderate"] },
      { cap: "user.suspend", label: "Suspender usuários", min: CAPS["user.suspend"] },
      { cap: "user.ban", label: "Banir usuários", min: CAPS["user.ban"] },
    ],
  },
  {
    group: "Administração",
    items: [
      { cap: "admin.access", label: "Acessar o painel administrativo", min: CAPS["admin.access"] },
      { cap: "user.manage", label: "Editar usuários", min: CAPS["user.manage"] },
      { cap: "logs.view", label: "Visualizar logs de auditoria", min: CAPS["logs.view"] },
      { cap: "settings.manage", label: "Alterar configurações da plataforma", min: CAPS["settings.manage"] },
      { cap: "user.assign_role_admin", label: "Conceder papel de administrador", min: CAPS["user.assign_role_admin"] },
      { cap: "user.assign_role_owner", label: "Transferir o papel OWNER", min: CAPS["user.assign_role_owner"] },
    ],
  },
];

export const ALL_CAPABILITIES = Object.keys(CAPS) as Capability[];

export function can(role: Role | undefined | null, cap: Capability): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[CAPS[cap]];
}

export function minRoleFor(cap: Capability): Role {
  return CAPS[cap];
}

/** Minimum role allowed to publish a change directly on a given page. */
export function directEditRole(protection: ProtectionLevel): Role {
  switch (protection) {
    case "free":
      return "contributor";
    case "moderated":
      return "moderator";
    case "protected":
      return "moderator";
    case "admin":
      return "admin";
  }
}

/** Minimum role allowed to *propose* a change on a given page. */
export function proposeRole(protection: ProtectionLevel): Role {
  switch (protection) {
    case "free":
      return "user";
    case "moderated":
      return "user";
    case "protected":
      return "contributor";
    case "admin":
      return "admin";
  }
}

export function canProposeOn(role: Role | undefined | null, protection: ProtectionLevel): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[proposeRole(protection)];
}

export function canDirectEditOn(role: Role | undefined | null, protection: ProtectionLevel): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[directEditRole(protection)];
}

/** Site-wide posture switches, editable by the OWNER in /admin/configuracoes. */
export interface SiteSettings {
  siteName: string;
  tagline: string;
  requireReviewForNewUsers: boolean;
  requireCaptchaOnContribute: boolean;
  contributionsPerHour: number;
  commentsEnabled: boolean;
  commentsPerHour: number;
  registrationOpen: boolean;
  aiAssistantEnabled: boolean;
  registrationRequiresEmail: boolean;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "Memepedia",
  tagline: "A enciclopédia livre dos memes da internet.",
  requireReviewForNewUsers: true,
  requireCaptchaOnContribute: true,
  contributionsPerHour: 6,
  commentsEnabled: true,
  commentsPerHour: 12,
  registrationOpen: true,
  aiAssistantEnabled: true,
  registrationRequiresEmail: false,
};
