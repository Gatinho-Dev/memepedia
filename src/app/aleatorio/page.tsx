import { redirect } from "next/navigation";
import { randomMemeSlug } from "@/lib/memes";

/**
 * Random page: a server-side redirect keeps the button honest (each click is a
 * fresh draw) and prevents one result from being cached for everyone.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Meme aleatório" };

export default async function RandomPage() {
  const slug = randomMemeSlug();
  redirect(slug ? `/meme/${slug}` : "/memes");
}
