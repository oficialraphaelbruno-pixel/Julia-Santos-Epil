import type { MetadataRoute } from "next";
import { DEFAULT_BUSINESS_SLUG, SITE_URL } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/agendar/${DEFAULT_BUSINESS_SLUG}`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/termos`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
