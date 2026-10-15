import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/login", "/signup", "/invites", "/race/"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
