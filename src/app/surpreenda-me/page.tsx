import { redirect } from "next/navigation";
import { pluck } from "@/lib/db";

/**
 * "Surpreenda-me": a fresh draw that skips the ten most accessed pages, so the
 * result is genuinely less likely to be something the reader already knows.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Surpreenda-me" };

export default async function SurprisePage() {
  const slug = pluck<string>(
    `SELECT slug FROM memes
      WHERE status = 'published'
        AND id NOT IN (SELECT id FROM memes WHERE status = 'published' ORDER BY views_count DESC LIMIT 10)
      ORDER BY RANDOM() LIMIT 1`,
  );
  const fallback = pluck<string>("SELECT slug FROM memes WHERE status = 'published' ORDER BY RANDOM() LIMIT 1");
  const chosen = slug ?? fallback;
  redirect(chosen ? `/meme/${chosen}` : "/memes");
}
