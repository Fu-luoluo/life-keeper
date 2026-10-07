# AGENTS.md — LifeKeeper 工程全局指令

你是 LifeKeeper 项目的前端开发 Agent，工作区根目录即本文件所在目录。需求范围以《需求文档.md》为准，视觉风格以根目录 `DESIGN.md` 为准。

## 1. 项目简介

- **LifeKeeper（生活管家）**：纯前端、本地优先、隐私优先的个人生活管理应用，含四大模块：日常收支、生活记录、物品台账、密码保管。
- **技术栈**：HTML + Tailwind CSS + 原生 JavaScript（ES Modules），无后端、无框架。
- **数据**：仅保存在用户本机浏览器（MVP 用 localStorage，架构上预留 IndexedDB 切换）。

## 2. 运行方式

- 必须通过 **Live Server** 访问（如 `http://127.0.0.1:5500`）：Web Crypto 仅在安全上下文可用，**禁止直接双击 index.html（file://）**。
- VSCode 中右键 `index.html` → Open with Live Server。
- 无构建步骤；若使用 Tailwind CLI，则以其构建产物为准。
- 禁止自行启动 Live Server / 无头浏览器做页面验证；页面审查由用户完成，Agent 只做  不依赖浏览器的轻量自检并输出手动验证清单。

## 3. 视觉强制规则

1. 生成或修改任何 UI（HTML、Tailwind 类名、CSS、组件）前，**必须先读取根目录 `DESIGN.md`**，严格使用其中定义的色板、字体层级、字号行高、间距、圆角、阴影，以及 hover / active / disabled 等组件状态。
2. 禁止擅自新增或改写 `DESIGN.md` 未定义的颜色、圆角、间距、阴影、字体。
3. 页面必须响应式，移动优先（断点：<640 / 640–1024 / >1024 px），触控目标 ≥ 44px。
4. 根目录 `DESIGN.md` 已锁定 **Notion 暖色（浅色）风格**（源自 `awesome-design-md/design-md/notion/DESIGN.md`，2026-10-06 经用户确认）；更换品牌基线必须先经用户明确同意。
5. `awesome-design-md/` 是只读参考库（独立 git 仓库），**禁止在其中新增、修改、删除任何文件**；注意：该目录本地副本不含 preview.html，视觉参考一律以其中的 `DESIGN.md` 文本为准。

## 4. 安全强制规则

1. 主密码与任何条目的密码**严禁明文持久化、严禁 console 打印**。
2. 加密只允许使用浏览器原生 **Web Crypto API**：PBKDF2（迭代 ≥ 210000 次）从主密码派生 **AES-GCM-256** 密钥；密文统一以 `{ "iv": "...", "ct": "..." }` 结构存储。
3. 密钥与明文只允许存在于内存；锁定、自动超时（默认 5 分钟）或关闭页面时立即清除。
4. 用户数据渲染一律使用 `textContent` 等安全方式，**禁止用未转义的 innerHTML 插入用户内容**（防 XSS）。
5. 禁止引入第三方统计、追踪、广告脚本；业务数据不得发起任何网络请求。

## 5. 架构约定

```text
js/
├── main.js              # 入口：启动、路由、全局状态
├── lib/
│   ├── storage.js       # 唯一数据访问层，业务模块不得直接读写存储
│   ├── crypto.js        # 唯一加解密出口
│   └── utils.js         # 日期、金额、id 等通用工具
└── modules/
    ├── dashboard.js     # 仪表盘
    ├── account.js       # 日常收支
    ├── diary.js         # 生活记录
    ├── items.js         # 物品台账
    ├── vault.js         # 密码保管
    └── settings.js      # 设置
```

- 金额以"分"（整数）存储与计算；时间统一 ISO 8601；id 使用 `crypto.randomUUID()`。
- Tailwind：原型阶段可用 Play CDN；正式交付前改为本地文件 / CLI 构建，保证离线可用。
- 修改已有页面时，只改动当前任务相关代码，不随意重写无关业务逻辑。

## 6. 输出与自查约定

- 输出完整可运行代码并写入对应文件，不留 TODO / 占位代码。
- 每次完成后逐项自查：
  - [ ] 视觉对照 `DESIGN.md`：颜色 / 字号 / 间距 / 圆角 / 阴影 / 交互状态一致
  - [ ] Live Server 下功能可用，刷新后数据不丢
  - [ ] 存储中无明文密码，锁定后内存中无密钥与明文残留
  - [ ] 移动端与桌面端布局均正常
  - [ ] 浏览器控制台无报错
- 全程使用简体中文沟通。
