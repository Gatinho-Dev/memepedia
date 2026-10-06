import { NextResponse } from "next/server";
import { all, count } from "@/lib/db";
import { bootstrap } from "@/lib/bootstrap";
import { compactNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Public, read-only snapshot of the encyclopedia. Deliberately exposes only
 * aggregate numbers plus slugs/names, never user data or draft content, so the
 * endpoint can stay open without a token.
 */
export async function GET(request: Request) {
  bootstrap();
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limite") ?? "20") || 20));

  const totals = {
    memes: count("SELECT COUNT(*) FROM memes WHERE status = 'published'"),
    categories: count("SELECT COUNT(*) FROM categories"),
    tags: count("SELECT COUNT(*) FROM tags"),
    versions: count("SELECT COUNT(*) FROM meme_versions"),
    viewsRecorded: count("SELECT COALESCE(SUM(count), 0) FROM views"),
    viewsToday: count("SELECT COALESCE(SUM(count), 0) FROM views WHERE day = date('now')"),
  };

  const top = all<{
    slug: string;
    name: string;
    short_description: string;
    views_count: number;
    versions_count: number;
    category_name: string | null;
    updated_at: string;
  }>(
    `SELECT m.slug, m.name, m.short_description, m.views_count, m.versions_count,
            c.name AS category_name, m.updated_at
       FROM memes m LEFT JOIN categories c ON c.id = m.category_id
      WHERE m.status = 'published'
      ORDER BY m.views_count DESC LIMIT ?`,
    limit,
  );

  const categories = all<{ slug: string; name: string; group_name: string; memes: number }>(
    `SELECT c.slug, c.name, c.group_name,
            (SELECT COUNT(*) FROM memes m WHERE m.category_id = c.id AND m.status = 'published') AS memes
       FROM categories c ORDER BY memes DESC, c.name LIMIT ?`,
    limit,
  );

  const tags = all<{ slug: string; name: string; memes: number }>(
    `SELECT t.slug, t.name,
            (SELECT COUNT(*) FROM meme_tags mt JOIN memes m ON m.id = mt.meme_id
              WHERE mt.tag_id = t.id AND m.status = 'published') AS memes
       FROM tags t
      ORDER BY memes DESC, t.name LIMIT ?`,
    limit,
  );

  const recent = all<{ slug: string; name: string; updated_at: string; versions_count: number }>(
    `SELECT slug, name, updated_at, versions_count FROM memes
      WHERE status = 'published' ORDER BY updated_at DESC LIMIT ?`,
    limit,
  );

  return NextResponse.json(
    {
      site: "Memepedia",
      description: "A enciclopédia livre dos memes da internet.",
      generatedAt: new Date().toISOString(),
      license: "Conteúdo colaborativo. Consulte a política de conteúdo em /politica-de-conteudo.",
      totals: {
        ...totals,
        viewsRecordedLabel: compactNumber(totals.viewsRecorded),
      },
      mostViewed: top,
      categories,
      tags,
      recentlyUpdated: recent,
      endpoints: {
        readme: "/sobre",
        policy: "/politica-de-conteudo",
        random: "/aleatorio",
      },
    },
    {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=600",
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}
