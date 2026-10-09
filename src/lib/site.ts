const configuredSiteUrl =
  process.env.SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

export const siteUrl = new URL(
  configuredSiteUrl
    ? configuredSiteUrl.startsWith("http://") || configuredSiteUrl.startsWith("https://")
      ? configuredSiteUrl
      : `https://${configuredSiteUrl}`
    : "http://localhost:3000"
);
