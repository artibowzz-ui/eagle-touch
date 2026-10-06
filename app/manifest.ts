import type { MetadataRoute } from "next";

/* Fiche d'installation : permet d'ajouter Eagle Touch à l'écran d'accueil du téléphone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eagle Touch",
    short_name: "Eagle Touch",
    description: "Vos compétitions de golf au Stableford, classées à la moyenne.",
    lang: "fr",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F2EE",
    theme_color: "#17402F",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
