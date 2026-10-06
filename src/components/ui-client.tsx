"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { Icons } from "./icons";
import { buttonClass, cn, type ButtonSize, type ButtonVariant } from "./ui";

/* -------------------------------------------------------------------------- */
/* Theme                                                                       */
/* -------------------------------------------------------------------------- */

type ThemeChoice = "light" | "dark" | "system";

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && systemPrefersDark());
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themeChoice = choice;
}

export function ThemeToggle({ initial }: { initial: ThemeChoice }) {
  const [choice, setChoice] = useState<ThemeChoice>(initial);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem("memepedia-theme") as ThemeChoice | null) ?? initial;
    setChoice(stored);
    applyTheme(stored);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem("memepedia-theme") as ThemeChoice | null) === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [initial]);

  const cycle = useCallback(() => {
    const order: ThemeChoice[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(choice) + 1) % order.length];
    setChoice(next);
    localStorage.setItem("memepedia-theme", next);
    applyTheme(next);
    void fetch("/api/preferencias", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => undefined);
  }, [choice]);

  const label = choice === "light" ? "Tema claro" : choice === "dark" ? "Tema escuro" : "Tema do sistema";

  return (
    <button
      type="button"
      onClick={cycle}
      title={`${label}. Clique para alternar.`}
      aria-label={`${label}. Alternar tema.`}
      className={buttonClass("ghost", "sm", "size-9 px-0")}
    >
      <span aria-hidden>
        {!mounted ? <Icons.sun size={18} /> : choice === "light" ? <Icons.sun size={18} /> : choice === "dark" ? <Icons.moon size={18} /> : <Icons.compass size={18} />}
      </span>
    </button>
  );
}

/** Inline no-flash bootstrap: runs before paint. */
export const THEME_BOOTSTRAP = `(function(){try{var c=localStorage.getItem('memepedia-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(c==='dark'||c==='light')?c:(d?'dark':'light');document.documentElement.dataset.theme=t;document.documentElement.dataset.themeChoice=(c==='dark'||c==='light'||c==='system')?c:'system';}catch(e){document.documentElement.dataset.theme='light';}})();`;

/* -------------------------------------------------------------------------- */
/* Form buttons                                                                */
/* -------------------------------------------------------------------------- */

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingLabel,
  disabled,
  confirm,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  pendingLabel?: string;
  disabled?: boolean;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className={buttonClass(variant, size, className)}
    >
      {pending ? (
        <>
          <Icons.spinner size={16} className="animate-spin" aria-hidden />
          {pendingLabel ?? "Enviando…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Dropdown (uses native <details> for keyboard + no-JS support)               */
/* -------------------------------------------------------------------------- */

export function Dropdown({
  trigger,
  children,
  align = "right",
  label,
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const el = ref.current;
      if (el?.open && !el.contains(event.target as Node)) el.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current) ref.current.open = false;
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <details ref={ref} className={cn("group relative", className)}>
      <summary
        aria-label={label}
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-control px-2 py-1.5 text-[0.8125rem] text-ink-2 transition-colors duration-150 marker:hidden hover:bg-sunken hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        {trigger}
        <Icons.caretDown size={12} className="text-ink-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div
        className={cn(
          "absolute z-50 mt-1.5 min-w-56 rounded-overlay border border-line bg-overlay p-1.5 shadow-[var(--shadow-overlay)]",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {children}
      </div>
    </details>
  );
}

export function MenuItem({
  children,
  href,
  onClick,
  icon,
  tone = "default",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  tone?: "default" | "danger";
}) {
  const cls = cn(
    "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[0.8125rem] font-medium transition-colors duration-150",
    tone === "danger" ? "text-danger hover:bg-danger-soft" : "text-ink-2 hover:bg-sunken hover:text-ink",
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {icon ? <span className="text-ink-4">{icon}</span> : null}
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {icon ? <span className="text-ink-4">{icon}</span> : null}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1.5 h-px bg-line-soft" role="separator" />;
}

/* -------------------------------------------------------------------------- */
/* Copy to clipboard                                                           */
/* -------------------------------------------------------------------------- */

export function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("ghost", "sm")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      <span aria-hidden>{copied ? <Icons.check size={14} /> : <Icons.copy size={14} />}</span>
      <span aria-live="polite">{copied ? "Copiado" : label}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                       */
/* -------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-[oklch(0.2_0.01_264/0.55)] backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-overlay border border-line bg-overlay p-5 shadow-[var(--shadow-overlay)] sm:max-w-lg sm:rounded-overlay"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1 text-[0.8125rem] text-ink-3">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className={buttonClass("ghost", "sm", "size-8 shrink-0 px-0")}
          >
            <Icons.close size={16} aria-hidden />
          </button>
        </div>
        <div className="text-sm text-ink-2">{children}</div>
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Destructive confirm that requires the exact target name to be typed. */
export function DangerConfirm({
  triggerLabel,
  title,
  description,
  expected,
  inputLabel,
  confirmLabel = "Confirmar",
  onConfirm,
  size = "sm",
  variant = "danger",
}: {
  triggerLabel: string;
  title: string;
  description: string;
  expected?: string;
  inputLabel?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const matches = !expected || typed.trim() === expected;
  return (
    <>
      <button type="button" className={buttonClass(variant, size)} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setTyped("");
        }}
        title={title}
        description={description}
        footer={
          <>
            <button
              type="button"
              className={buttonClass("secondary", "sm")}
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!matches}
              className={buttonClass("danger", "sm")}
              onClick={() => {
                onConfirm();
                setOpen(false);
                setTyped("");
              }}
            >
              {confirmLabel}
            </button>
          </>
        }
      >
        {expected ? (
          <label className="block">
            <span className="text-[0.8125rem] font-medium text-ink">
              {inputLabel ?? `Digite "${expected}" para confirmar`}
            </span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="mt-2 w-full rounded-control border border-line bg-sunken px-3 py-2 font-mono text-sm"
            />
          </label>
        ) : null}
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Search with live suggestions                                                */
/* -------------------------------------------------------------------------- */

type Suggestion = {
  type: "meme" | "categoria" | "tag" | "usuario";
  label: string;
  href: string;
  hint?: string | null;
};

export function SearchBox({
  size = "md",
  autoFocus = false,
  placeholder = "Pesquise um meme…",
  initialValue = "",
  className,
  variant = "default",
}: {
  size?: "md" | "lg";
  autoFocus?: boolean;
  placeholder?: string;
  initialValue?: string;
  className?: string;
  variant?: "default" | "hero";
}) {
  const [value, setValue] = useState(initialValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/buscar?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { items: Suggestion[] };
        setItems(data.items ?? []);
        setOpen((data.items ?? []).length > 0);
        setActive(-1);
      } catch {
        /* aborted or offline: keep the previous suggestions */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const submit = () => {
    const term = value.trim();
    if (term) window.location.href = `/buscar?q=${encodeURIComponent(term)}`;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Enter" && active >= 0 && items[active]) {
      event.preventDefault();
      window.location.href = items[active].href;
    }
  };

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" aria-hidden>
          <Icons.search size={size === "lg" ? 20 : 16} />
        </span>
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Pesquisar na Memepedia"
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => items.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          enterKeyHint="search"
          className={cn(
            "w-full rounded-control border bg-sunken pr-24 text-ink placeholder:text-ink-4 transition-colors duration-150 focus:bg-surface focus:outline-none",
            size === "lg" ? "h-14 pl-11 text-base" : "h-9 pl-9 text-sm",
            variant === "hero" ? "border-line-strong shadow-[var(--shadow-overlay)]" : "border-line",
          )}
        />
        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading ? <Icons.spinner size={14} className="animate-spin text-ink-4" aria-hidden /> : null}
          <button
            type="button"
            onClick={submit}
            className={buttonClass("primary", "sm", size === "lg" ? "h-10" : "h-7")}
          >
            Pesquisar
          </button>
        </span>
      </div>

      <div aria-live="polite" className="sr-only">
        {open ? `${items.length} sugestões disponíveis` : ""}
      </div>

      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto rounded-overlay border border-line bg-overlay p-1.5 shadow-[var(--shadow-overlay)]"
        >
          {items.map((item, i) => (
            <li key={`${item.href}-${i}`} role="option" aria-selected={i === active}>
              <Link
                href={item.href}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex items-start gap-2.5 rounded-control px-2.5 py-2 text-[0.8125rem]",
                  i === active ? "bg-sunken text-ink" : "text-ink-2",
                )}
              >
                <span className="mt-0.5 shrink-0 text-ink-4" aria-hidden>
                  {item.type === "meme" ? (
                    <Icons.book size={14} />
                  ) : item.type === "categoria" ? (
                    <Icons.category size={14} />
                  ) : item.type === "tag" ? (
                    <Icons.hash size={14} />
                  ) : (
                    <Icons.user size={14} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{item.label}</span>
                  {item.hint ? <span className="block truncate text-[0.75rem] text-ink-3">{item.hint}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Media picker                                                                */
/* -------------------------------------------------------------------------- */

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_WIDTH = 1600;
const THUMB_WIDTH = 480;

async function resize(
  file: File,
  maxWidth: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob) return null;
    return { blob, width, height };
  } catch {
    return null;
  }
}

/**
 * Image field that shrinks raster uploads in the browser before they are sent.
 * Animated GIFs are passed through untouched (a canvas would flatten the
 * animation), so they are only size-checked. Every rejection is announced in
 * text, not just colour.
 */
export function MediaPicker({
  name = "media",
  label = "Imagem do meme",
  hint = "JPG, PNG, WEBP ou GIF. Até 5 MB. Imagens grandes são reduzidas automaticamente no seu navegador.",
  required = false,
  currentUrl,
}: {
  name?: string;
  label?: string;
  hint?: string;
  required?: boolean;
  currentUrl?: string | null;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handle = useCallback(async (fileList: FileList | null) => {
    setError(null);
    setStatus(null);
    const file = fileList?.[0];
    if (!file || !inputRef.current || !thumbRef.current) {
      setPreview(currentUrl ?? null);
      return;
    }
    const isGif = file.type === "image/gif";
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setError("Formato não aceito. Envie JPG, PNG, WEBP ou GIF.");
      inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(2)} MB). O limite é 5 MB.`);
      inputRef.current.value = "";
      return;
    }

    if (isGif) {
      setStatus(`GIF de ${(file.size / 1024).toFixed(0)} KB enviado sem conversão, para preservar a animação.`);
      setPreview(URL.createObjectURL(file));
      thumbRef.current.value = "";
      return;
    }

    const full = await resize(file, MAX_WIDTH, 0.84);
    const thumb = await resize(file, THUMB_WIDTH, 0.78);
    if (!full) {
      setStatus("Não foi possível processar a imagem. O arquivo original será enviado.");
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(new File([full.blob], `${name}.webp`, { type: "image/webp" }));
    inputRef.current.files = transfer.files;

    if (thumb) {
      const thumbTransfer = new DataTransfer();
      thumbTransfer.items.add(new File([thumb.blob], `${name}-thumb.webp`, { type: "image/webp" }));
      thumbRef.current.files = thumbTransfer.files;
    }

    setPreview(URL.createObjectURL(full.blob));
    const saved = Math.max(0, Math.round(100 - (full.blob.size / file.size) * 100));
    setStatus(
      `Otimizada no navegador: ${full.width}×${full.height}, ${(full.blob.size / 1024).toFixed(0)} KB (${saved}% menor que o original).`,
    );
  }, [currentUrl, name]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.8125rem] font-semibold text-ink">
        {label}
        {required ? (
          <>
            <span className="ml-1 text-accent" aria-hidden>
              *
            </span>
            <span className="sr-only"> (obrigatório)</span>
          </>
        ) : null}
      </span>
      <div className="flex flex-wrap items-start gap-3">
        {preview ? (
          <span className="block size-20 shrink-0 overflow-hidden rounded-control border border-line bg-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Pré-visualização da imagem selecionada" className="size-full object-cover" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className={buttonClass("secondary", "sm", "cursor-pointer")}>
            <Icons.upload size={15} aria-hidden />
            Escolher arquivo
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            name={name}
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => void handle(event.target.files)}
            className="sr-only"
          />
          <input ref={thumbRef} type="file" name={`${name}_thumb`} className="hidden" tabIndex={-1} aria-hidden />
          <p className="mt-1.5 text-[0.75rem] text-ink-3">{hint}</p>
          {status ? (
            <p className="mt-1 text-[0.75rem] font-medium text-ok" aria-live="polite">
              {status}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-1 flex items-center gap-1 text-[0.75rem] font-medium text-danger">
              <Icons.warningCircle size={13} aria-hidden />
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tags field                                                                  */
/* -------------------------------------------------------------------------- */

export function TagsField({
  name = "tags",
  defaultValue = "",
  label = "Tags",
  hint = "Separe por vírgula. Tags ligam este meme a outros parecidos.",
}: {
  name?: string;
  defaultValue?: string;
  label?: string;
  hint?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const id = useId();
  const chips = value
    .split(/[,\n]/)
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 12);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.8125rem] font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="cachorro, shiba inu, classico"
        autoComplete="off"
        className="w-full rounded-control border border-line bg-sunken px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-accent-line focus:bg-surface focus:outline-none"
      />
      {chips.length ? (
        <ul className="mt-0.5 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <li
              key={chip}
              className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-sunken px-2 py-0.5 text-[0.75rem] text-ink-2"
            >
              <Icons.hash size={11} aria-hidden />
              {chip}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[0.75rem] text-ink-3">{hint}</p>
    </div>
  );
}
