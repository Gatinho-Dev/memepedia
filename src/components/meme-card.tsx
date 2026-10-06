import Link from "next/link";
import { Icons } from "./icons";
import { Badge, cn } from "./ui";
import { compactNumber, relativeTime } from "@/lib/format";
import type { MemeListItem } from "@/lib/memes";

/**
 * Catalog card. Media sits on a tinted placeholder so the layout never shifts
 * while an image loads (CLS), and images are lazy by default - only the first
 * row should be eager.
 */
export function MemeCard({
  meme,
  priority = false,
  showTags = false,
}: {
  meme: MemeListItem;
  priority?: boolean;
  showTags?: boolean;
}) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-[border-color,transform] duration-200 ease-out-soft hover:border-line-strong focus-within:border-accent-line">
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-sunken">
        {meme.thumb_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meme.thumb_url}
            alt={`Mídia principal do meme ${meme.name}`}
            width={480}
            height={300}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className="size-full object-cover transition-transform duration-300 ease-out-soft group-hover:scale-[1.015]"
          />
        ) : (
          <div className="grid size-full place-items-center text-ink-4" aria-hidden>
            <Icons.media size={28} />
          </div>
        )}
        {meme.featured ? (
          <span className="absolute left-2 top-2">
            <Badge
              tone="accent"
              icon={<Icons.star size={11} weight="fill" aria-hidden />}
              className="backdrop-blur-sm"
            >
              Destaque
            </Badge>
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {meme.category_name ? (
            <Badge tone="outline" icon={<Icons.category size={11} aria-hidden />}>
              {meme.category_name}
            </Badge>
          ) : null}
          {meme.verified ? (
            <Badge
              tone="info"
              icon={<Icons.verified size={11} weight="fill" aria-hidden />}
              title="Informação revisada pela administração"
            >
              Verificado
            </Badge>
          ) : null}
          {meme.approx_year ? <Badge tone="neutral">{meme.approx_year}</Badge> : null}
        </div>

        <h3 className="text-[0.9375rem] font-semibold leading-snug tracking-tight text-ink">
          <Link href={`/meme/${meme.slug}`} className="after:absolute after:inset-0 focus:outline-none">
            {meme.name}
          </Link>
        </h3>

        {meme.short_description ? (
          <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-3">{meme.short_description}</p>
        ) : null}

        {showTags && meme.tags.length ? (
          <ul className="flex flex-wrap gap-1.5 pt-0.5">
            {meme.tags.slice(0, 3).map((tag) => (
              <li
                key={tag}
                className="inline-flex items-center gap-0.5 text-[0.6875rem] text-ink-3"
              >
                <Icons.hash size={9} aria-hidden />
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft pt-2.5 text-[0.6875rem] text-ink-3">
          <span className="inline-flex items-center gap-1" title={`${meme.views_count} visualizações`}>
            <Icons.eye size={12} aria-hidden />
            {compactNumber(meme.views_count)}
          </span>
          <span className="inline-flex items-center gap-1" title={`${meme.versions_count} versões`}>
            <Icons.diff size={12} aria-hidden />
            {meme.versions_count}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icons.clock size={12} aria-hidden />
            <span className={cn("truncate")}>{relativeTime(meme.updated_at)}</span>
          </span>
          {meme.is_demo ? (
            <span className="ml-auto" title="Conteúdo de demonstração">
              <Icons.lightbulb size={12} aria-hidden />
              <span className="sr-only">Conteúdo de demonstração</span>
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function MemeCardGrid({
  memes,
  priorityCount = 3,
  showTags = false,
  columns = 3,
}: {
  memes: MemeListItem[];
  priorityCount?: number;
  showTags?: boolean;
  columns?: 2 | 3 | 4;
}) {
  const gridClass =
    columns === 2
      ? "grid gap-4 sm:grid-cols-2"
      : columns === 4
        ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={gridClass}>
      {memes.map((meme, i) => (
        <MemeCard key={meme.id} meme={meme} priority={i < priorityCount} showTags={showTags} />
      ))}
    </div>
  );
}

export function MemeListRow({ meme }: { meme: MemeListItem }) {
  return (
    <article className="group relative flex items-center gap-3 rounded-card border border-line bg-surface p-3 transition-colors duration-150 hover:border-line-strong">
      <span className="size-14 shrink-0 overflow-hidden rounded-control bg-sunken">
        {meme.thumb_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meme.thumb_url}
            alt=""
            width={56}
            height={56}
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[0.875rem] font-semibold text-ink">
          <Link href={`/meme/${meme.slug}`} className="after:absolute after:inset-0 focus:outline-none">
            {meme.name}
          </Link>
        </h3>
        <p className="line-clamp-1 text-[0.75rem] text-ink-3">{meme.short_description}</p>
      </div>
      <div className="hidden shrink-0 items-center gap-3 text-[0.6875rem] text-ink-3 sm:flex">
        {meme.category_name ? <span>{meme.category_name}</span> : null}
        <span className="inline-flex items-center gap-1 font-mono tabular">
          <Icons.eye size={11} aria-hidden />
          {compactNumber(meme.views_count)}
        </span>
      </div>
    </article>
  );
}
