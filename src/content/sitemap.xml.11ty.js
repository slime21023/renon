function escapeXml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default class SitemapTemplate {
  data() {
    return {
      permalink: "/sitemap.xml",
      layout: false,
      eleventyExcludeFromCollections: true
    };
  }

  render(data) {
    const baseUrl = String(data.site?.url || "http://localhost:8080").replace(/\/$/, "");
    const items = (data.collections?.all || []).filter(
      (item) => item.url && !item.data?.draft && item.url !== "/sitemap.xml" && item.url !== "/feed.xml"
    );

    const urlsXml = items
      .map((item) => {
        const loc = `${baseUrl}${item.url}`;
        const rawDate = item.data?.lastUpdated || item.date;
        const lastmod = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
        return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
  </url>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;
  }
}
