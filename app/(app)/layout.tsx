import type { Metadata, Viewport } from "next";
import "@/lib/eagle/eagle.css";

export const metadata: Metadata = {
  title: "Eagle Touch",
  description: "Vos compétitions de golf au Stableford, classées à la moyenne.",
  robots: { index: false },
  appleWebApp: { capable: true, title: "Eagle Touch", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#17402f" },
    { media: "(prefers-color-scheme: dark)", color: "#0f2a1f" },
  ],
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
