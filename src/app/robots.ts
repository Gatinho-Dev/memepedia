import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4310").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/entrar",
          "/registrar",
          "/recuperar-senha",
          "/perfil/",
          "/contribuicoes",
          "/contribuir/novo",
          "/favoritos",
          "/notificacoes",
          "/denunciar",
          "/historico/",
          "/meme/*/editar",
          "/meme/*/sugerir",
          "/buscar",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
