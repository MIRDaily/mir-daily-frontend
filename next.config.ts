import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Versión que viaja en los reportes de contenido: el commit que desplegó
  // Vercel (VERCEL_GIT_COMMIT_SHA solo existe allí; en local sale 'dev').
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? 'dev',
  },
  // /library/resources/[id] (17/10/2026): la página de «recursos» de la antigua Biblioteca se retiró. Leía
  // /api/library/resources/:id, con una sola fila de prueba en library_resources, y la Biblioteca nueva no la
  // enlaza. Un enlace guardado va a la Biblioteca (temporal: si un día vuelven los recursos, se quita).
  async redirects() {
    return [{ source: '/library/resources/:id*', destination: '/library', permanent: false }]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'piodbnhiwgntpjxbqqlw.supabase.co',
        pathname: '/storage/v1/object/public/avatars/**',
      },
    ],
  },
};

export default nextConfig;
