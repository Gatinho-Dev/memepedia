import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { Icons } from "@/components/icons";
import { buttonClass, Panel } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/types";

export const metadata = { title: "Permissão insuficiente" };

export default async function ForbiddenPage() {
  const user = await currentUser();
  return (
    <div className="mx-auto max-w-2xl py-12">
      <Panel className="p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-warn-soft text-ink" aria-hidden>
          <Icons.lock size={22} />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">Permissão insuficiente</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-3">
          {user ? (
            <>
              Sua conta tem o papel <strong className="text-ink">{ROLE_LABEL[user.role]}</strong>, que não inclui
              esta ação. Se você acredita que isso é um erro, fale com a administração da Memepedia.
            </>
          ) : (
            <>Você precisa entrar em uma conta com permissão para acessar esta área.</>
          )}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {user ? (
            <Link href="/" className={buttonClass("primary", "md")}>
              Voltar ao início
            </Link>
          ) : (
            <Link href="/entrar" className={buttonClass("primary", "md")}>
              <Icons.signIn size={16} aria-hidden />
              Entrar
            </Link>
          )}
          <Link href="/sobre" className={buttonClass("secondary", "md")}>
            Entender os papéis de usuário
          </Link>
        </div>
      </Panel>
    </div>
  );
}
