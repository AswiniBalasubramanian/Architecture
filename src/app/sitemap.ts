import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE.url}/about`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/llms.txt`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
