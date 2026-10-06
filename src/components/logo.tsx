import Link from "next/link";
import { cn } from "./ui";

/**
 * Wordmark: a filled square with the initial plus the name in display weight.
 * Geometric, no hand-drawn paths.
 */
export function Logo({ className, withTagline = false }: { className?: string; withTagline?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="Memepedia, página inicial"
    >
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-accent text-[1.0625rem] font-bold leading-none text-accent-ink transition-transform duration-200 ease-out-soft group-hover:-rotate-3"
      >
        M
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-[1.0625rem] font-semibold tracking-[-0.025em] text-ink">Memepedia</span>
        {withTagline ? (
          <span className="mt-0.5 hidden text-[0.6875rem] leading-tight text-ink-3 sm:block">
            A enciclopédia livre dos memes
          </span>
        ) : null}
      </span>
    </Link>
  );
}
