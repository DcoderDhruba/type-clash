import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl.toString(), changeFrequency: "weekly", priority: 1 },
    { url: new URL("/leaderboard", siteUrl).toString(), changeFrequency: "daily", priority: 0.8 },
    { url: new URL("/challenge", siteUrl).toString(), changeFrequency: "monthly", priority: 0.6 },
  ];
}
