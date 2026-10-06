import type { MetadataRoute } from "next";
import { all } from "@/lib/db";
import { bootstrap } from "@/lib/bootstrap";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4310").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  bootstrap();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/memes`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/populares`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/recentes`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/categorias`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/tags`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/sobre`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/contribuir`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/politica-de-conteudo`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/codigo-de-conduta`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const memes = all<{ slug: string; updated_at: string }>(
    "SELECT slug, updated_at FROM memes WHERE status = 'published' ORDER BY updated_at DESC LIMIT 5000",
  ).map((row) => ({
    url: `${SITE_URL}/meme/${row.slug}`,
    lastModified: new Date(row.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const categories = all<{ slug: string }>("SELECT slug FROM categories").map((row) => ({
    url: `${SITE_URL}/categoria/${row.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  const tags = all<{ slug: string }>(
    `SELECT DISTINCT t.slug FROM tags t
       JOIN meme_tags mt ON mt.tag_id = t.id
       JOIN memes m ON m.id = mt.meme_id AND m.status = 'published'
      ORDER BY t.use_count DESC LIMIT 500`,
  ).map((row) => ({
    url: `${SITE_URL}/tags/${row.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.4,
  }));

  return [...staticRoutes, ...categories, ...memes, ...tags];
}
