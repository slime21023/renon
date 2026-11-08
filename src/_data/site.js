export default {
  title: "Renon",
  subtitle: "Knowledge Base Template",
  tagline: "基於 Eleventy v3 + AsciiDoc + WebC 打造的現代化結構化知識分享網站模板",
  author: "Renon Documentation Team",
  lang: "zh-Hant",
  url: "http://localhost:8080",

  // 1. 品牌識別配置（支援文字縮寫或自訂圖片/SVG）
  logo: {
    text: "R",
    image: "", // 例如 "/assets/images/logo.svg"，設定後優先渲染 <img>
    alt: "Renon Logo"
  },
  badge: "Docs", // 設為 "" 或 false 即可隱藏標題旁徽章

  // 2. 頂部主導覽選單（支援 external: true 或 http(s):// 自動新分頁開啟）
  topNav: [
    { label: "知識總覽", url: "/" },
    { label: "快速上手", url: "/getting-started/" },
    { label: "寫作指南", url: "/authoring/" },
    { label: "標籤索引", url: "/tags/" }
  ],

  // 3. 頂部右側社群 / 專案連結圖示（內建 github, x, discord, globe 圖示）
  socialLinks: [
    {
      icon: "github",
      label: "GitHub 專案原始碼",
      url: "https://github.com/slime21023/renon"
    }
  ],

  // 4. 全站功能開關 (Feature Flags)
  features: {
    search: true, // 頂部 Pagefind 全文檢索按鈕
    themeToggle: true, // 頂部深淺色主題切換按鈕
    sidebarCollapsible: true, // 是否允許收合左側導覽列
    sidebarDefaultCollapsed: false, // 首次造訪時左側導覽列是否預設為最小化
    breadcrumbs: true, // 文章頂部麵包屑導覽
    readingTime: true, // 文章頂部預估閱讀時間
    lastUpdated: true, // 文章底部最後更新日期
    editLink: true, // 文章底部「編輯此頁」連結
    prevNext: true // 文章底部「上一篇 / 下一篇」卡片
  },

  // 5. 右側大綱 (TOC) 預設配置
  toc: {
    enabled: true,
    maxLevel: 3 // 預設擷取至 H3（單頁可透過 :toclevels: 4 覆寫）
  },

  // 6. 程式碼倉庫與頁尾設定
  repoUrl: "https://github.com/slime21023/renon",
  editBaseUrl: "https://github.com/slime21023/renon/edit/main/",
  editLinkText: "於 GitHub 編輯此頁",
  footer: {
    copyright: "© 2026 Renon Documentation. Built with Eleventy v3, AsciiDoc & WebC."
  }
};
