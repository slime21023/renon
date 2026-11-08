import path from "node:path";
import fs from "node:fs";
import Asciidoctor from "@asciidoctor/core";
import hljs from "highlight.js";
import katex from "katex";
import siteConfig from "../_data/site.js";

const asciidoctor = Asciidoctor();

const CALLOUT_ICONS = {
  note: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  tip: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.6 1 1.4 1 2.3h6c0-.9.4-1.7 1-2.3A7 7 0 0 0 12 2z"/></svg>`,
  important: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  caution: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
};

const CALLOUT_LABELS = {
  note: "提示 (Note)",
  tip: "技巧 (Tip)",
  important: "重要 (Important)",
  warning: "警告 (Warning)",
  caution: "注意 (Caution)"
};

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html) {
  return String(html ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Parses highlight line specification such as "2,4-6" or "1..3;7" into a Set of 1-based line numbers.
 */
function parseHighlightRanges(spec) {
  const set = new Set();
  if (!spec) return set;

  const parts = String(spec)
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*(?:-|\.\.)\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number.parseInt(rangeMatch[1], 10);
      const end = Number.parseInt(rangeMatch[2], 10);
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      for (let i = lo; i <= hi; i++) {
        set.add(i);
      }
    } else {
      const num = Number.parseInt(part, 10);
      if (Number.isFinite(num) && num > 0) {
        set.add(num);
      }
    }
  }

  return set;
}

/**
 * Wraps each line of syntax-highlighted HTML in <span class="re-code-line">
 * while preserving balanced <span class="hljs-*"> tags across line breaks.
 */
function wrapCodeLines(highlightedHtml, hasLineNums, highlightSet) {
  if (!hasLineNums && (!highlightSet || highlightSet.size === 0)) {
    return highlightedHtml;
  }

  const rawLines = String(highlightedHtml).split("\n");
  const openTags = [];

  return rawLines
    .map((rawLine, idx) => {
      const lineNum = idx + 1;
      const isHighlighted = highlightSet && highlightSet.has(lineNum);
      const prefix = openTags.join("");

      const tagRegex = /<\/?span[^>]*>/g;
      let match;
      while ((match = tagRegex.exec(rawLine)) !== null) {
        if (match[0].startsWith("</")) {
          openTags.pop();
        } else if (!match[0].endsWith("/>")) {
          openTags.push(match[0]);
        }
      }

      const suffix = openTags.map(() => "</span>").join("");
      const hlClass = isHighlighted ? " is-highlighted" : "";
      const numAttr = hasLineNums ? ` data-line="${lineNum}"` : "";
      const inner = `${prefix}${rawLine}${suffix}`;

      return `<span class="re-code-line${hlClass}"${numAttr}>${inner || " "}</span>`;
    })
    .join("\n");
}

let tabsInstanceCounter = 0;

/**
 * Custom HTML5 Converter for Renon:
 * - Admonitions -> <aside class="re-callout">
 * - Source / Listing -> highlight.js + line numbers + line highlight + copy button + Mermaid diagrams
 * - Dlist [role="tabs"] -> Accessible interactive <div class="re-tabs">
 * - Stem & inline latexmath -> Build-time KaTeX HTML + MathML
 * - Image -> <figure class="re-figure"> with Lightbox zoom trigger
 * - Section -> Heading with '#' anchor link
 */
class RenonHtml5Converter {
  constructor() {
    this.baseConverter = asciidoctor.Html5Converter.create();
  }

  convert(node, transform) {
    const nodeName = transform || node.getNodeName();

    if (nodeName === "admonition") {
      return this.convertAdmonition(node);
    }

    if (nodeName === "listing" || nodeName === "literal") {
      return this.convertListing(node, nodeName);
    }

    if (nodeName === "dlist") {
      return this.convertDlist(node);
    }

    if (nodeName === "stem") {
      return this.convertStem(node);
    }

    if (nodeName === "inline_quoted") {
      return this.convertInlineQuoted(node);
    }

    if (nodeName === "image") {
      return this.convertImage(node);
    }

    if (nodeName === "section") {
      return this.convertSection(node);
    }

    return this.baseConverter.convert(node, transform);
  }

  convertAdmonition(node) {
    const rawVariant = String(node.getAttribute("name") || "note").toLowerCase();
    const variant = CALLOUT_ICONS[rawVariant] ? rawVariant : "note";
    const customTitle = node.getTitle();
    const defaultLabel = CALLOUT_LABELS[variant] || node.getCaption() || variant.toUpperCase();
    const headerTitle = customTitle ? customTitle : escapeHtml(defaultLabel);
    const iconSvg = CALLOUT_ICONS[variant];
    const content = node.getContent();

    return `<aside class="re-callout" data-variant="${escapeHtml(variant)}" role="note">
  <div class="re-callout__header">
    <span class="re-callout__icon" aria-hidden="true">${iconSvg}</span>
    <strong class="re-callout__title">${headerTitle}</strong>
  </div>
  <div class="re-callout__body">
    ${content}
  </div>
</aside>`;
  }

  convertListing(node, nodeName) {
    const style = String(node.getStyle() || "").toLowerCase();
    const rawLang = String(
      node.getAttribute("language") || (style === "mermaid" ? "mermaid" : "text")
    ).toLowerCase();
    const title = node.getTitle();
    const rawSource =
      typeof node.getSource === "function" ? node.getSource() : stripHtml(node.getContent());

    // A3: Mermaid diagram block ([mermaid] or [source,mermaid])
    if (style === "mermaid" || rawLang === "mermaid" || (node.hasRole && node.hasRole("mermaid"))) {
      const captionHtml = title ? `<figcaption class="re-mermaid__caption">${title}</figcaption>` : "";
      const ariaLabel = stripHtml(title || "Mermaid 流程架構圖");
      return `<figure class="re-mermaid" data-mermaid-block>
  <pre class="re-mermaid__source">${escapeHtml(rawSource)}</pre>
  <div class="re-mermaid__stage" role="img" aria-label="${escapeHtml(ariaLabel)}"></div>
  ${captionHtml}
</figure>`;
    }

    if (nodeName === "literal" && style !== "source") {
      return this.baseConverter.convert(node, nodeName);
    }

    // A1: Line numbers & highlighted lines
    const hasLineNums =
      (typeof node.isOption === "function" && node.isOption("linenums")) ||
      node.getAttribute("linenums") !== undefined;
    const highlightSpec = node.getAttribute("highlight") || "";
    const highlightSet = parseHighlightRanges(highlightSpec);
    const hasStructuredLines = hasLineNums || highlightSet.size > 0;

    const validLang = hljs.getLanguage(rawLang) ? rawLang : "plaintext";
    const highlighted =
      validLang !== "plaintext"
        ? hljs.highlight(rawSource, { language: validLang, ignoreIllegals: true }).value
        : escapeHtml(rawSource);

    const finalCodeHtml = wrapCodeLines(highlighted, hasLineNums, highlightSet);

    const displayLang =
      rawLang === "text" || rawLang === "plaintext" ? "TEXT" : rawLang.toUpperCase();
    const titleHtml = title ? `<span class="re-codeblock__title">${title}</span>` : "";
    const lineClass = hasStructuredLines ? " has-lines" : "";
    const lineNumClass = hasLineNums ? " has-linenums" : "";

    return `<div class="re-codeblock${lineClass}${lineNumClass}" data-lang="${escapeHtml(rawLang)}">
  <div class="re-codeblock__header">
    <div class="re-codeblock__meta">
      ${titleHtml}
      <span class="re-codeblock__lang">${escapeHtml(displayLang)}</span>
    </div>
    <button type="button" class="re-codeblock__copy" aria-label="複製程式碼" data-copy-code>
      <span class="re-codeblock__copy-label">複製</span>
    </button>
  </div>
  <pre class="re-codeblock__pre"><code class="hljs language-${escapeHtml(validLang)}">${finalCodeHtml}</code></pre>
</div>`;
  }

  convertDlist(node) {
    const roleAttr = String(node.getAttribute("role") || "");
    const isTabs =
      (typeof node.hasRole === "function" && node.hasRole("tabs")) ||
      node.getStyle() === "tabs" ||
      roleAttr.split(/\s+/).includes("tabs");

    if (!isTabs) {
      return this.baseConverter.convert(node, "dlist");
    }

    const items = node.getItems() || [];
    if (items.length === 0) {
      return "";
    }

    tabsInstanceCounter += 1;
    const groupId = `re-tabs-${tabsInstanceCounter}`;
    const syncGroup = node.getAttribute("sync-group") || node.getAttribute("sync-key") || "";
    const syncAttr = syncGroup ? ` data-sync-group="${escapeHtml(syncGroup)}"` : "";

    const tabButtons = [];
    const tabPanels = [];

    items.forEach((pair, idx) => {
      const [terms, desc] = pair;
      const termList = Array.isArray(terms) ? terms : [terms];
      const rawLabel = termList
        .filter(Boolean)
        .map((t) => (typeof t.getText === "function" ? t.getText() : String(t)))
        .join(", ");
      const plainLabel = stripHtml(rawLabel) || `Tab ${idx + 1}`;
      const tabValue = plainLabel.toLowerCase().replace(/\s+/g, "-");
      const tabId = `${groupId}-tab-${idx}`;
      const panelId = `${groupId}-panel-${idx}`;
      const isSelected = idx === 0;

      tabButtons.push(
        `<button type="button" class="re-tabs__tab${isSelected ? " is-active" : ""}" role="tab" id="${escapeHtml(tabId)}" aria-selected="${isSelected}" aria-controls="${escapeHtml(panelId)}" tabindex="${isSelected ? "0" : "-1"}" data-tab-value="${escapeHtml(tabValue)}" data-tab-index="${idx}">${rawLabel}</button>`
      );

      const descContent = desc && typeof desc.getContent === "function" ? desc.getContent() : "";
      tabPanels.push(
        `<div class="re-tabs__panel${isSelected ? " is-active" : ""}" role="tabpanel" id="${escapeHtml(panelId)}" aria-labelledby="${escapeHtml(tabId)}"${isSelected ? "" : " hidden"} data-tab-panel="${idx}">${descContent}</div>`
      );
    });

    return `<div class="re-tabs" data-tabs${syncAttr}>
  <div class="re-tabs__header" role="tablist">
    ${tabButtons.join("\n    ")}
  </div>
  <div class="re-tabs__body">
    ${tabPanels.join("\n    ")}
  </div>
</div>`;
  }

  convertStem(node) {
    const rawTex =
      typeof node.getSource === "function" ? node.getSource() : stripHtml(node.getContent());
    const title = node.getTitle();
    const titleHtml = title ? `<div class="re-math-block__title">${title}</div>` : "";

    let rendered = "";
    try {
      rendered = katex.renderToString(rawTex, {
        displayMode: true,
        throwOnError: false,
        output: "htmlAndMathml"
      });
    } catch {
      rendered = `<code>${escapeHtml(rawTex)}</code>`;
    }

    return `<div class="re-math-block">
  ${titleHtml}
  <div class="re-math-block__content">${rendered}</div>
</div>`;
  }

  convertInlineQuoted(node) {
    const quoteType = node.getType();
    if (quoteType === "latexmath" || quoteType === "asciimath" || quoteType === "stem") {
      const rawTex = stripHtml(node.getText());
      try {
        const rendered = katex.renderToString(rawTex, {
          displayMode: false,
          throwOnError: false,
          output: "htmlAndMathml"
        });
        return `<span class="re-math-inline">${rendered}</span>`;
      } catch {
        return `<code>${escapeHtml(rawTex)}</code>`;
      }
    }
    return this.baseConverter.convert(node, "inline_quoted");
  }

  convertImage(node) {
    const target = node.getAttribute("target") || "";
    const src = typeof node.getImageUri === "function" ? node.getImageUri(target) : target;
    const rawTitle = node.getCaptionedTitle ? node.getCaptionedTitle() : node.getTitle();
    const alt = node.getAttribute("alt") || stripHtml(rawTitle || path.basename(target));
    const width = node.getAttribute("width");
    const height = node.getAttribute("height");

    const widthAttr = width ? ` width="${escapeHtml(width)}"` : "";
    const heightAttr = height ? ` height="${escapeHtml(height)}"` : "";
    const captionText = stripHtml(rawTitle || alt);
    const captionHtml = rawTitle
      ? `<figcaption class="re-figure__caption">${rawTitle}</figcaption>`
      : "";

    return `<figure class="re-figure">
  <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${widthAttr}${heightAttr} decoding="async" class="re-figure__img" data-lightbox-src="${escapeHtml(src)}" data-lightbox-alt="${escapeHtml(alt)}" data-lightbox-caption="${escapeHtml(captionText)}" tabindex="0" role="button" aria-label="點擊放大檢視圖片：${escapeHtml(alt)}" />
  ${captionHtml}
</figure>`;
  }

  convertSection(node) {
    const level = node.getLevel() + 1;
    const tag = `h${Math.min(Math.max(level, 2), 6)}`;
    const id = node.getId();
    const title = node.getCaptionedTitle ? node.getCaptionedTitle() : node.getTitle();
    const content = node.getContent();
    const sectClass = `sect${node.getLevel()}`;

    const anchorHtml = id
      ? `<a class="re-heading-anchor" href="#${escapeHtml(id)}" aria-label="前往此章節">#</a>`
      : "";
    const idAttr = id ? ` id="${escapeHtml(id)}"` : "";

    return `<section class="re-section ${escapeHtml(sectClass)}">
  <${tag}${idAttr} class="re-heading">
    <span class="re-heading__text">${title}</span>
    ${anchorHtml}
  </${tag}>
  <div class="sectionbody">
    ${content}
  </div>
</section>`;
  }
}

asciidoctor.ConverterFactory.register(new RenonHtml5Converter(), ["html5"]);

/**
 * Recursively extracts section hierarchy for right-hand TOC (<re-toc>).
 */
function extractToc(sectionNode, maxDepth = 3) {
  if (!sectionNode || typeof sectionNode.getSections !== "function") {
    return [];
  }

  const sections = sectionNode.getSections() || [];
  const items = [];

  for (const sec of sections) {
    const headingLevel = sec.getLevel() + 1; // level 1 in Asciidoctor is <h2>
    if (headingLevel > maxDepth) {
      continue;
    }
    const id = sec.getId();
    const rawTitle = sec.getTitle();
    if (!id || !rawTitle) {
      continue;
    }
    items.push({
      id: String(id),
      title: stripHtml(rawTitle),
      level: headingLevel,
      children: extractToc(sec, maxDepth)
    });
  }

  return items;
}

/**
 * Scans AsciiDoc source for include::target[] directives within the workspace boundary
 * so Eleventy's watch mode tracks included partials.
 */
function extractIncludeDependencies(inputPath, workspaceRoot) {
  const dependencies = [];
  if (!fs.existsSync(inputPath)) {
    return dependencies;
  }

  const rawContent = fs.readFileSync(inputPath, "utf-8");
  const baseDir = path.dirname(path.resolve(inputPath));
  const safeRoot = path.resolve(workspaceRoot) + path.sep;
  const includeRegex = /^include::([^\[\r\n]+)\[/gm;

  let match;
  while ((match = includeRegex.exec(rawContent)) !== null) {
    const rawTarget = match[1].trim();
    if (!rawTarget || rawTarget.includes("{")) {
      continue;
    }
    const resolvedTarget = path.resolve(baseDir, rawTarget);
    if (resolvedTarget.startsWith(safeRoot) && fs.existsSync(resolvedTarget)) {
      dependencies.push(resolvedTarget);
    }
  }

  return dependencies;
}

function getAsciidoctorOptions(inputPath) {
  const baseDir = path.dirname(path.resolve(inputPath));
  return {
    safe: "unsafe",
    base_dir: baseDir,
    standalone: false,
    attributes: {
      "source-highlighter": "highlight.js",
      experimental: "",
      icons: "font",
      sectids: true,
      sectanchors: false,
      idprefix: "",
      idseparator: "-",
      "toc!": "" // Disable inline Asciidoctor TOC; rendered separately by <re-toc>
    }
  };
}

/**
 * Registers the .adoc template extension in Eleventy v3.
 */
export function registerAsciidocExtension(eleventyConfig) {
  const workspaceRoot = process.cwd();

  eleventyConfig.addTemplateFormats("adoc");

  eleventyConfig.addExtension("adoc", {
    read: true,

    getData(inputPath) {
      const doc = asciidoctor.loadFile(inputPath, getAsciidoctorOptions(inputPath));
      const attrs = doc.getAttributes();
      const rawFileContent = fs.existsSync(inputPath) ? fs.readFileSync(inputPath, "utf-8") : "";

      const rawTitle = doc.getDocumentTitle();
      const title = rawTitle ? stripHtml(rawTitle) : path.basename(inputPath, ".adoc");
      const navTitle = attrs["nav-title"] ? stripHtml(attrs["nav-title"]) : title;
      const parsedOrder = Number.parseFloat(attrs["nav-order"]);
      const navOrder = Number.isFinite(parsedOrder) ? parsedOrder : 999;
      const description = attrs["description"] ? stripHtml(attrs["description"]) : "";
      const category = attrs["category"] ? stripHtml(attrs["category"]) : "";

      const rawTags = attrs["page-tags"] || attrs["tags"] || "";
      const tags = rawTags
        ? String(rawTags)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      const isDraft =
        attrs["draft"] === "true" ||
        attrs["draft"] === "" ||
        attrs["page-draft"] === "true";

      const pageLayout = attrs["page-layout"] || attrs["layout"] || undefined;
      const tocDisabled =
        siteConfig?.toc?.enabled === false ||
        attrs["toc"] === "false" ||
        attrs["page-toc"] === "false";
      const parsedTocLevels = Number.parseInt(
        attrs["toclevels"] || attrs["page-toclevels"],
        10
      );
      const defaultMaxLevel = Number.isFinite(siteConfig?.toc?.maxLevel)
        ? siteConfig.toc.maxLevel
        : 3;
      const maxTocLevel = Number.isFinite(parsedTocLevels)
        ? Math.min(Math.max(parsedTocLevels, 2), 5)
        : defaultMaxLevel;
      const toc = tocDisabled ? [] : extractToc(doc, maxTocLevel);

      // Per-page feature overrides (undefined means inherit from site.features)
      const parseBoolOverride = (val) => {
        if (val === "false") return false;
        if (val === "true" || val === "") return true;
        return undefined;
      };
      const pageBreadcrumbs = parseBoolOverride(attrs["page-breadcrumbs"]);
      const pageReadingTime = parseBoolOverride(attrs["page-reading-time"]);
      const pageEditLink = parseBoolOverride(attrs["page-edit-link"]);
      const pageLastUpdated = parseBoolOverride(attrs["page-last-updated"]);
      const pagePrevNext = parseBoolOverride(attrs["page-prev-next"]);

      // C1: Last updated date & edit relative path
      let lastUpdated = attrs["revdate"] || attrs["page-date"] || null;
      if (!lastUpdated && fs.existsSync(inputPath)) {
        lastUpdated = fs.statSync(inputPath).mtime.toISOString();
      }
      const editPath = path
        .relative(workspaceRoot, path.resolve(inputPath))
        .replace(/\\/g, "/");

      // A3 & A4: Detect Math (KaTeX) & Mermaid usage to conditionally load assets
      const hasMath =
        attrs["stem"] !== undefined ||
        /(\[stem\]|\[latexmath\]|stem:\[|latexmath:\[)/.test(rawFileContent);
      const hasMermaid = /(\[mermaid\]|\[source\s*,\s*mermaid\])/.test(rawFileContent);

      const data = {
        title,
        navTitle,
        navOrder,
        description,
        category,
        tags,
        toc,
        lastUpdated,
        editPath,
        hasMath,
        hasMermaid,
        pageBreadcrumbs,
        pageReadingTime,
        pageEditLink,
        pageLastUpdated,
        pagePrevNext,
        asciidocAttributes: attrs
      };

      if (pageLayout) {
        data.layout = pageLayout;
      }

      if (isDraft) {
        data.draft = true;
        data.eleventyExcludeFromCollections = true;
      }

      return data;
    },

    compile(inputContent, inputPath) {
      const includedDeps = extractIncludeDependencies(inputPath, workspaceRoot);
      if (includedDeps.length > 0 && typeof this.addDependencies === "function") {
        this.addDependencies(inputPath, includedDeps);
      }

      return () => {
        const doc = asciidoctor.load(inputContent, getAsciidoctorOptions(inputPath));
        return doc.convert();
      };
    }
  });
}
