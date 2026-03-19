import { defineConfig } from "vitepress"

export default defineConfig({
  // 站点元数据
  title: "Dao",
  description: "大道至简的 AI Agent 框架",
  lang: "zh-CN",

  // 主题配置
  themeConfig: {
    // 顶部导航
    nav: [
      { text: "指南", link: "/guide/getting-started" },
      { text: "API", link: "/api" },
      { text: "设计", link: "/design" },
      {
        text: "更多",
        items: [
          { text: "路线图", link: "/roadmap" },
          { text: "设计原则", link: "/principles" },
          { text: "GitHub", link: "https://github.com/exposir/Dao" },
        ],
      },
    ],

    // 侧边栏
    sidebar: {
      "/guide/": [
        {
          text: "入门",
          items: [
            { text: "快速开始", link: "/guide/getting-started" },
            { text: "模型配置", link: "/model" },
          ],
        },
        {
          text: "核心概念",
          items: [
            { text: "工具系统", link: "/tools" },
            { text: "Agent Loop", link: "/agent-loop" },
            { text: "Steps 引擎", link: "/engine" },
          ],
        },
        {
          text: "进阶",
          items: [
            { text: "插件系统", link: "/plugins" },
            { text: "团队协作", link: "/team" },
          ],
        },
      ],
      "/": [
        {
          text: "参考",
          items: [
            { text: "API 文档", link: "/api" },
            { text: "设计文档", link: "/design" },
            { text: "设计原则", link: "/principles" },
            { text: "路线图", link: "/roadmap" },
          ],
        },
      ],
    },

    // 社交链接
    socialLinks: [
      { icon: "github", link: "https://github.com/exposir/Dao" },
    ],

    // 页脚
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2025 exposir",
    },

    // 搜索
    search: {
      provider: "local",
    },

    // 编辑链接
    editLink: {
      pattern: "https://github.com/exposir/Dao/edit/main/docs/:path",
      text: "在 GitHub 上编辑此页",
    },

    // 文档页脚导航文字
    docFooter: {
      prev: "上一页",
      next: "下一页",
    },

    outline: {
      label: "页面导航",
    },

    lastUpdated: {
      text: "最后更新于",
    },

    returnToTopLabel: "回到顶部",
    sidebarMenuLabel: "菜单",
    darkModeSwitchLabel: "主题",
  },
})
