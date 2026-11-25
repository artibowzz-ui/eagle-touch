import type { MetadataRoute } from "next";

const BASE = "https://eagle-touch.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/confidentialite", "/conditions", "/licences"].map((p) => ({
    url: BASE + p,
    changeFrequency: p ? "yearly" : "monthly",
    priority: p ? 0.3 : 1,
  }));
}
