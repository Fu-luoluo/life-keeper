/**
 * LifeKeeper — 应用入口
 * ---------------------------------------------------------------------------
 * 职责（v0.1 桌面端应用骨架）：
 *   1. 启动：登记全局状态、绑定交互；
 *   2. 路由：基于 location.hash 的极简视图切换（原生 JavaScript，无框架）；
 *   3. 顶栏：用本机日期动态渲染「2026年10月7日 星期三」格式的日期文字。
 *
 * 本阶段不实现任何业务逻辑：各业务模块由 js/modules/*.js 承载，
 * 数据读写一律经由 js/lib/storage.js，加解密一律经由 js/lib/crypto.js。
 */

import * as dashboardModule from './modules/dashboard.js';
import * as accountModule from './modules/account.js';
import * as diaryModule from './modules/diary.js';
import * as itemsModule from './modules/items.js';
import * as vaultModule from './modules/vault.js';
import * as settingsModule from './modules/settings.js';

/** 可用页面：id 与 index.html 中 [data-page] / #view-<id> 一一对应 */
const PAGES = {
  dashboard: { module: dashboardModule, label: '仪表盘' },
  account: { module: accountModule, label: '日常收支' },
  diary: { module: diaryModule, label: '生活记录' },
  items: { module: itemsModule, label: '物品台账' },
  vault: { module: vaultModule, label: '密码保管' },
  settings: { module: settingsModule, label: '设置' }
};

/** 默认页面 */
const DEFAULT_PAGE = 'dashboard';

/** 全局状态（仅内存；业务数据不得在此直接读写存储） */
const state = {
  currentPage: null
};

const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/**
 * 生成本机日期文字，格式如「2026年10月7日 星期三」。
 * 注意：不使用 toISOString()，避免 UTC 偏移把日期算错一天。
 * @param {Date} [date] 取数基准，缺省为本机当前时间
 * @returns {string}
 */
function formatLocalDateText(date = new Date()) {
  const weekday = WEEKDAY_LABELS[date.getDay()] ?? '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`;
}

/** 渲染顶栏日期文字 */
function renderCurrentDate() {
  const target = document.getElementById('current-date');
  if (!target) return;
  target.textContent = formatLocalDateText();
}

/**
 * 解析当前 hash，返回合法页面 id。
 * @returns {keyof typeof PAGES}
 */
function resolvePageFromHash() {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return Object.prototype.hasOwnProperty.call(PAGES, raw) ? raw : DEFAULT_PAGE;
}

/**
 * 切换到指定页面：只做显隐与选中态切换，不涉及任何业务渲染。
 * @param {string} pageId
 * @param {{ replaceHash?: boolean, moveFocus?: boolean }} [options]
 */
function navigateTo(pageId, options = {}) {
  const { replaceHash = false, moveFocus = false } = options;
  if (!Object.prototype.hasOwnProperty.call(PAGES, pageId)) return;

  for (const section of document.querySelectorAll('.lk-view')) {
    section.hidden = section.dataset.page !== pageId;
  }

  for (const link of document.querySelectorAll('.lk-nav-item[data-page]')) {
    const isActive = link.dataset.page === pageId;
    link.classList.toggle('is-active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }

  state.currentPage = pageId;
  document.title = `LifeKeeper — ${PAGES[pageId].label}`;

  const hash = `#/${pageId}`;
  if (window.location.hash !== hash) {
    if (replaceHash) {
      window.history.replaceState(null, '', hash);
    } else {
      window.location.hash = hash;
    }
  }

  if (moveFocus) {
    document.getElementById('app-main')?.focus({ preventScroll: true });
  }

  document.documentElement.dataset.page = pageId;
}

/** 绑定左侧导航点击（原生 JS 视图切换） */
function bindNavigation() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('.lk-nav-item[data-page]');
    if (!link) return;
    event.preventDefault();
    navigateTo(link.dataset.page, { moveFocus: true });
  });
}

/** 顶栏挂锁按钮：本阶段不实现锁定逻辑，仅保留可聚焦的交互入口 */
function bindTopbarActions() {
  document.getElementById('lock-button')?.addEventListener('click', () => {
    // v0.1 骨架：锁定流程（主密码校验 / 内存清理）在后续版本实现。
  });
}

/** 启动应用 */
function bootstrap() {
  bindNavigation();
  bindTopbarActions();
  renderCurrentDate();

  window.addEventListener('hashchange', () => {
    navigateTo(resolvePageFromHash());
  });

  // 首次进入：把默认页面写回地址栏，保证刷新与分享链接都落在同一视图
  navigateTo(resolvePageFromHash(), { replaceHash: true });

  // Tailwind Play CDN 编译完成后解除首屏隐藏，避免未样式化闪烁（FOUC）
  requestAnimationFrame(() => {
    document.documentElement.classList.add('lk-ready');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
