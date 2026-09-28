import type { Metadata, Viewport } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Eagle Touch, compétitions de golf au Stableford",
  description:
    "Créez votre compétition de golf, saisissez les scores trou par trou et suivez un classement à la moyenne Stableford.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f2ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1310" },
  ],
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className="font-sans antialiased">{children}</div>;
}
