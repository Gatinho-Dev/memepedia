import { cn } from "./ui";

export interface TrendPoint {
  label: string;
  value: number;
}

/**
 * Bars first, chart library never. A dashboard that renders in the same request
 * as the data avoids the empty-first-paint problem and keeps the bundle small.
 */
export function TrendBars({
  data,
  ariaLabel,
  height = 140,
  formatValue,
  className,
}: {
  data: TrendPoint[];
  ariaLabel: string;
  height?: number;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((point) => point.value));
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const fmt = formatValue ?? ((value: number) => String(value));

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div
        role="img"
        aria-label={`${ariaLabel}. Total: ${fmt(total)}.`}
        className="flex items-end gap-1 rounded-control bg-sunken p-2"
        style={{ height }}
      >
        {data.map((point, index) => {
          const ratio = point.value / max;
          const isLast = index === data.length - 1;
          return (
            <span
              key={`${point.label}-${index}`}
              className="group relative flex h-full min-w-0 flex-1 items-end"
              title={`${point.label}: ${fmt(point.value)}`}
            >
              <span
                className={cn(
                  "w-full rounded-[3px] transition-colors duration-150",
                  isLast ? "bg-accent" : "bg-accent/45 group-hover:bg-accent/70",
                )}
                style={{ height: `${Math.max(2, ratio * 100)}%` }}
              />
            </span>
          );
        })}
      </div>
      <figcaption className="flex justify-between text-[0.6875rem] text-ink-4">
        <span>{data[0]?.label}</span>
        <span className="tabular">
          máx. {fmt(max)} · total {fmt(total)}
        </span>
        <span>{data[data.length - 1]?.label}</span>
      </figcaption>
    </figure>
  );
}

/** Compact consumption bar used in "top categorias" style rankings. */
export function RankBars({ items }: { items: { label: string; value: number; href?: string }[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[0.8125rem] text-ink-2">{item.label}</span>
              <span className="font-mono text-[0.75rem] text-ink-3 tabular">{item.value}</span>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sunken">
              <span
                className="block h-full rounded-full bg-accent/70"
                style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
              />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
