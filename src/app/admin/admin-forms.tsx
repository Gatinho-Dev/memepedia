"use client";

import { useActionState, useRef } from "react";
import { Icons } from "@/components/icons";
import {
  Alert,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { DangerConfirm, SubmitButton } from "@/components/ui-client";
import { emptyAction, type ActionState } from "@/lib/forms";
import { ROLES, type Role, type UserStatus } from "@/lib/types";
import type { SiteSettings } from "@/lib/permissions";

type StateAction = (state: ActionState, form: FormData) => Promise<ActionState>;
type VoidAction = (form: FormData) => Promise<void>;

/* -------------------------------------------------------------------------- */
/* Confirmation for destructive, no-JS-free actions                            */
/* -------------------------------------------------------------------------- */

/**
 * Server actions that redirect cannot round-trip through useActionState
 * reliably, so destructive buttons render a hidden form and the modal trigger
 * submits it. The confirmation step stays in the client; authorization stays on
 * the server.
 */
export function DangerForm({
  action,
  fields,
  triggerLabel,
  title,
  description,
  expected,
  confirmLabel = "Confirmar",
  variant = "danger",
  size = "sm",
}: {
  action: VoidAction;
  fields: Record<string, string | number>;
  triggerLabel: string;
  title: string;
  description: string;
  expected?: string;
  confirmLabel?: string;
  variant?: "danger" | "quiet" | "secondary";
  size?: "sm" | "md";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <DangerConfirm
        triggerLabel={triggerLabel}
        title={title}
        description={description}
        expected={expected}
        confirmLabel={confirmLabel}
        variant={variant}
        size={size}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
      <form ref={formRef} action={action} className="hidden">
        {Object.entries(fields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      </form>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

function StateFeedback({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <Alert tone={state.ok ? "ok" : "danger"}>
      <p className="text-[0.8125rem]">{state.message}</p>
    </Alert>
  );
}

export function RoleForm({
  action,
  userId,
  username,
  current,
  allowed,
  disabledReason,
}: {
  action: StateAction;
  userId: number;
  username: string;
  current: Role;
  allowed: Role[];
  disabledReason?: string;
}) {
  const [state, formAction] = useActionState(action, emptyAction);

  if (disabledReason) {
    return (
      <p className="text-[0.75rem] text-ink-4" title={disabledReason}>
        Papel {ROLES.find((r) => r.key === current)?.label} — protegido
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <div className="flex flex-wrap items-center gap-2">
        <Select name="role" defaultValue={current} className="w-40" aria-label={`Papel de @${username}`}>
          {ROLES.filter((role) => role.key !== "owner" && allowed.includes(role.key)).map((role) => (
            <option key={role.key} value={role.key}>
              {role.label}
            </option>
          ))}
        </Select>
        <SubmitButton variant="secondary" size="sm" pendingLabel="Salvando…">
          <Icons.shield size={13} aria-hidden />
          Aplicar
        </SubmitButton>
      </div>
      <StateFeedback state={state} />
    </form>
  );
}

export function StatusForm({
  action,
  userId,
  username,
  status,
  canBan,
}: {
  action: StateAction;
  userId: number;
  username: string;
  status: UserStatus;
  canBan: boolean;
}) {
  const [state, formAction] = useActionState(action, emptyAction);
  const options: { value: UserStatus; label: string }[] = [
    { value: "active", label: "Ativa" },
    { value: "suspended", label: "Suspensa" },
  ];
  if (canBan) options.push({ value: "banned", label: "Banida (permanente)" });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Status da conta" htmlFor={`status-${userId}`}>
          <Select id={`status-${userId}`} name="status" defaultValue={status} className="w-44">
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton variant="secondary" size="sm" pendingLabel="Aplicando…">
          Alterar status
        </SubmitButton>
      </div>
      <details>
        <summary className="cursor-pointer text-[0.75rem] font-medium text-accent">
          Motivo (obrigatório para suspender ou banir)
        </summary>
        <div className="mt-2">
          <Textarea
            name="reason"
            rows={2}
            maxLength={500}
            placeholder={`Ex.: vandalismo repetido em páginas de @${username}.`}
            aria-label={`Motivo da alteração de status de @${username}`}
          />
        </div>
      </details>
      {state.errors?.reason ? (
        <p className="text-[0.75rem] font-medium text-danger">{state.errors.reason}</p>
      ) : null}
      <StateFeedback state={state} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Taxonomy                                                                    */
/* -------------------------------------------------------------------------- */

export function CategoryForm({
  action,
  category,
}: {
  action: StateAction;
  category?: { id: number; name: string; slug: string; description: string; group_name: string; sort_order: number };
}) {
  const [state, formAction] = useActionState(action, emptyAction);
  const prefix = category ? `cat-${category.id}` : "cat-new";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" htmlFor={`${prefix}-name`} error={state.errors?.name} required>
          <Input id={`${prefix}-name`} name="name" defaultValue={category?.name ?? ""} required placeholder="Memes de gato" />
        </Field>
        <Field
          label="Endereço"
          htmlFor={`${prefix}-slug`}
          hint="Aparece em /categoria/…"
          error={state.errors?.slug}
        >
          <Input id={`${prefix}-slug`} name="slug" defaultValue={category?.slug ?? ""} placeholder="memes-de-gato" />
        </Field>
        <Field label="Grupo" htmlFor={`${prefix}-group`} hint="Ex.: Animais, Brasil, Nostalgia">
          <Input id={`${prefix}-group`} name="group_name" defaultValue={category?.group_name ?? "Geral"} />
        </Field>
        <Field label="Ordem" htmlFor={`${prefix}-order`} hint="Números menores aparecem primeiro.">
          <Input
            id={`${prefix}-order`}
            name="sort_order"
            type="number"
            defaultValue={category?.sort_order ?? 100}
            min={0}
            max={9999}
          />
        </Field>
      </div>
      <Field label="Descrição" htmlFor={`${prefix}-desc`} hint="Uma frase explicando o que entra nesta categoria.">
        <Textarea id={`${prefix}-desc`} name="description" rows={2} defaultValue={category?.description ?? ""} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant={category ? "secondary" : "primary"} size="sm" pendingLabel="Salvando…">
          {category ? "Salvar alterações" : "Criar categoria"}
        </SubmitButton>
        <StateFeedback state={state} />
      </div>
    </form>
  );
}

export function TagForm({
  action,
  tag,
}: {
  action: StateAction;
  tag: { id: number; name: string; slug: string; use_count: number };
}) {
  const [state, formAction] = useActionState(action, emptyAction);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="tag_id" value={tag.id} />
      <Input
        name="name"
        defaultValue={tag.name}
        className="w-44"
        aria-label={`Novo nome para a tag ${tag.name}`}
      />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Salvando…">
        Renomear
      </SubmitButton>
      {state.message ? (
        <span className={state.ok ? "text-[0.75rem] text-ok" : "text-[0.75rem] text-danger"}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Settings + ownership                                                        */
/* -------------------------------------------------------------------------- */

export function SettingsForm({
  action,
  settings,
}: {
  action: StateAction;
  settings: SiteSettings;
}) {
  const [state, formAction] = useActionState(action, emptyAction);
  const booleanKeys = Object.keys(settings).filter(
    (key) => typeof settings[key as keyof SiteSettings] === "boolean",
  ) as (keyof SiteSettings)[];
  const stringKeys = Object.keys(settings).filter(
    (key) => typeof settings[key as keyof SiteSettings] === "string",
  ) as (keyof SiteSettings)[];
  const numberKeys = Object.keys(settings).filter(
    (key) => typeof settings[key as keyof SiteSettings] === "number",
  ) as (keyof SiteSettings)[];

  const BOOL_COPY: Record<string, string> = {
    requireReviewForNewUsers: "Contas novas entram na fila de revisão em vez de publicar direto.",
    requireCaptchaOnContribute: "Exigir confirmação humana (aritmética) para usuários e colaboradores.",
    commentsEnabled: "Comentários habilitados globalmente. Cada página pode ser desativada individualmente.",
    registrationOpen: "Permitir criação de contas.",
    aiAssistantEnabled: "Mostrar sugestões automáticas de duplicidade na criação de memes.",
    registrationRequiresEmail: "Exigir confirmação de e-mail no cadastro.",
  };
  const LABELS: Record<string, string> = {
    siteName: "Nome do site",
    tagline: "Slogan",
    contributionsPerHour: "Contribuições por hora (por conta)",
    commentsPerHour: "Comentários por hora (por conta)",
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {stringKeys.map((key) => (
          <Field key={key} label={LABELS[key] ?? key} htmlFor={`set-${key}`}>
            <Input id={`set-${key}`} name={key} defaultValue={String(settings[key])} maxLength={200} />
          </Field>
        ))}
        {numberKeys.map((key) => (
          <Field
            key={key}
            label={LABELS[key] ?? key}
            htmlFor={`set-${key}`}
            hint="Entre 1 e 200."
          >
            <Input
              id={`set-${key}`}
              name={key}
              type="number"
              min={1}
              max={200}
              defaultValue={Number(settings[key])}
            />
          </Field>
        ))}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[0.8125rem] font-semibold text-ink">Postura da plataforma</legend>
        {booleanKeys.map((key) => (
          <Checkbox
            key={key}
            name={key}
            defaultChecked={Boolean(settings[key])}
            label={LABELS[key] ?? key}
            description={BOOL_COPY[key]}
          />
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
        <SubmitButton pendingLabel="Salvando…">
          <Icons.check size={14} aria-hidden />
          Salvar configurações
        </SubmitButton>
        <StateFeedback state={state} />
      </div>
    </form>
  );
}

export function OwnershipForm({ action }: { action: StateAction }) {
  const [state, formAction] = useActionState(action, emptyAction);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome de usuário do novo OWNER" htmlFor="target_username" error={state.errors?.target_username} required>
          <Input id="target_username" name="target_username" required placeholder="ex.: clarice" autoComplete="off" />
        </Field>
        <Field label="Sua senha atual" htmlFor="owner-password" error={state.errors?.password} required>
          <Input id="owner-password" name="password" type="password" required autoComplete="current-password" />
        </Field>
      </div>
      <Field
        label='Confirmação'
        htmlFor="owner-confirm"
        hint='Digite exatamente "TRANSFERIR" em maiúsculas.'
        error={state.errors?.confirm}
        required
      >
        <Input id="owner-confirm" name="confirm" required placeholder="TRANSFERIR" autoComplete="off" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="danger" pendingLabel="Transferindo…">
          <Icons.shield size={14} aria-hidden />
          Transferir o papel OWNER
        </SubmitButton>
        <StateFeedback state={state} />
      </div>
    </form>
  );
}
