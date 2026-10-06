import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icons } from "./icons";
import { initials, hueOf } from "@/lib/format";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent/92 border border-transparent",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-raised",
  ghost: "text-ink-2 border border-transparent hover:bg-sunken hover:text-ink",
  danger: "bg-danger text-accent-ink border border-transparent hover:bg-danger/92",
  quiet: "bg-sunken text-ink-2 border border-line-soft hover:text-ink hover:border-line",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.8125rem] gap-1.5 rounded-control",
  md: "h-10 px-4 text-sm gap-2 rounded-control",
  lg: "h-12 px-5 text-[0.9375rem] gap-2 rounded-control",
};

const BASE =
  "inline-flex items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-out-soft active:translate-y-[1px] disabled:opacity-50 disabled:pointer-events-none select-none";

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link href={href} {...props} className={buttonClass(variant, size, className)} />;
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                      */
/* -------------------------------------------------------------------------- */

export type BadgeTone = "neutral" | "accent" | "ok" | "warn" | "danger" | "info" | "outline";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-sunken text-ink-2 border-line-soft",
  accent: "bg-accent-soft text-ink border-accent-line",
  ok: "bg-ok-soft text-ink border-transparent",
  warn: "bg-warn-soft text-ink border-transparent",
  danger: "bg-danger-soft text-ink border-transparent",
  info: "bg-info-soft text-ink border-transparent",
  outline: "bg-transparent text-ink-3 border-line",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
  title,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.75rem] font-medium leading-5",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Status badge that signals with an icon + label, never colour alone. */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: BadgeTone; label: string; icon: ReactNode }> = {
    pending: { tone: "warn", label: "Pendente", icon: <Icons.clock size={12} weight="bold" aria-hidden /> },
    approved: { tone: "ok", label: "Aprovada", icon: <Icons.check size={12} weight="bold" aria-hidden /> },
    rejected: { tone: "danger", label: "Rejeitada", icon: <Icons.close size={12} weight="bold" aria-hidden /> },
    changed: { tone: "info", label: "Alterada", icon: <Icons.note size={12} weight="bold" aria-hidden /> },
    cancelled: { tone: "neutral", label: "Cancelada", icon: <Icons.ban size={12} weight="bold" aria-hidden /> },
    published: { tone: "ok", label: "Publicado", icon: <Icons.check size={12} weight="bold" aria-hidden /> },
    hidden: { tone: "warn", label: "Oculto", icon: <Icons.eyeOff size={12} weight="bold" aria-hidden /> },
    deleted: { tone: "danger", label: "Excluído", icon: <Icons.trash size={12} weight="bold" aria-hidden /> },
    open: { tone: "warn", label: "Aberta", icon: <Icons.flag size={12} weight="bold" aria-hidden /> },
    resolved: { tone: "ok", label: "Resolvida", icon: <Icons.check size={12} weight="bold" aria-hidden /> },
    dismissed: { tone: "neutral", label: "Arquivada", icon: <Icons.ban size={12} weight="bold" aria-hidden /> },
    active: { tone: "ok", label: "Ativa", icon: <Icons.check size={12} weight="bold" aria-hidden /> },
    suspended: { tone: "warn", label: "Suspensa", icon: <Icons.clock size={12} weight="bold" aria-hidden /> },
    banned: { tone: "danger", label: "Banida", icon: <Icons.ban size={12} weight="bold" aria-hidden /> },
  };
  const entry = map[status] ?? { tone: "neutral" as BadgeTone, label: status, icon: null };
  return (
    <Badge tone={entry.tone} icon={entry.icon}>
      {entry.label}
    </Badge>
  );
}

export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <Badge
      tone="info"
      title="Informação revisada pela administração da Memepedia"
      icon={<Icons.verified size={13} weight="fill" aria-hidden />}
    >
      {compact ? "Verificado" : "Verificado pela administração"}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

export function Panel({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <Tag className={cn("rounded-card border border-line bg-surface", className)}>{children}</Tag>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-ink-3">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-[0.8125rem] text-ink-3">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line px-6 py-12 text-center">
      {icon ? <span className="text-ink-4">{icon}</span> : null}
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? <p className="mx-auto mt-1 max-w-md text-[0.8125rem] text-ink-3">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-control bg-sunken", className)} />;
}

export function Alert({
  tone = "info",
  title,
  children,
  icon,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const map = {
    info: "border-info/40 bg-info-soft",
    warn: "border-warn/40 bg-warn-soft",
    danger: "border-danger/40 bg-danger-soft",
    ok: "border-ok/40 bg-ok-soft",
  } as const;
  const icons = {
    info: <Icons.info size={16} aria-hidden />,
    warn: <Icons.warning size={16} aria-hidden />,
    danger: <Icons.warningOctagon size={16} aria-hidden />,
    ok: <Icons.checkCircle size={16} aria-hidden />,
  } as const;
  return (
    <div className={cn("flex gap-2.5 rounded-card border px-3.5 py-3 text-[0.8125rem] text-ink", map[tone])}>
      <span className="mt-px shrink-0 text-ink-2">{icon ?? icons[tone]}</span>
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn("text-ink-2", title && "mt-0.5")}>{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Forms                                                                       */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  required,
  counter,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  counter?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[0.8125rem] font-semibold text-ink">
          {label}
          {required ? (
            <span className="ml-1 text-accent" aria-hidden>
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> (obrigatório)</span> : null}
        </label>
        {counter ? <span className="font-mono text-[0.6875rem] text-ink-4 tabular">{counter}</span> : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="flex items-center gap-1 text-[0.75rem] font-medium text-danger">
          <Icons.warningCircle size={13} aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.75rem] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-control border border-line bg-sunken px-3 py-2 text-sm text-ink placeholder:text-ink-4 transition-colors duration-150 focus:border-accent-line focus:bg-surface focus:outline-none disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn(CONTROL, "h-10", className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(CONTROL, "min-h-24 resize-y leading-relaxed", className)} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={cn(CONTROL, "h-10 cursor-pointer pr-8", className)}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: ComponentProps<"input"> & { label: ReactNode; description?: string }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-ink", className)}>
      <input
        type="checkbox"
        {...props}
        className="mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border border-line-strong bg-sunken checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <span className="min-w-0">
        <span className="font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-[0.75rem] text-ink-3">{description}</span> : null}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatars                                                                     */
/* -------------------------------------------------------------------------- */

export function Avatar({
  name,
  src,
  size = 32,
  role,
}: {
  name: string;
  src?: string | null;
  size?: number;
  role?: string;
}) {
  const hue = hueOf(name || "meme");
  const ring =
    role === "owner"
      ? "ring-2 ring-accent ring-offset-1 ring-offset-surface"
      : role === "admin" || role === "moderator"
        ? "ring-1 ring-line-strong"
        : "";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", ring)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        background: `oklch(0.92 0.045 ${hue})`,
        color: `oklch(0.32 0.08 ${hue})`,
        fontSize: size * 0.38,
      }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", ring)}
    >
      {initials(name || "?")}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout helpers                                                              */
/* -------------------------------------------------------------------------- */

export function SectionHeading({
  title,
  description,
  action,
  icon,
  as: Tag = "h2",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <Tag className="flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-ink sm:text-2xl">
          {icon ? <span className="text-accent">{icon}</span> : null}
          {title}
        </Tag>
        {description ? (
          <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-ink-3">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: BadgeTone;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</p>
        {icon ? <span className={cn("text-ink-4", tone === "accent" && "text-accent")}>{icon}</span> : null}
      </div>
      <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-ink tabular">{value}</p>
      {hint ? <p className="mt-0.5 text-[0.75rem] text-ink-3">{hint}</p> : null}
    </div>
  );
}

/** Link-based tabs so filtering stays crawlable and keyboard-native. */
export function Tabs({
  items,
  current,
  className,
}: {
  items: { label: string; href: string; count?: number }[];
  current: string;
  className?: string;
}) {
  return (
    <div className={cn("scroll-x -mx-1 flex gap-1 px-1", className)} role="tablist">
      {items.map((item) => {
        const active = item.label === current;
        return (
          <Link
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={active}
            scroll={false}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-control px-3 py-1.5 text-[0.8125rem] font-medium transition-colors duration-150",
              active ? "bg-accent-soft text-ink" : "text-ink-3 hover:bg-sunken hover:text-ink",
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="font-mono text-[0.6875rem] text-ink-4 tabular">{item.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

export function Pagination({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const window = 2;
  const numbers: number[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= window) numbers.push(p);
  }
  const rendered: (number | "gap")[] = [];
  let prev = 0;
  for (const n of numbers) {
    if (prev && n - prev > 1) rendered.push("gap");
    rendered.push(n);
    prev = n;
  }

  return (
    <nav aria-label="Paginação" className="flex items-center justify-center gap-1 pt-2">
      <PageArrow href={hrefFor(page - 1)} disabled={page <= 1} label="Página anterior">
        <Icons.caretLeft size={16} aria-hidden />
      </PageArrow>
      {rendered.map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} className="px-1.5 text-ink-4" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-control font-mono text-[0.8125rem] tabular transition-colors duration-150",
              item === page
                ? "bg-accent text-accent-ink font-semibold"
                : "text-ink-2 hover:bg-sunken hover:text-ink",
            )}
          >
            {item}
          </Link>
        ),
      )}
      <PageArrow href={hrefFor(page + 1)} disabled={page >= pages} label="Próxima página">
        <Icons.caretRight size={16} aria-hidden />
      </PageArrow>
    </nav>
  );
}

function PageArrow({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex size-9 items-center justify-center rounded-control text-ink-4 opacity-50"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-sunken hover:text-ink"
    >
      {children}
    </Link>
  );
}

export function MetaRow({ items }: { items: { icon?: ReactNode; text: ReactNode; title?: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-3">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-1" title={item.title}>
          {item.icon ? <span className="text-ink-4">{item.icon}</span> : null}
          {item.text}
        </span>
      ))}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-1 text-[0.75rem] text-ink-3">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 ? <Icons.caretRight size={10} className="text-ink-4" aria-hidden /> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-ink hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink-2">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function DemoBadge() {
  return (
    <Badge
      tone="neutral"
      title="Conteúdo de demonstração criado para mostrar a interface. Revise e substitua por informação documentada."
      icon={<Icons.lightbulb size={12} aria-hidden />}
    >
      Demonstração
    </Badge>
  );
}
