/**
 * Common template filters & helpers for Renon.
 */

export function normalizeUrl(url) {
  if (!url) return "/";
  const cleaned = String(url).replace(/\/+/g, "/");
  if (cleaned === "/") return "/";
  return cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
}

export function isActiveUrl(itemUrl, currentUrl) {
  if (!itemUrl || !currentUrl) return false;
  return normalizeUrl(itemUrl) === normalizeUrl(currentUrl);
}

export function formatDate(dateInput, lang = "zh-TW") {
  if (!dateInput) return "";
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return String(dateInput);
  return new Intl.DateTimeFormat(lang, {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function readingTime(htmlContent = "") {
  const plainText = String(htmlContent)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plainText) return 1;
  // Count CJK characters + English words
  const cjkMatches = plainText.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || [];
  const nonCjkWords = plainText
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const totalUnits = cjkMatches.length + nonCjkWords.length;
  return Math.max(1, Math.ceil(totalUnits / 350));
}

export function registerFilters(eleventyConfig) {
  eleventyConfig.addFilter("normalizeUrl", normalizeUrl);
  eleventyConfig.addFilter("isActiveUrl", isActiveUrl);
  eleventyConfig.addFilter("formatDate", formatDate);
  eleventyConfig.addFilter("readingTime", readingTime);
}
