# Renon — 結構化知識分享網站模板 (Eleventy v3 + AsciiDoc + WebC)

**Renon** 是一套專為技術團隊、產品文件與個人知識管理設計的現代化靜態知識庫網站模板。以 **Eleventy v3 (原生 ESM)** 為基底，結合 **Asciidoctor (`@asciidoctor/core`)** 的嚴謹語意排版、**WebC** 單一檔案元件系統，以及 **原生 CSS Cascade Layers (`@layer`)** 設計系統。

---

## 核心特色

- **零 YAML Frontmatter 負擔**：直接解析 `.adoc` 原生標頭屬性（`:nav-title:`、`:nav-order:`、`:description:`、`:page-tags:`、`:toclevels:`），自動轉型並注入 Eleventy Data Cascade。
- **三欄式結構化排版**：
  - **左側章節導覽列 (`<re-sidebar>`)**：根據 `src/content/` 資料夾階層自動產生多層級目錄樹，貼齊螢幕最左側並支援最小化收折（自動擴展內文閱讀空間）。
  - **中央高可讀性文章區**：內建麵包屑、預估閱讀時間、標籤連結、上下篇導覽卡片與頁尾更新資訊。
  - **右側浮動章節大綱 (`<re-toc>`)**：從 AsciiDoc AST 抽離章節結構，支援 `IntersectionObserver` ScrollSpy 自動高亮與行動端下拉目錄 (`<re-mobile-toc>`)。
- **豐富的技術寫作元件**：
  - **五級語意化提示框 (`NOTE` / `TIP` / `IMPORTANT` / `WARNING` / `CAUTION`)**
  - **建置期程式碼高亮 (`highlight.js`)**：支援顯示行號 (`linenums`)、重點行高亮 (`highlight="2,5-7"`) 與一鍵複製按鈕。
  - **互動式分頁 (`<re-tabs>`)**：支援鍵盤無障礙切換與 `sync-group` 跨區塊同步。
  - **Mermaid 架構圖 (`<re-mermaid>`)**：支援隨深淺色主題自動重繪與點擊燈箱放大。
  - **KaTeX 數學公式預渲染**：於建置期直接編譯為靜態 HTML + MathML，零客戶端 JS 負擔。
  - **圖片圖說與全螢幕燈箱 (`<re-lightbox>`)**：內文直接顯示圖片，點擊即可放大檢視。
- **全站靜態全文檢索 (`Pagefind`)**：於 `eleventy.after` 自動建立繁體中文與英文靜態索引，支援 `Ctrl+K` / `Cmd+K` 喚醒搜尋框。
- **完整 SEO 與訂閱支援**：內建 OpenGraph / Twitter Card Meta、`/tags/` 標籤索引系統、`/sitemap.xml` 與 `/feed.xml` (Atom 1.0)。

---

## 快速開始

### 1. 系統需求
- **Bun** `v1.1+`（推薦）或 **Node.js** `v20+`

### 2. 安裝與啟動

```bash
# 1. 安裝相依套件
bun install

# 2. 啟動本地熱重載開發伺服器 (http://localhost:8080)
bun run dev

# 3. 建置正式版靜態網站與 Pagefind 搜尋索引 (輸出至 _site/)
bun run build
```

---

## 專案目錄結構

```text
renon/
├── eleventy.config.js           # Eleventy v3 (ESM) 核心設定與 Pagefind 建置掛鉤
├── package.json                 # 專案設定與腳本 ("type": "module")
└── src/
    ├── _data/
    │   └── site.js              # 全站配置中心 (Logo、導覽列、Feature Flags、頁尾版權)
    ├── lib/
    │   ├── asciidoc.js          # Asciidoctor 引擎封裝、屬性轉型、AST TOC 抽取與 HTML5 Converter
    │   ├── navigation.js        # 資料夾驅動的多層級目錄樹、標籤聚合、麵包屑與上下篇計算
    │   └── filters.js           # 日期格式化、網址正規化與中英雙語閱讀時間計算
    ├── _includes/
    │   ├── layouts/             # base.webc, doc.webc, page.webc 佈局模板
    │   └── components/          # <re-header>, <re-sidebar>, <re-toc>, <re-search>, <re-tabs> 等元件
    ├── assets/
    │   ├── css/                 # tokens.css (主題變數), base.css, asciidoc.css (@layer 設計系統)
    │   └── images/              # 靜態圖片與 SVG 資源
    └── content/                 # AsciiDoc (.adoc) 知識庫內容目錄 (資料夾即章節)
        ├── content.11tydata.js  # 自動剝除 /content 前綴的乾淨網址規則
        ├── index.adoc           # 知識庫首頁 (/)
        ├── getting-started/     # 第一章：快速上手 (/getting-started/...)
        └── authoring/           # 第二章：寫作指南 (/authoring/...)
```

---

## 如何新增文章與修改配置？

1. **修改全站配置與 Logo**：編輯 [`src/_data/site.js`](./src/_data/site.js) 即可調整網站標題、Logo 文字或圖片路徑、頂部導覽列、社群圖示與 9 項介面功能開關（`site.features`）。
2. **更換品牌主題色**：編輯 [`src/assets/css/tokens.css`](./src/assets/css/tokens.css) 中的 `--color-accent` 變數。
3. **新增文章與章節**：在 `src/content/` 下新增 `.adoc` 檔案或子資料夾（含 `index.adoc`），左側導覽樹與搜尋索引即會在建置時自動更新。詳細語法請啟動 `bun run dev` 後瀏覽站內的 **「快速上手」** 與 **「語法展示」** 頁面。
