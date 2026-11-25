import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

/* Valeurs par défaut de toutes les pages (y compris « page introuvable ») ; chaque page peut les préciser. */
export const metadata: Metadata = {
  metadataBase: new URL("https://eagle-touch.vercel.app"),
  title: "Eagle Touch",
  description: "Compétitions de golf entre amis au Stableford, classées à la moyenne.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
