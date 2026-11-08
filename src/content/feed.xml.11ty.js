function escapeXml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default class AtomFeedTemplate {
  data() {
    return {
      permalink: "/feed.xml",
      layout: false,
      eleventyExcludeFromCollections: true
    };
  }

  render(data) {
    const site = data.site || {};
    const baseUrl = String(site.url || "http://localhost:8080").replace(/\/$/, "");
    const docs = (data.collections?.all || []).filter((item) => {
      const inputPath = String(item.inputPath || "").replace(/\\/g, "/");
      return inputPath.includes("/src/content/") && inputPath.endsWith(".adoc") && !item.data?.draft && item.url;
    });

    const updated = new Date().toISOString();

    const entriesXml = docs
      .map((item) => {
        const url = `${baseUrl}${item.url}`;
        const title = item.data?.title || "未命名文件";
        const summary = item.data?.description || "";
        const itemDate = item.data?.lastUpdated
          ? new Date(item.data.lastUpdated).toISOString()
          : new Date(item.date || Date.now()).toISOString();

        return `  <entry>
    <title>${escapeXml(title)}</title>
    <link href="${escapeXml(url)}" />
    <id>${escapeXml(url)}</id>
    <updated>${escapeXml(itemDate)}</updated>
    <summary>${escapeXml(summary)}</summary>
  </entry>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(site.title || "Renon")}</title>
  <subtitle>${escapeXml(site.tagline || "")}</subtitle>
  <link href="${escapeXml(baseUrl)}/feed.xml" rel="self" />
  <link href="${escapeXml(baseUrl)}/" />
  <updated>${escapeXml(updated)}</updated>
  <id>${escapeXml(baseUrl)}/</id>
  <author>
    <name>${escapeXml(site.author || site.title || "Renon")}</name>
  </author>
${entriesXml}
</feed>`;
  }
}
