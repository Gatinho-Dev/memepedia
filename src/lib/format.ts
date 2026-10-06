/** Pure formatting helpers, safe in both server and client components. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2}:\d{2})?/;

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = DATE_RE.test(value) ? value.replace(" ", "T") + (value.length <= 10 ? "T00:00:00" : "Z") : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function relativeTime(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "data desconhecida";
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (Math.abs(min) < 1) return "agora mesmo";
  if (min < 60) return `há ${min} ${min === 1 ? "minuto" : "minutos"}`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  const months = Math.round(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.round(months / 12);
  return `há ${years} ${years === 1 ? "ano" : "anos"}`;
}

export function formatDate(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "-";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "-";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR").format(Number(n ?? 0));
}

export function compactNumber(n: number | null | undefined): string {
  const value = Number(n ?? 0);
  if (value < 1000) return String(value);
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Deterministic hue from a string, used for avatar colours (not meaning). */
export function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/** Hue constrained to a comfortable band so avatar tints stay on-brand. */
export function avatarHue(seed: string): number {
  return 18 + (hueOf(seed) % 300);
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function decadeLabel(year: number | null): string {
  if (!year) return "Data não confirmada";
  if (year < 2000) return "Antes dos anos 2000";
  return `Anos ${Math.floor(year / 10) * 10}`;
}

/** Strip the light markup down to plain text for previews and meta tags. */
export function plainText(markup: string, max = 200): string {
  return truncate(
    markup
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/[*`>#-]/g, " ")
      .replace(/\s+/g, " "),
    max,
  );
}
