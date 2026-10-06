"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Icons } from "@/components/icons";
import { buttonClass, Select } from "@/components/ui";
import { hardDeleteMemeAction } from "@/app/actions/admin";
import { PROTECTION_HINT, PROTECTION_LABEL, type ProtectionLevel } from "@/lib/types";
import { DangerForm } from "../admin-forms";

export type FlagAction =
  | "verify"
  | "unverify"
  | "feature"
  | "unfeature"
  | "hide"
  | "delete"
  | "restore"
  | "protect"
  | "toggle_comments";

export interface FlagPayload {
  action: FlagAction;
  meme_id: number;
  enabled?: string;
  level?: string;
}

type VoidAction = (form: FormData) => Promise<void>;

/**
 * These buttons are client components for one reason: they need the current
 * URL so the server action can send the moderator back to the same filtered
 * list they were looking at.
 */
function useReturnTo() {
  const pathname = usePathname();
  const search = useSearchParams();
  const params = new URLSearchParams(search.toString());
  // Feedback flags are appended by the server action; carrying the old ones
  // along would duplicate the query keys in the redirect.
  for (const key of ["resultado", "erro", "excluido"]) params.delete(key);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

const ICONS: Record<string, keyof typeof Icons> = {
  verified: "verified",
  checkCircle: "checkCircle",
  star: "star",
  chat: "chat",
  eyeOff: "eyeOff",
  trash: "trash",
  revert: "revert",
  shield: "shield",
};

export function MemeFlagButton({
  action,
  serverAction,
  label,
  icon,
  variant = "quiet",
}: {
  action: FlagPayload;
  serverAction: VoidAction;
  label: string;
  icon?: keyof typeof Icons;
  variant?: "quiet" | "secondary" | "danger";
}) {
  const returnTo = useReturnTo();
  const Icon = icon ? Icons[ICONS[icon] ?? "shield"] : null;

  return (
    <form action={serverAction}>
      <input type="hidden" name="action" value={action.action} />
      <input type="hidden" name="meme_id" value={action.meme_id} />
      {action.enabled !== undefined ? <input type="hidden" name="enabled" value={action.enabled} /> : null}
      {action.level ? <input type="hidden" name="level" value={action.level} /> : null}
      <input type="hidden" name="return_to" value={returnTo} />
      <button type="submit" className={buttonClass(variant, "sm")}>
        {Icon ? <Icon size={13} aria-hidden /> : null}
        {label}
      </button>
    </form>
  );
}

export function ProtectForm({
  memeId,
  protection,
  serverAction,
}: {
  memeId: number;
  protection: string;
  serverAction: VoidAction;
}) {
  const returnTo = useReturnTo();
  const value = (["free", "moderated", "protected", "admin"].includes(protection)
    ? protection
    : "free") as ProtectionLevel;

  return (
    <form action={serverAction} className="flex flex-col gap-2">
      <input type="hidden" name="action" value="protect" />
      <input type="hidden" name="meme_id" value={memeId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-4">
          Nível de proteção
        </span>
        <Select name="level" defaultValue={value} className="h-9 text-[0.8125rem]">
          {(["free", "moderated", "protected", "admin"] as ProtectionLevel[]).map((level) => (
            <option key={level} value={level}>
              {PROTECTION_LABEL[level]}
            </option>
          ))}
        </Select>
      </label>
      <p className="text-[0.6875rem] leading-relaxed text-ink-4">{PROTECTION_HINT[value]}</p>
      <button type="submit" className={buttonClass("secondary", "sm")}>
        <Icons.lock size={13} aria-hidden />
        Aplicar proteção
      </button>
    </form>
  );
}

export function HardDeleteForm({
  variant,
  memeId,
  name,
  serverAction,
}: {
  variant: "hide" | "delete" | "restore" | "hard";
  memeId: number;
  name: string;
  serverAction?: VoidAction;
}) {
  const returnTo = useReturnTo();

  if (variant === "hard") {
    return (
      <DangerForm
        action={hardDeleteMemeAction}
        fields={{ meme_id: memeId }}
        triggerLabel="Excluir permanentemente"
        title={`Excluir “${name}” para sempre?`}
        description="Isto apaga a página, todas as versões, mídia, comentários e contagens associadas. Não existe desfazer nem restauração de backup pela interface."
        expected="EXCLUIR"
        confirmLabel="Excluir permanentemente"
        variant="quiet"
      />
    );
  }

  if (!serverAction) return null;

  if (variant === "restore") {
    return (
      <MemeFlagButton
        action={{ action: "restore", meme_id: memeId }}
        serverAction={serverAction}
        label="Restaurar"
        icon="revert"
      />
    );
  }

  if (variant === "hide") {
    return (
      <DangerForm
        action={serverAction}
        fields={{ action: "hide", meme_id: memeId, return_to: returnTo }}
        triggerLabel="Ocultar"
        title={`Ocultar “${name}”?`}
        description="A página sai do catálogo e da busca, mas continua acessível pela URL direta e pode ser restaurada depois."
        confirmLabel="Ocultar página"
        variant="quiet"
      />
    );
  }

  return (
    <DangerForm
      action={serverAction}
      fields={{ action: "delete", meme_id: memeId, return_to: returnTo }}
      triggerLabel="Marcar como excluída"
      title={`Marcar “${name}” como excluída?`}
      description="A página é retirada do ar e tratada como removida em todo o site. Diferente da exclusão permanente, ainda pode ser restaurada pela moderação."
      confirmLabel="Marcar como excluída"
      variant="quiet"
    />
  );
}
