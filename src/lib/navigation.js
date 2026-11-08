/**
 * Structured Documentation Navigation Engine & Tag Aggregation for Renon.
 * Builds a multi-level sidebar tree, breadcrumbs, prev/next pagination,
 * and tag index collections from Eleventy's collections.
 */

function normalizeUrl(url) {
  if (!url) return "/";
  const cleaned = String(url).replace(/\/+/g, "/");
  if (cleaned === "/") return "/";
  return cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
}

function getSegments(url) {
  const norm = normalizeUrl(url);
  if (norm === "/") return [];
  return norm.split("/").filter(Boolean);
}

function sortNodes(nodes) {
  nodes.sort((a, b) => {
    if (a.isRoot && !b.isRoot) return -1;
    if (!a.isRoot && b.isRoot) return 1;
    const orderA = Number.isFinite(a.navOrder) ? a.navOrder : 999;
    const orderB = Number.isFinite(b.navOrder) ? b.navOrder : 999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return String(a.title || "").localeCompare(String(b.title || ""), "zh-Hant");
  });

  for (const node of nodes) {
    if (Array.isArray(node.children) && node.children.length > 0) {
      sortNodes(node.children);
    }
  }

  return nodes;
}

const EXCLUDED_DOC_URLS = new Set(["/tags/", "/sitemap.xml", "/feed.xml"]);

/**
 * Builds a hierarchical navigation tree from all documentation pages under src/content/.
 */
export function buildDocsTree(collectionAll = []) {
  const docItems = collectionAll.filter((item) => {
    const inputPath = String(item.inputPath || "").replace(/\\/g, "/");
    if (!inputPath.includes("/src/content/") || !inputPath.endsWith(".adoc")) {
      return false;
    }
    if (item.data?.draft || !item.url) {
      return false;
    }
    return !EXCLUDED_DOC_URLS.has(item.url);
  });

  const rootNodes = [];
  const segmentMap = new Map();

  function getOrCreateNode(segments) {
    const key = segments.join("/");
    if (segmentMap.has(key)) {
      return segmentMap.get(key);
    }

    const slug = segments[segments.length - 1];
    const node = {
      key,
      slug,
      title: slug,
      fullTitle: slug,
      description: "",
      url: null,
      navOrder: 999,
      isRoot: false,
      children: []
    };
    segmentMap.set(key, node);

    if (segments.length === 1) {
      rootNodes.push(node);
    } else {
      const parentNode = getOrCreateNode(segments.slice(0, -1));
      parentNode.children.push(node);
    }

    return node;
  }

  for (const item of docItems) {
    const normUrl = normalizeUrl(item.url);
    const segments = getSegments(normUrl);
    const title = item.data?.navTitle || item.data?.title || "未命名文件";
    const fullTitle = item.data?.title || title;
    const description = item.data?.description || "";
    const navOrder = Number.isFinite(item.data?.navOrder) ? item.data.navOrder : 999;

    if (segments.length === 0) {
      rootNodes.push({
        key: "__root__",
        slug: "",
        title,
        fullTitle,
        description,
        url: "/",
        navOrder: Number.isFinite(item.data?.navOrder) ? item.data.navOrder : 0,
        isRoot: true,
        children: []
      });
      continue;
    }

    const node = getOrCreateNode(segments);
    node.title = title;
    node.fullTitle = fullTitle;
    node.description = description;
    node.url = normUrl;
    node.navOrder = navOrder;
  }

  return sortNodes(rootNodes);
}

/**
 * Builds the aggregated tag index collection (B1).
 */
export function buildTagList(collectionAll = []) {
  const tagMap = new Map();
  const reserved = new Set(["all", "docsTree", "tagList"]);

  for (const item of collectionAll) {
    const inputPath = String(item.inputPath || "").replace(/\\/g, "/");
    if (!inputPath.includes("/src/content/") || !inputPath.endsWith(".adoc")) {
      continue;
    }
    if (item.data?.draft || !item.url) {
      continue;
    }

    const rawTags = Array.isArray(item.data?.tags) ? item.data.tags : [];
    for (const rawTag of rawTags) {
      const tag = String(rawTag || "").trim();
      if (!tag || reserved.has(tag)) continue;

      if (!tagMap.has(tag)) {
        const slug = encodeURIComponent(tag.toLowerCase());
        tagMap.set(tag, {
          tag,
          slug,
          url: `/tags/${slug}/`,
          count: 0,
          items: []
        });
      }

      const entry = tagMap.get(tag);
      entry.count += 1;
      entry.items.push({
        title: item.data?.title || item.data?.navTitle || "未命名文件",
        navTitle: item.data?.navTitle || item.data?.title || "未命名文件",
        description: item.data?.description || "",
        url: normalizeUrl(item.url),
        lastUpdated: item.data?.lastUpdated || item.date,
        tags: rawTags.filter((t) => !reserved.has(t))
      });
    }
  }

  const list = Array.from(tagMap.values());
  list.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag, "zh-Hant");
  });

  return list;
}

/**
 * Checks whether a navigation node or any of its descendants matches currentUrl.
 */
export function isNodeActiveOrAncestor(node, currentUrl) {
  if (!node) return false;
  const target = normalizeUrl(currentUrl);
  if (node.url && normalizeUrl(node.url) === target) {
    return true;
  }
  if (Array.isArray(node.children)) {
    return node.children.some((child) => isNodeActiveOrAncestor(child, target));
  }
  return false;
}

/**
 * Flattens the navigation tree in depth-first reading order for prev/next pagination.
 */
export function flattenDocsTree(tree = [], parentSectionTitle = "") {
  const flat = [];

  for (const node of tree) {
    const currentSection =
      node.children && node.children.length > 0 ? node.title : parentSectionTitle;

    if (node.url) {
      flat.push({
        title: node.title,
        fullTitle: node.fullTitle || node.title,
        description: node.description || "",
        url: node.url,
        sectionTitle: parentSectionTitle || (node.isRoot ? "總覽" : "")
      });
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      flat.push(...flattenDocsTree(node.children, currentSection));
    }
  }

  return flat;
}

/**
 * Computes previous and next pages in the structured reading sequence.
 */
export function getPrevNext(tree = [], currentUrl = "/") {
  const flat = flattenDocsTree(tree);
  const target = normalizeUrl(currentUrl);
  const idx = flat.findIndex((item) => normalizeUrl(item.url) === target);

  if (idx === -1) {
    return { prev: null, next: null };
  }

  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null
  };
}

/**
 * Computes the breadcrumb trail from the root to currentUrl.
 */
export function getBreadcrumbs(tree = [], currentUrl = "/") {
  const target = normalizeUrl(currentUrl);
  const rootItem = tree.find((n) => n.isRoot);
  const rootCrumb = {
    title: rootItem ? rootItem.title : "首頁",
    url: "/"
  };

  if (target === "/") {
    return [rootCrumb];
  }

  if (target === "/tags/") {
    return [rootCrumb, { title: "標籤索引", url: "/tags/" }];
  }

  if (target.startsWith("/tags/")) {
    const tagSlug = decodeURIComponent(target.replace(/^\/tags\/|\/$/g, ""));
    return [
      rootCrumb,
      { title: "標籤索引", url: "/tags/" },
      { title: `#${tagSlug}`, url: target }
    ];
  }

  function findTrail(nodes, trail = []) {
    for (const node of nodes) {
      if (node.isRoot) continue;
      const nextTrail = [...trail, { title: node.title, url: node.url }];
      if (node.url && normalizeUrl(node.url) === target) {
        return nextTrail;
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        const found = findTrail(node.children, nextTrail);
        if (found) return found;
      }
    }
    return null;
  }

  const subTrail = findTrail(tree) || [];
  return [rootCrumb, ...subTrail];
}

export function registerNavigation(eleventyConfig) {
  eleventyConfig.addCollection("docsTree", (collectionApi) => {
    return buildDocsTree(collectionApi.getAll());
  });

  eleventyConfig.addCollection("tagList", (collectionApi) => {
    return buildTagList(collectionApi.getAll());
  });

  eleventyConfig.addFilter("getBreadcrumbs", (tree, currentUrl) => {
    return getBreadcrumbs(tree, currentUrl);
  });

  eleventyConfig.addFilter("getPrevNext", (tree, currentUrl) => {
    return getPrevNext(tree, currentUrl);
  });

  eleventyConfig.addFilter("isNodeActiveOrAncestor", (node, currentUrl) => {
    return isNodeActiveOrAncestor(node, currentUrl);
  });
}
