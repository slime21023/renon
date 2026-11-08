import path from "node:path";
import pluginWebc from "@11ty/eleventy-plugin-webc";
import * as pagefind from "pagefind";
import { registerAsciidocExtension } from "./src/lib/asciidoc.js";
import { registerNavigation } from "./src/lib/navigation.js";
import { registerFilters } from "./src/lib/filters.js";

export default function (eleventyConfig) {
  // Ignore internal helper libraries inside src/lib/ from template processing
  eleventyConfig.ignores.add("src/lib/**");

  // 1. Register WebC plugin (includes @11ty/eleventy-plugin-bundle automatically)
  eleventyConfig.addPlugin(pluginWebc, {
    components: "src/_includes/components/**/*.webc"
  });

  // 2. Register custom AsciiDoc (.adoc) engine
  registerAsciidocExtension(eleventyConfig);

  // 3. Register structured navigation tree & template filters
  registerNavigation(eleventyConfig);
  registerFilters(eleventyConfig);

  // 4. Passthrough static assets & local vendor bundles (KaTeX + Mermaid)
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({
    "node_modules/katex/dist/katex.min.css": "assets/vendor/katex/katex.min.css",
    "node_modules/katex/dist/fonts": "assets/vendor/katex/fonts",
    "node_modules/mermaid/dist/mermaid.min.js": "assets/vendor/mermaid/mermaid.min.js"
  });

  // 5. Watch targets for live reload (disable followSymlinks for Windows/Bun stability)
  eleventyConfig.setChokidarConfig({
    followSymlinks: false
  });
  eleventyConfig.addWatchTarget("./src/assets/css");
  eleventyConfig.addWatchTarget("./src/lib");

  // 6. Build static search index with Pagefind after Eleventy finishes writing HTML
  eleventyConfig.on("eleventy.after", async ({ dir, results }) => {
    if (!results || results.length === 0) return;

    const outputDir = path.resolve(dir.output || "_site");
    try {
      const { index } = await pagefind.createIndex();
      if (index) {
        await index.addDirectory({ path: outputDir });
        await index.writeFiles({ outputPath: path.join(outputDir, "pagefind") });
        await pagefind.close();
      }
    } catch (err) {
      console.warn("[Renon] Pagefind indexing skipped or encountered an issue:", err?.message || err);
    }
  });

  // 7. Dev server configuration (bind strictly to localhost)
  eleventyConfig.setServerOptions({
    port: 8080,
    showAllHosts: false
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site"
    },
    htmlTemplateEngine: "webc",
    markdownTemplateEngine: "webc"
  };
}
