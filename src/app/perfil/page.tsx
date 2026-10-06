import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { updateProfileAction, changePasswordAction } from "@/app/actions/auth";
import { emptyAction, type ActionState } from "@/lib/forms";
import { Badge, Panel, PanelHeader } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { Icons } from "@/components/icons";
import { relativeTime } from "@/lib/format";
import { ProfileEditForm, PasswordForm } from "./profile-forms";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/entrar?proximo=/perfil");

  const profile = get<{ bio: string; location: string; website: string; contributions_total: number; approved_total: number; rejected_total: number }>(
    "SELECT bio, location, website, contributions_total, approved_total, rejected_total FROM profiles WHERE user_id = ?",
    user.id,
  );
  const pending = get<{ c: number }>("SELECT COUNT(*) AS c FROM contributions WHERE submitted_by = ? AND status = 'pending'", user.id)?.c ?? 0;

  const action = async (state: ActionState, form: FormData) => {
    "use server";
    return updateProfileAction(state, form);
  };
  const pwAction = async (state: ActionState, form: FormData) => {
    "use server";
    return changePasswordAction(state, form);
  };

  return (
    <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Meu perfil</h1>
        <Link href={`/perfil/${user.username}`} className="text-sm font-semibold text-accent underline underline-offset-2">
          Ver perfil público
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Contribuições enviadas", value: profile?.contributions_total ?? 0 },
          { label: "Aprovadas", value: profile?.approved_total ?? 0 },
          { label: "Pendentes agora", value: pending },
        ].map((tile) => (
          <Panel key={tile.label} className="p-4">
            <p className="font-mono text-2xl font-semibold tabular text-ink">{tile.value}</p>
            <p className="mt-0.5 text-[0.8125rem] text-ink-3">{tile.label}</p>
          </Panel>
        ))}
      </div>

      <Panel className="mt-6 p-0">
        <PanelHeader title="Dados públicos" description="Aparecem na sua página de perfil." icon={<Icons.user size={16} aria-hidden />} />
        <div className="px-5 py-5">
          <div className="mb-5 flex items-center gap-3">
            <Avatar name={user.displayName} src={user.avatarUrl} size={48} role={user.role} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{user.displayName}</p>
              <p className="text-[0.8125rem] text-ink-3">@{user.username}</p>
            </div>
            <Badge tone={user.role === "owner" ? "accent" : "neutral"}>{user.isOwner ? "OWNER" : user.role}</Badge>
          </div>
          <ProfileEditForm
            action={action}
            defaults={{
              display_name: user.displayName,
              bio: profile?.bio ?? "",
              location: profile?.location ?? "",
              website: profile?.website ?? "",
            }}
          />
        </div>
      </Panel>

      <Panel className="mt-6 p-0">
        <PanelHeader title="Senha" description="Alterar a senha encerra todas as outras sessões." icon={<Icons.lock size={16} aria-hidden />} />
        <div className="px-5 py-5">
          <PasswordForm action={pwAction} />
        </div>
      </Panel>
    </main>
  );
}
