import type { MetadataRoute } from "next";

/* Le site vitrine et les pages légales peuvent être indexés ; l'application elle-même non. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/version"] }],
    sitemap: "https://eagle-touch.vercel.app/sitemap.xml",
  };
}
