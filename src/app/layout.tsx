import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { bootstrap } from "@/lib/bootstrap";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { THEME_BOOTSTRAP } from "@/components/ui-client";
import "./globals.css";

/**
 * Every page reads live data from SQLite, so nothing is prerendered at build
 * time. That keeps a freshly approved meme visible immediately.
 */
export const dynamic = "force-dynamic";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4310";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Memepedia — A enciclopédia livre dos memes da internet",
    template: "%s — Memepedia",
  },
  description:
    "Descubra a origem, o contexto e a história dos memes que marcaram a internet. Enciclopédia colaborativa, revisada por moderadores, com histórico completo de versões.",
  applicationName: "Memepedia",
  keywords: ["memes", "enciclopédia", "internet", "cultura digital", "origem de memes"],
  authors: [{ name: "Comunidade Memepedia" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Memepedia",
    title: "Memepedia — A enciclopédia livre dos memes da internet",
    description:
      "Origem, contexto e história dos memes que marcaram a internet. Contribua e ajude a preservar a cultura digital.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Memepedia",
    description: "A enciclopédia livre dos memes da internet.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f4" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1d22" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  bootstrap();
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning className={`${archivo.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-[100dvh] antialiased">
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo principal
        </a>
        <SiteHeader />
        <main id="conteudo" className="mx-auto min-h-[60dvh] w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
