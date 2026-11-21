import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    agentFeedback: false,
    serverActions: {
      // Un archivo de 10 MB más el resto del formulario.
      bodySizeLimit: "11mb",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Fotos de perfil de Google y GitHub (ver lib/auth/avatar.ts).
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV === "production"),
      },
    ];
  },
  async redirects() {
    return [
      // No hay página índice de servicios: se manda a la sección de la home.
      { source: "/servicios", destination: "/#servicios", permanent: false },
      // No hay página índice de cuenta: se manda al login.
      { source: "/cuenta", destination: "/cuenta/login", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
