import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le projet vit sous le dossier utilisateur : on ancre la racine Turbopack ici.
  turbopack: { root: __dirname },
  // Image Docker minimale : `.next/standalone` embarque le serveur et les
  // seules dépendances tracées, sans `node_modules` complet.
  output: "standalone",
  reactCompiler: true,
};

export default nextConfig;
