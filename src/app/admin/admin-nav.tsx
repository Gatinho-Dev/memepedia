"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: string;
  count?: number;
  tone?: "accent" | "danger";
}

/**
 * Client-side because the active item depends on the current path. The list
 * itself is computed on the server with the viewer's capabilities, so items the
 * user cannot use never reach the DOM.
 */
export function AdminNav({ items, icons }: { items: NavItem[]; icons: Record<string, React.ReactNode> }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Seções do painel" className="scroll-x flex gap-1 lg:flex-col">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={item.description}
            className={cn(
              "group flex shrink-0 items-center gap-2.5 rounded-control px-3 py-2.5 text-[0.8125rem] font-medium transition-colors duration-150 lg:shrink",
              active
                ? "bg-accent-soft text-accent ring-1 ring-accent-line"
                : "text-ink-2 hover:bg-sunken hover:text-ink",
            )}
          >
            <span className={active ? "text-accent" : "text-ink-3 group-hover:text-ink"} aria-hidden>
              {icons[item.icon]}
            </span>
            <span className="whitespace-nowrap">{item.label}</span>
            {item.count ? (
              <span
                className={cn(
                  "ml-auto grid min-w-5 place-items-center rounded-full px-1.5 font-mono text-[0.625rem] font-semibold leading-5 tabular",
                  item.tone === "danger" ? "bg-danger text-paper" : "bg-accent text-accent-ink",
                )}
              >
                {item.count > 99 ? "99+" : item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
