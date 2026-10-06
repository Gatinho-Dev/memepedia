import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { listContributions } from "@/lib/moderation";
import { listMemesByIds } from "@/lib/memes";
import { ROLE_LABEL, type Role } from "@/lib/types";
import { Avatar, Badge, Panel, PanelHeader, StatusBadge } from "@/components/ui";
import { Icons } from "@/components/icons";
import { MemeCard } from "@/components/meme-card";
import { formatDate, relativeTime } from "@/lib/format";

interface Props {
  params: Promise<{ username: string }>;
}

async function loadProfile(username: string) {
  return get<{
    id: number;
    username: string;
    display_name: string;
    avatar_url: string | null;
    role: Role;
    status: string;
    bio: string;
    location: string;
    website: string;
    contributions_total: number;
    approved_total: number;
    rejected_total: number;
    created_at: string;
    last_seen_at: string | null;
  }>(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.role, u.status, u.created_at, u.last_seen_at,
            p.bio, p.location, p.website, p.contributions_total, p.approved_total, p.rejected_total
       FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE u.username = ?`,
    username,
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile) return { title: "Perfil não encontrado" };
  return {
    title: `${profile.display_name} (@${profile.username})`,
    description: profile.bio || `Perfil de ${profile.display_name} na Memepedia.`,
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const viewer = await currentUser();
  const profile = await loadProfile(username);
  if (!profile) notFound();
  if (profile.status === "banned" && viewer?.role !== "owner" && viewer?.role !== "admin") {
    return (
      <main id="conteudo" className="mx-auto w-full max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Perfil indisponível</h1>
        <p className="mt-2 text-sm text-ink-3">Esta conta não está mais ativa na Memepedia.</p>
        <Link href="/memes" className="mt-6 inline-block text-sm font-semibold text-accent underline underline-offset-2">
          Explorar memes
        </Link>
      </main>
    );
  }
  if (viewer && viewer.id === profile.id) redirect("/perfil");

  const isSelf = viewer?.id === profile.id;
  const isStaff = viewer && ["moderator", "admin", "owner"].includes(viewer.role);

  const contributions = listContributions({ userId: profile.id, limit: 10 });
  const approved = contributions.items.filter((c) => c.status === "approved");
  const approvedMemeIds = [...new Set(approved.map((c) => c.resulting_meme_id ?? c.meme_id).filter((v): v is number => v != null))];
  const approvedMemes = listMemesByIds(approvedMemeIds).slice(0, 6);
  void isSelf;

  return (
    <main id="conteudo" className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={profile.display_name} src={profile.avatar_url} size={72} role={profile.role} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{profile.display_name}</h1>
              <Badge tone={profile.role === "owner" ? "accent" : "neutral"}>{ROLE_LABEL[profile.role] ?? profile.role}</Badge>
              {profile.status !== "active" ? <StatusBadge status={profile.status} /> : null}
            </div>
            <p className="mt-0.5 text-sm text-ink-3">@{profile.username}</p>
            {profile.bio ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">{profile.bio}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-ink-3">
              {profile.location ? (
                <span className="inline-flex items-center gap-1">
                  <Icons.pin size={13} aria-hidden /> {profile.location}
                </span>
              ) : null}
              {profile.website ? (
                <a
                  href={profile.website}
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-accent underline underline-offset-2"
                >
                  <Icons.link size={13} aria-hidden /> {profile.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Icons.calendar size={13} aria-hidden /> desde {formatDate(profile.created_at)}
              </span>
              <span className="inline-flex items-center gap-1" title="Visto por último">
                <Icons.clock size={13} aria-hidden /> {relativeTime(profile.last_seen_at)}
              </span>
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Contribuições", value: profile.contributions_total },
          { label: "Aprovadas", value: profile.approved_total },
          { label: "Rejeitadas", value: profile.rejected_total },
        ].map((tile) => (
          <Panel key={tile.label} className="p-4">
            <p className="font-mono text-2xl font-semibold tabular text-ink">{tile.value}</p>
            <p className="mt-0.5 text-[0.8125rem] text-ink-3">{tile.label}</p>
          </Panel>
        ))}
        <Panel className="p-4">
          <p className="font-mono text-2xl font-semibold tabular text-ink">
            {profile.contributions_total
              ? `${Math.round((profile.approved_total / profile.contributions_total) * 100)}%`
              : "—"}
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-3">Taxa de aprovação</p>
        </Panel>
      </div>

      {approvedMemes.length ? (
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">Memes que ajudou a construir</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {approvedMemes.map((meme) => (
              <MemeCard key={meme.id} meme={meme} />
            ))}
          </div>
        </section>
      ) : null}

      <Panel className="mt-8 p-0">
        <PanelHeader
          title="Contribuições recentes"
          description={isStaff ? "Visível para a equipe; usuários veem apenas um resumo." : "Últimas contribuições públicas."}
          icon={<Icons.history size={16} aria-hidden />}
        />
        <ul className="flex flex-col">
          {contributions.items.length === 0 ? (
            <li className="px-5 py-6 text-center text-sm text-ink-3">Nenhuma contribuição ainda.</li>
          ) : (
            contributions.items.slice(0, isStaff ? 10 : 5).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft px-5 py-3 text-sm last:border-b-0">
                <StatusBadge status={c.status} />
                <span className="min-w-0 flex-1 truncate text-ink-2">{c.title}</span>
                <span className="text-[0.75rem] text-ink-4">{relativeTime(c.created_at)}</span>
              </li>
            ))
          )}
        </ul>
      </Panel>
    </main>
  );
}
