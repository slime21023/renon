export default {
  layout: "layouts/doc.webc",
  eleventyComputed: {
    permalink: (data) => {
      if (data.draft) {
        return false;
      }
      if (data.tagEntry?.slug) {
        return `/tags/${data.tagEntry.slug}/index.html`;
      }
      const stem = String(data.page?.filePathStem || "").replace(/^\/content/, "");
      if (stem.endsWith(".xml")) {
        return stem;
      }
      if (!stem || stem === "/index") {
        return "/index.html";
      }
      if (stem.endsWith("/index")) {
        return `${stem.slice(0, -6)}/index.html`;
      }
      return `${stem}/index.html`;
    }
  }
};
