/* ==========================================================================
 * js/modules/vault.js — M5 密码保管（安全敏感模块）
 * --------------------------------------------------------------------------
 * 加密边界（本模块最重要的约束）：
 *   - 本模块 **不接触 CryptoKey**，不 import crypto.js / storage.js / main.js；
 *     加解密全部由 main.js 在注入的 4 个接口里完成；
 *   - 明文密码/备注只允许出现在三处：① 编辑弹窗输入框；② 行内点击眼睛的显隐瞬间；
 *     ③ 复制动作。三者都由本模块即刻使用、即刻释放，不做任何缓存；
 *   - 本文件无 console 输出，也不会把明文写进任何持久化结构。
 *
 * 其它约定：
 *   - 无 innerHTML / outerHTML / insertAdjacentHTML：文本一律 textContent，
 *     图标一律 createElementNS 逐节点构造；列表图标用名称首字符瓦片，不拉取 favicon；
 *   - 强度判断复用 auth.evaluateStrength，标签复用 utils.parseTags，不重复实现；
 *   - id / createdAt / updatedAt 由 storage 层维护。
 *
 * 视觉依据：DESIGN.md C（列表行）、F（掩码·眼睛·复制·强度条·生成器）、E.1/E.3、H。
 * ========================================================================== */

import { evaluateStrength } from '../lib/auth.js';
import { byId, createEl, openConfirmDialog, openModal, setStrengthBar, setText } from '../lib/dom.js';
import {
  PASSWORD_LENGTH_DEFAULT,
  PASSWORD_LENGTH_MAX,
  PASSWORD_LENGTH_MIN,
  generatePassword,
  parseTags
} from '../lib/utils.js';

/**
 * @typedef {object} CredentialEntry
 * @property {string} title
 * @property {string} site
 * @property {string} url
 * @property {string} username
 * @property {string} password 明文（仅用于传入注入接口，由 main.js 加密）
 * @property {string} note 明文（同上）
 * @property {string} category
 * @property {string[]} tags
 */

/**
 * @typedef {object} VaultApi
 * @property {() => Promise<object[]>} getCredentials
 * @property {(entry: CredentialEntry) => Promise<object>} addCredential
 * @property {(id: string, entry: CredentialEntry) => Promise<object>} updateCredential
 * @property {(cred: object) => Promise<{password: string, note: string}>} revealCredential
 * @property {(id: string) => Promise<boolean>} removeCredential
 * @property {(message: string, options?: {type?: 'success' | 'error' | 'neutral'}) => void} notify
 */

/* --------------------------------------------------------------------------
 * 常量
 * -------------------------------------------------------------------------- */

/** 编辑器宽度：DESIGN.md E.1 表单类默认 480px */
const EDITOR_WIDTH_PX = 480;

/** 掩码字符与定宽位数（DESIGN.md F：列表与详情默认以 • 掩码，字距 2px） */
const MASK_TEXT = '••••••••';

/** 眼睛显隐的自动收起时间：明文不应在界面上无限期停留 */
const REVEAL_TIMEOUT_MS = 10_000;

/** 复制成功后对勾持续时长（DESIGN.md F：1.5 秒） */
const COPY_FEEDBACK_MS = 1500;

/** 分类（PRD M5 默认分类；未选/未知归入「未分类」） */
const CATEGORIES = ['工作', '学习', '社交', '购物', '金融', '其他'];
const UNCATEGORIZED = '未分类';
const DEFAULT_CATEGORY = '工作';

/** 分组展示顺序：默认分类在前，「未分类」最后 */
const GROUP_ORDER = [...CATEGORIES, UNCATEGORIZED];

/** 各分类的瓦片配色（只用 DESIGN.md 已有的 card-tint-* 与深色 Token） */
const CATEGORY_STYLE = {
  工作: { tint: 'sky', ink: 'link-blue' },
  学习: { tint: 'lavender', ink: 'brand-purple-800' },
  社交: { tint: 'rose', ink: 'brand-pink-deep' },
  购物: { tint: 'peach', ink: 'brand-orange-deep' },
  金融: { tint: 'mint', ink: 'brand-green' },
  其他: { tint: 'gray', ink: 'slate' },
  未分类: { tint: 'cream', ink: 'charcoal' }
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 图标形状表（24 网格、1.6 描边）。
 * @type {Record<string, Array<[string, Record<string, string>]>>}
 */
const ICON_SHAPES = {
  eye: [
    ['path', { d: 'M2.75 12S6.5 5.75 12 5.75 21.25 12 21.25 12 17.5 18.25 12 18.25 2.75 12 2.75 12z' }],
    ['circle', { cx: '12', cy: '12', r: '3' }]
  ],
  copy: [
    ['rect', { x: '9.25', y: '9.25', width: '10.5', height: '10.5', rx: '2.5' }],
    ['path', { d: 'M14.75 6.75V5.5a1.5 1.5 0 0 0-1.5-1.5H5.75a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h1.25' }]
  ],
  check: [['path', { d: 'M5 12.75 10 17.5l9-10.5' }]],
  edit: [
    ['path', { d: 'M4.75 19.25h3.5L19 8.5a1.5 1.5 0 0 0 0-2.12l-1.38-1.38a1.5 1.5 0 0 0-2.12 0L4.75 15.75z' }]
  ],
  trash: [
    ['path', { d: 'M4.75 6.75h14.5' }],
    ['path', { d: 'M9.25 6.75V5a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 .75.75v1.75' }],
    ['path', { d: 'M6.75 6.75l.75 12.5h9l.75-12.5' }]
  ],
  chevron: [['path', { d: 'M9.25 6.5 15 12l-5.75 5.5' }]],
  refresh: [
    ['path', { d: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3' }],
    ['path', { d: 'M19.75 4.75v4.5h-4.5' }]
  ],
  key: [
    ['circle', { cx: '8.25', cy: '12', r: '4.25' }],
    ['path', { d: 'M12.5 12h7.25' }],
    ['path', { d: 'M17.25 12v3' }]
  ]
};

/**
 * 用 createElementNS 逐节点构造线性图标（不使用 innerHTML）。
 * @param {string} name
 * @param {number} [size]
 * @returns {SVGElement}
 */
function createIcon(name, size = 18) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  for (const [tag, attributes] of ICON_SHAPES[name] ?? ICON_SHAPES.key) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}

/* --------------------------------------------------------------------------
 * 模块状态（仅内存；不含任何明文）
 * -------------------------------------------------------------------------- */

/** @type {VaultApi | null} */
let api = null;
let mounted = false;

const state = {
  keyword: '',
  categoryFilter: 'all',
  editingId: null,
  /** 被折叠的分组 */
  collapsed: new Set(),
  /** 当前处于「眼睛显明」状态的条目 id 与自动收起定时器（不保存明文本身） */
  revealedId: null,
  revealTimerId: 0,
  /** Modal 内的生成器选项（非敏感） */
  generator: { length: PASSWORD_LENGTH_DEFAULT, upper: true, digits: true, symbols: true }
};

/* --------------------------------------------------------------------------
 * 数据加工（纯函数）
 * -------------------------------------------------------------------------- */

/**
 * 从网址取 host（去掉协议与路径），失败时返回空串。
 * @param {unknown} url
 * @returns {string}
 */
function hostOf(url) {
  if (typeof url !== 'string' || url.trim().length === 0) return '';
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return parsed.host;
  } catch {
    return '';
  }
}

/**
 * 名称首字符（用于瓦片；用 Array.from 以正确处理 emoji / 代理对）。
 * @param {unknown} title
 * @returns {string}
 */
function initialOf(title) {
  const text = typeof title === 'string' ? title.trim() : '';
  if (text.length === 0) return '?';
  const [first] = Array.from(text.toUpperCase());
  return first ?? '?';
}

/**
 * 归类：不在默认分类里的都算「未分类」。
 * @param {unknown} category
 * @returns {string}
 */
function normalizeCategory(category) {
  return typeof category === 'string' && CATEGORIES.includes(category) ? category : UNCATEGORIZED;
}

/**
 * 搜索（名称 / 网站 / 账号 / 网址）+ 分类筛选。
 * @param {object[]} list
 * @returns {object[]}
 */
function applyFilters(list) {
  const keyword = state.keyword.trim().toLowerCase();

  return list.filter((entry) => {
    if (state.categoryFilter !== 'all' && normalizeCategory(entry.category) !== state.categoryFilter) {
      return false;
    }
    if (keyword.length === 0) return true;
    const haystack = [entry.title, entry.site, entry.username, entry.url]
      .filter((value) => typeof value === 'string')
      .join('\n')
      .toLowerCase();
    return haystack.includes(keyword);
  });
}

/**
 * 按分类分组（GROUP_ORDER 固定顺序），组内按名称排序。
 * @param {object[]} list
 * @returns {Array<{category: string, items: object[]}>}
 */
function groupByCategory(list) {
  /** @type {Map<string, object[]>} */
  const buckets = new Map();
  for (const entry of list) {
    const category = normalizeCategory(entry.category);
    if (!buckets.has(category)) buckets.set(category, []);
    buckets.get(category).push(entry);
  }

  return GROUP_ORDER.filter((category) => buckets.has(category)).map((category) => ({
    category,
    items: [...buckets.get(category)].sort((a, b) =>
      String(a.title ?? '').localeCompare(String(b.title ?? ''), 'zh-Hans-CN')
    )
  }));
}

/**
 * 表单原始值 → CredentialEntry（明文只在这里短暂持有，随即交给注入接口加密）。
 * @param {{title: string, site: string, url: string, username: string, password: string, note: string, category: string, tags: string}} form
 * @returns {{ok: true, data: CredentialEntry} | {ok: false, message: string}}
 */
function buildEntry(form) {
  const title = typeof form.title === 'string' ? form.title.trim() : '';
  if (title.length === 0) {
    return { ok: false, message: '请填写名称' };
  }

  const password = typeof form.password === 'string' ? form.password : '';
  if (password.length === 0) {
    return { ok: false, message: '请填写密码或使用生成器生成一个' };
  }

  return {
    ok: true,
    data: {
      title,
      site: typeof form.site === 'string' ? form.site.trim() : '',
      url: typeof form.url === 'string' ? form.url.trim() : '',
      username: typeof form.username === 'string' ? form.username.trim() : '',
      password,
      note: typeof form.note === 'string' ? form.note.trim() : '',
      category: CATEGORIES.includes(form.category) ? form.category : DEFAULT_CATEGORY,
      tags: parseTags(form.tags)
    }
  };
}

/* --------------------------------------------------------------------------
 * 明文生命周期管理
 * -------------------------------------------------------------------------- */

/** 立即收起所有显明状态并清掉定时器（锁定 / 清空 / 页面隐藏时调用） */
function clearReveal() {
  if (state.revealTimerId) {
    window.clearTimeout(state.revealTimerId);
    state.revealTimerId = 0;
  }
  state.revealedId = null;
}

/**
 * 复制文本到剪贴板。
 * 优先 navigator.clipboard；不可用时抛出带 code 的错误由调用方提示，绝不静默失败。
 * @param {string} text
 * @returns {Promise<void>}
 */
async function copyToClipboard(text) {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard || typeof clipboard.writeText !== 'function') {
    const error = new Error('clipboard-unavailable');
    error.code = 'CLIPBOARD_UNAVAILABLE';
    throw error;
  }
  await clipboard.writeText(text);
}

/* --------------------------------------------------------------------------
 * 列表渲染（DESIGN.md C / F）
 * -------------------------------------------------------------------------- */

/**
 * 填充下拉选项。
 * @param {HTMLSelectElement | null} select
 * @param {Array<{value: string, label: string}>} options
 * @param {string} selected
 */
function fillSelect(select, options, selected) {
  if (!select) return;
  select.replaceChildren();
  for (const option of options) {
    const node = /** @type {HTMLOptionElement} */ (createEl('option', { text: option.label }));
    node.value = option.value;
    select.append(node);
  }
  select.value = selected;
}

/**
 * 创建一个 ghost 图标按钮。
 * @param {{icon: string, label: string, action: string, id: string, size?: number}} config
 * @returns {HTMLButtonElement}
 */
function createIconButton(config) {
  const button = /** @type {HTMLButtonElement} */ (
    createEl('button', { className: 'lk-icon-btn lk-icon-btn-sm', type: 'button' })
  );
  button.dataset.action = config.action;
  button.dataset.id = config.id;
  button.setAttribute('aria-label', config.label);
  button.append(
    createIcon(config.icon, config.size ?? 18),
    createEl('span', { className: 'lk-sr-only', text: config.label })
  );
  return button;
}

/**
 * 创建一行账号。
 * @param {object} entry
 * @returns {HTMLElement}
 */
function createCredentialRow(entry) {
  const category = normalizeCategory(entry.category);
  const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE[UNCATEGORIZED];
  const id = String(entry.id);

  const row = createEl('div', { className: 'lk-cred-row', tabindex: '0' });
  row.dataset.id = id;
  row.dataset.action = 'edit';
  row.setAttribute('role', 'button');

  /* 36px 淡彩瓦片：名称首字符（textContent 写入，不拉取 favicon） */
  const tile = createEl('div', { className: 'lk-vault-tile' });
  tile.dataset.tint = style.tint;
  tile.dataset.ink = style.ink;
  tile.append(createEl('span', { className: 'lk-vault-tile-text', text: initialOf(entry.title) }));

  /* 主文本 = 名称；副文本 = 账号、网站 host */
  const main = createEl('div', { className: 'lk-cred-main' });
  main.append(createEl('span', { className: 'lk-cred-title', text: String(entry.title ?? '') }));
  const meta = createEl('div', { className: 'lk-cred-meta' });
  const site = typeof entry.site === 'string' && entry.site.length > 0 ? entry.site : hostOf(entry.url);
  for (const value of [entry.username, site]) {
    if (typeof value === 'string' && value.length > 0) {
      meta.append(createEl('span', { className: 'lk-cred-sub', text: value }));
    }
  }
  for (const tag of Array.isArray(entry.tags) ? entry.tags : []) {
    if (typeof tag !== 'string' || tag.length === 0) continue;
    meta.append(createEl('span', { className: 'lk-tag-chip', text: tag }));
  }
  if (meta.childElementCount > 0) main.append(meta);

  /* 右侧：掩码密码 + 眼睛 + 复制账号 + 复制密码 */
  const aside = createEl('div', { className: 'lk-cred-aside' });

  const passwordText = createEl('span', {
    className: 'lk-cred-password',
    id: `cred-password-${id}`
  });
  passwordText.textContent = MASK_TEXT;
  passwordText.dataset.masked = 'true';
  if (state.revealedId === id) {
    passwordText.dataset.masked = 'false';
  }

  const eyeButton = createIconButton({
    icon: 'eye',
    label: `显示 ${entry.title ?? ''} 的密码`,
    action: 'reveal',
    id
  });
  eyeButton.setAttribute('aria-pressed', state.revealedId === id ? 'true' : 'false');

  const copyUserButton = createIconButton({
    icon: 'copy',
    label: `复制 ${entry.title ?? ''} 的账号`,
    action: 'copy-username',
    id
  });

  const copyPasswordButton = createIconButton({
    icon: 'copy',
    label: `复制 ${entry.title ?? ''} 的密码`,
    action: 'copy-password',
    id
  });

  aside.append(passwordText, eyeButton, copyUserButton, copyPasswordButton);

  /* 行内操作：hover 出现编辑 / 删除 */
  const actions = createEl('div', { className: 'lk-row-actions' });
  actions.append(
    createIconButton({ icon: 'edit', label: `编辑 ${entry.title ?? ''}`, action: 'edit', id, size: 16 }),
    createIconButton({ icon: 'trash', label: `删除 ${entry.title ?? ''}`, action: 'delete', id, size: 16 })
  );

  row.append(tile, main, aside, actions);
  return row;
}

/**
 * 创建一个分类分组（可折叠，原生 details/summary）。
 * @param {{category: string, items: object[]}} group
 * @returns {HTMLElement}
 */
function createCategoryGroup(group) {
  const style = CATEGORY_STYLE[group.category] ?? CATEGORY_STYLE[UNCATEGORIZED];
  const details = /** @type {HTMLDetailsElement} */ (createEl('details', { className: 'lk-item-group' }));
  details.open = !state.collapsed.has(group.category);
  details.dataset.category = group.category;

  const summary = createEl('summary', { className: 'lk-item-group-head' });
  const chevron = createEl('span', { className: 'lk-item-chevron' });
  chevron.append(createIcon('chevron', 16));

  const tile = createEl('span', { className: 'lk-vault-tile lk-vault-tile-sm' });
  tile.dataset.tint = style.tint;
  tile.dataset.ink = style.ink;

  summary.append(
    chevron,
    tile,
    createEl('span', { className: 'lk-item-group-title', text: group.category }),
    createEl('span', { className: 'lk-item-group-count', text: `${group.items.length} 项` })
  );

  const list = createEl('div', { className: 'lk-item-list' });
  for (const entry of group.items) list.append(createCredentialRow(entry));

  details.append(summary, list);
  details.addEventListener('toggle', () => {
    if (details.open) state.collapsed.delete(group.category);
    else state.collapsed.add(group.category);
  });

  return details;
}

/**
 * 渲染整页。
 */
async function render() {
  if (!api) return;

  const all = await api.getCredentials();
  const groups = groupByCategory(applyFilters(all));

  /* 若正在显明的条目已被删除 / 被筛掉，收起显明状态 */
  if (state.revealedId && !all.some((entry) => String(entry.id) === state.revealedId)) {
    clearReveal();
  }

  fillSelect(
    /** @type {HTMLSelectElement | null} */ (byId('vault-filter-category')),
    [
      { value: 'all', label: '全部分类' },
      ...CATEGORIES.map((name) => ({ value: name, label: name })),
      { value: UNCATEGORIZED, label: UNCATEGORIZED }
    ],
    state.categoryFilter
  );

  const listRoot = byId('vault-list');
  const emptyRoot = byId('vault-empty');
  if (!listRoot || !emptyRoot) return;

  listRoot.replaceChildren();

  if (groups.length === 0) {
    listRoot.hidden = true;
    emptyRoot.hidden = false;

    const hasAny = all.length > 0;
    setText(byId('vault-empty-title'), hasAny ? '没有符合条件的账号' : '还没有保存任何账号');
    setText(
      byId('vault-empty-desc'),
      hasAny
        ? '试着换个关键词，或清除搜索与分类筛选。'
        : '点击右上角「添加账号」，密码会加密保存在本机。'
    );
    const emptyAction = byId('vault-empty-action');
    if (emptyAction) emptyAction.hidden = hasAny;
    const clearButton = byId('vault-empty-clear');
    if (clearButton) clearButton.hidden = !hasAny;
    return;
  }

  listRoot.hidden = false;
  emptyRoot.hidden = true;

  const fragment = document.createDocumentFragment();
  for (const group of groups) fragment.append(createCategoryGroup(group));
  listRoot.append(fragment);

  /* 重建完成后，若仍处于显明状态则重新取一次明文（不缓存，随用随取） */
  if (state.revealedId) await applyRevealToRow(state.revealedId);
}

/**
 * 把某行的密码文本设为明文（明文只在本次调用内存在，随即交给 DOM）。
 * @param {string} id
 */
async function applyRevealToRow(id) {
  if (!api) return;
  const all = await api.getCredentials();
  const entry = all.find((item) => String(item.id) === id);
  const node = byId(`cred-password-${id}`);
  if (!entry || !node) return;

  const { password } = await api.revealCredential(entry);
  if (state.revealedId !== id) return; // 期间已被收起
  node.textContent = password;
  node.dataset.masked = 'false';

  const eyeButton = document.querySelector(`[data-action="reveal"][data-id="${id}"]`);
  if (eyeButton instanceof HTMLElement) eyeButton.setAttribute('aria-pressed', 'true');
}

/**
 * 收起某行的密码显示（立即回到掩码）。
 * @param {string} id
 */
function collapseRow(id) {
  const node = byId(`cred-password-${id}`);
  if (node) {
    node.textContent = MASK_TEXT;
    node.dataset.masked = 'true';
  }
  const eyeButton = document.querySelector(`[data-action="reveal"][data-id="${id}"]`);
  if (eyeButton instanceof HTMLElement) eyeButton.setAttribute('aria-pressed', 'false');
}

/* --------------------------------------------------------------------------
 * 复制反馈
 * -------------------------------------------------------------------------- */

/**
 * 复制成功后的反馈：图标变绿对勾 1.5 秒。
 * @param {HTMLButtonElement} button
 */
function showCopiedFeedback(button) {
  if (button.dataset.copied === '1') return;
  button.dataset.copied = '1';
  button.replaceChildren(
    createIcon('check', 18),
    createEl('span', { className: 'lk-sr-only', text: '已复制' })
  );
  window.setTimeout(() => {
    button.dataset.copied = '0';
    const label = button.getAttribute('aria-label') ?? '复制';
    button.replaceChildren(
      createIcon('copy', 18),
      createEl('span', { className: 'lk-sr-only', text: label })
    );
  }, COPY_FEEDBACK_MS);
}

/* --------------------------------------------------------------------------
 * 添加 / 编辑 Modal（DESIGN.md E.1 / F）
 * -------------------------------------------------------------------------- */

/** @type {ReturnType<typeof openModal> | null} */
let activeDialog = null;
/** 仅在 Modal 打开期间有效的表单引用 */
let formRefs = null;

/** 关闭并清理 Modal 状态（含明文输入框） */
function closeEditor() {
  // 立即清空输入框，不留明文
  if (formRefs) {
    formRefs.passwordInput.value = '';
    formRefs.noteInput.value = '';
    formRefs.generatedOutput.textContent = '';
  }
  const dialog = activeDialog;
  activeDialog = null;
  formRefs = null;
  state.editingId = null;
  dialog?.close();
}

/** 按当前选择刷新强度条与标签 */
function renderStrength() {
  if (!formRefs) return;
  const { segments, label } = evaluateStrength(formRefs.passwordInput.value);
  setStrengthBar(formRefs.strengthRoot, segments);
  setText(formRefs.strengthLabel, label);
}

/** 刷新生成器的滑动条、勾选框与结果展示 */
function renderGenerator() {
  if (!formRefs) return;
  const { length, upper, digits, symbols } = state.generator;
  formRefs.lengthRange.value = String(length);
  setText(formRefs.lengthValue, String(length));
  formRefs.upperCheck.checked = upper;
  formRefs.digitsCheck.checked = digits;
  formRefs.symbolsCheck.checked = symbols;
}

/**
 * 用当前选项生成一个新密码并展示在生成器结果区。
 * 明文只写入这个只读展示框，用户点「使用」后才进入密码输入框。
 */
function regenerate() {
  if (!formRefs) return;
  const value = generatePassword(state.generator);
  setText(formRefs.generatedOutput, value);
}

/**
 * 一个带标签的表单字段。
 * @param {{id: string, label: string, control: HTMLElement}} config
 * @returns {HTMLElement}
 */
function createField(config) {
  const field = createEl('div', { className: 'lk-field' });
  const label = createEl('label', { className: 'lk-field-label', text: config.label });
  label.setAttribute('for', config.id);
  field.append(label, config.control);
  return field;
}

/**
 * 打开「添加 / 编辑账号」Modal。
 * @param {object | null} [editing]
 */
async function openEditor(editing = null) {
  state.editingId = editing ? String(editing.id) : null;
  state.generator = {
    length: PASSWORD_LENGTH_DEFAULT,
    upper: true,
    digits: true,
    symbols: true
  };

  /* 编辑模式：先解密一次，仅用于回填（明文不缓存，回填后引用即丢） */
  let revealed = { password: '', note: '' };
  if (editing) {
    try {
      revealed = await api.revealCredential(editing);
    } catch {
      api?.notify('无法解密该条目，请重新解锁后再试', { type: 'error' });
      state.editingId = null;
      return;
    }
  }

  const form = /** @type {HTMLFormElement} */ (
    createEl('form', { className: 'lk-form', id: 'cred-form' })
  );
  form.noValidate = true;

  /* 名称（必填） */
  const titleInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'cred-title', type: 'text' })
  );
  titleInput.setAttribute('autocomplete', 'off');
  titleInput.setAttribute('placeholder', '如：校园 VPN');
  titleInput.required = true;

  /* 网站 / 应用名 */
  const siteInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'cred-site', type: 'text' })
  );
  siteInput.setAttribute('autocomplete', 'off');
  siteInput.setAttribute('placeholder', '选填');

  /* 网址 */
  const urlInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'cred-url', type: 'text' })
  );
  urlInput.setAttribute('autocomplete', 'off');
  urlInput.setAttribute('inputmode', 'url');
  urlInput.setAttribute('placeholder', '选填，如 vpn.school.edu.cn');

  /* 账号 */
  const usernameInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'cred-username', type: 'text' })
  );
  usernameInput.setAttribute('autocomplete', 'off');
  usernameInput.setAttribute('placeholder', '登录用户名 / 邮箱');

  /* 密码：眼睛 + 强度条 */
  const passwordWrap = createEl('div', { className: 'lk-input-wrap' });
  const passwordInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'cred-password', type: 'password' })
  );
  passwordInput.setAttribute('autocomplete', 'new-password');
  const eyeButton = createIconButton({
    icon: 'eye',
    label: '显示密码',
    action: 'toggle-password',
    id: 'editor'
  });
  eyeButton.classList.remove('lk-icon-btn-sm');
  eyeButton.classList.add('lk-eye-btn');
  passwordWrap.append(passwordInput, eyeButton);

  const strengthRow = createEl('div', { className: 'lk-strength-row' });
  const strengthRoot = createEl('div', { className: 'lk-strength', id: 'cred-strength' });
  for (let i = 0; i < 4; i += 1) {
    const seg = createEl('span', { className: 'lk-strength-seg' });
    seg.setAttribute('data-segment', String(i + 1));
    strengthRoot.append(seg);
  }
  const strengthLabel = createEl('span', { className: 'lk-strength-label', id: 'cred-strength-label' });
  strengthRow.append(strengthRoot, strengthLabel);

  /* 生成器面板 */
  const generator = createEl('div', { className: 'lk-generator', id: 'cred-generator' });
  const lengthRow = createEl('div', { className: 'lk-generator-row' });
  const lengthRange = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-range', id: 'cred-length', type: 'range' })
  );
  lengthRange.min = String(PASSWORD_LENGTH_MIN);
  lengthRange.max = String(PASSWORD_LENGTH_MAX);
  lengthRange.step = '1';
  const lengthValue = createEl('span', { className: 'lk-generator-value', id: 'cred-length-value' });
  lengthRow.append(
    createEl('span', { className: 'lk-generator-label', text: '长度' }),
    lengthRange,
    lengthValue
  );

  const optionsRow = createEl('div', { className: 'lk-generator-options' });
  const upperCheck = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-check', id: 'cred-upper', type: 'checkbox' })
  );
  const digitsCheck = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-check', id: 'cred-digits', type: 'checkbox' })
  );
  const symbolsCheck = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-check', id: 'cred-symbols', type: 'checkbox' })
  );
  for (const [check, label, id] of [
    [upperCheck, '大写字母', 'cred-upper'],
    [digitsCheck, '数字', 'cred-digits'],
    [symbolsCheck, '符号', 'cred-symbols']
  ]) {
    const wrap = createEl('label', { className: 'lk-check-wrap' });
    wrap.setAttribute('for', id);
    wrap.append(check, createEl('span', { text: label }));
    optionsRow.append(wrap);
  }

  const resultRow = createEl('div', { className: 'lk-generator-result' });
  const generatedOutput = createEl('code', {
    className: 'lk-generated',
    id: 'cred-generated'
  });
  const regenerateButton = /** @type {HTMLButtonElement} */ (
    createEl('button', { className: 'lk-btn lk-btn-secondary lk-btn-sm', type: 'button' })
  );
  regenerateButton.dataset.action = 'regenerate';
  regenerateButton.append(createIcon('refresh', 16), createEl('span', { text: '换一个' }));
  const useButton = /** @type {HTMLButtonElement} */ (
    createEl('button', { className: 'lk-btn lk-btn-secondary lk-btn-sm', type: 'button' })
  );
  useButton.dataset.action = 'use-generated';
  useButton.append(createIcon('check', 16), createEl('span', { text: '使用' }));
  resultRow.append(generatedOutput, regenerateButton, useButton);

  generator.append(
    lengthRow,
    optionsRow,
    resultRow,
    createEl('p', {
      className: 'lk-generator-hint',
      text: '生成的密码只显示在这里；点「使用」才会填入密码框。'
    })
  );

  /* 分类 chip 网格 */
  const chipGrid = createEl('div', { className: 'lk-chip-grid', id: 'cred-category' });
  chipGrid.setAttribute('role', 'radiogroup');
  chipGrid.setAttribute('aria-label', '分类');
  for (const name of CATEGORIES) {
    const style = CATEGORY_STYLE[name];
    const chip = /** @type {HTMLButtonElement} */ (
      createEl('button', { className: 'lk-chip', type: 'button' })
    );
    chip.dataset.category = name;
    chip.dataset.tint = style.tint;
    chip.dataset.ink = style.ink;
    chip.setAttribute('role', 'radio');
    chip.append(createEl('span', { text: name }));
    chipGrid.append(chip);
  }

  /* 备注（与密码同样加密存储） */
  const noteInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'cred-note', type: 'text' })
  );
  noteInput.setAttribute('autocomplete', 'off');
  noteInput.setAttribute('placeholder', '选填，会与密码一同加密保存');

  /* 标签（不加密，属普通元数据） */
  const tagsInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'cred-tags', type: 'text' })
  );
  tagsInput.setAttribute('autocomplete', 'off');
  tagsInput.setAttribute('placeholder', '用逗号分隔，如：工作，常用');

  formRefs = {
    form,
    titleInput,
    siteInput,
    urlInput,
    usernameInput,
    passwordInput,
    eyeButton,
    strengthRoot,
    strengthLabel,
    chipGrid,
    categoryValue:
      editing && CATEGORIES.includes(editing.category) ? editing.category : DEFAULT_CATEGORY,
    noteInput,
    tagsInput,
    lengthRange,
    lengthValue,
    upperCheck,
    digitsCheck,
    symbolsCheck,
    generatedOutput
  };

  /* 组装 */
  const passwordField = createEl('div', { className: 'lk-field' });
  const passwordLabel = createEl('label', { className: 'lk-field-label', text: '密码' });
  passwordLabel.setAttribute('for', 'cred-password');
  passwordField.append(passwordLabel, passwordWrap, strengthRow);

  const categoryField = createEl('div', { className: 'lk-field' });
  categoryField.append(createEl('span', { className: 'lk-field-label', text: '分类' }), chipGrid);

  const twoCol = createEl('div', { className: 'lk-form-grid' });
  twoCol.append(
    createField({ id: 'cred-site', label: '网站 / 应用名', control: siteInput }),
    createField({ id: 'cred-url', label: '网址（选填）', control: urlInput }),
    createField({ id: 'cred-username', label: '账号 / 用户名', control: usernameInput }),
    createField({ id: 'cred-tags', label: '标签', control: tagsInput })
  );

  form.append(
    createField({ id: 'cred-title', label: '名称', control: titleInput }),
    twoCol,
    passwordField,
    generator,
    categoryField,
    createField({ id: 'cred-note', label: '备注', control: noteInput })
  );

  /* 回填（编辑模式）：明文随即写入输入框，函数内不再保留引用 */
  if (editing) {
    titleInput.value = typeof editing.title === 'string' ? editing.title : '';
    siteInput.value = typeof editing.site === 'string' ? editing.site : '';
    urlInput.value = typeof editing.url === 'string' ? editing.url : '';
    usernameInput.value = typeof editing.username === 'string' ? editing.username : '';
    passwordInput.value = revealed.password;
    noteInput.value = revealed.note;
    tagsInput.value = Array.isArray(editing.tags)
      ? editing.tags.filter((tag) => typeof tag === 'string').join('，')
      : '';
  }
  revealed = { password: '', note: '' }; // 立刻丢弃本地引用

  renderCategoryChips();
  renderGenerator();
  renderStrength();
  regenerate();

  /* 交互 */
  eyeButton.addEventListener('click', () => {
    if (!formRefs) return;
    const visible = formRefs.passwordInput.type === 'text';
    formRefs.passwordInput.type = visible ? 'password' : 'text';
    formRefs.eyeButton.setAttribute('aria-pressed', visible ? 'false' : 'true');
  });

  passwordInput.addEventListener('input', () => {
    renderStrength();
    activeDialog?.setError('');
  });

  for (const input of [titleInput, siteInput, urlInput, usernameInput, noteInput, tagsInput]) {
    input.addEventListener('input', () => activeDialog?.setError(''));
  }

  chipGrid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !formRefs) return;
    const chip = target.closest('.lk-chip');
    if (!(chip instanceof HTMLElement) || !chip.dataset.category) return;
    formRefs.categoryValue = chip.dataset.category;
    renderCategoryChips();
    activeDialog?.setError('');
  });

  lengthRange.addEventListener('input', () => {
    state.generator.length = Number(lengthRange.value);
    renderGenerator();
  });

  for (const [check, key] of [
    [upperCheck, 'upper'],
    [digitsCheck, 'digits'],
    [symbolsCheck, 'symbols']
  ]) {
    check.addEventListener('change', () => {
      state.generator[key] = check.checked;
      regenerate();
    });
  }

  regenerateButton.addEventListener('click', () => regenerate());

  useButton.addEventListener('click', () => {
    if (!formRefs) return;
    const value = formRefs.generatedOutput.textContent ?? '';
    if (value.length === 0) return;
    formRefs.passwordInput.value = value;
    renderStrength();
    activeDialog?.setError('');
    formRefs.passwordInput.focus();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitEditor();
  });

  activeDialog = openModal({
    title: editing ? '编辑账号' : '添加账号',
    subtitle: '密码与备注会用主密码加密后保存在本机',
    widthPx: EDITOR_WIDTH_PX,
    bodyChildren: [form],
    actions: [
      { label: '取消', variant: 'secondary', onClick: () => closeEditor() },
      {
        label: editing ? '保存修改' : '保存',
        variant: 'primary',
        onClick: () => form.requestSubmit()
      }
    ],
    onClose: () => {
      // 关闭时立刻清掉输入框中的明文
      if (formRefs) {
        formRefs.passwordInput.value = '';
        formRefs.noteInput.value = '';
        formRefs.generatedOutput.textContent = '';
      }
      activeDialog = null;
      formRefs = null;
      state.editingId = null;
    }
  });

  titleInput.focus();
}

/** 刷新分类 chip 选中态 */
function renderCategoryChips() {
  if (!formRefs) return;
  for (const chip of formRefs.chipGrid.querySelectorAll('.lk-chip')) {
    if (!(chip instanceof HTMLElement)) continue;
    const isActive = chip.dataset.category === formRefs.categoryValue;
    chip.classList.toggle('is-active', isActive);
    chip.setAttribute('aria-checked', isActive ? 'true' : 'false');
  }
}

/** 提交：校验 → 交给注入接口加密落盘 → 清明文 → 刷新 */
async function submitEditor() {
  if (!formRefs || !api) return;

  const built = buildEntry({
    title: formRefs.titleInput.value,
    site: formRefs.siteInput.value,
    url: formRefs.urlInput.value,
    username: formRefs.usernameInput.value,
    password: formRefs.passwordInput.value,
    note: formRefs.noteInput.value,
    category: formRefs.categoryValue,
    tags: formRefs.tagsInput.value
  });

  if (!built.ok) {
    // 校验失败：不关闭弹窗、不落盘
    activeDialog?.setError(built.message);
    return;
  }

  const editingId = state.editingId;
  try {
    // 明文只作为本次调用的实参；main.js 内部加密后即不再被引用
    if (editingId) await api.updateCredential(editingId, built.data);
    else await api.addCredential(built.data);
    closeEditor();
    api.notify(editingId ? '已保存修改' : '已添加账号', { type: 'success' });
    await render();
  } catch (error) {
    activeDialog?.setError(`保存失败：${error?.message ?? '未知错误'}`);
  }
}

/* --------------------------------------------------------------------------
 * 事件
 * -------------------------------------------------------------------------- */

/**
 * 列表点击：删除 / 显隐 / 复制 拦截，其余位置进入编辑。
 * @param {Event} event
 * @returns {Promise<void>}
 */
async function onListClick(event) {
  const target = event.target;
  if (!(target instanceof Element) || !api) return;
  const button = target.closest('[data-action]');
  if (!(button instanceof HTMLElement)) return;

  const action = button.dataset.action ?? '';
  const id = button.dataset.id ?? '';

  if (action === 'delete') {
    if (!id) return;
    const all = await api.getCredentials();
    const entry = all.find((item) => String(item.id) === id);
    if (!entry) return;
    openConfirmDialog({
      title: '删除这个账号',
      subtitle: '删除后无法恢复',
      message: [entry.title, entry.username].filter((v) => typeof v === 'string' && v).join(' · '),
      confirmLabel: '删除',
      variant: 'danger',
      onConfirm: async () => {
        await api.removeCredential(id);
        api.notify('已删除', { type: 'success' });
        clearReveal();
        await render();
      }
    });
    return;
  }

  if (action === 'reveal') {
    if (!id) return;
    if (state.revealedId === id) {
      clearReveal();
      collapseRow(id);
      return;
    }
    clearReveal();
    state.revealedId = id;
    await applyRevealToRow(id);
    // 明文字不应在界面上无限期停留
    state.revealTimerId = window.setTimeout(() => {
      state.revealTimerId = 0;
      const current = state.revealedId;
      state.revealedId = null;
      if (current) collapseRow(current);
    }, REVEAL_TIMEOUT_MS);
    return;
  }

  if (action === 'copy-username' || action === 'copy-password') {
    if (!id) return;
    const all = await api.getCredentials();
    const entry = all.find((item) => String(item.id) === id);
    if (!entry) return;

    // 明文只在这一次调用内存在：取到 → 写入剪贴板 → 立即出栈
    let plaintext = action === 'copy-username' ? String(entry.username ?? '') : '';
    if (action === 'copy-password') {
      const revealed = await api.revealCredential(entry);
      plaintext = revealed.password;
    }
    if (plaintext.length === 0) {
      api.notify(action === 'copy-username' ? '这条没有账号可复制' : '这条没有密码可复制', {
        type: 'error'
      });
      return;
    }

    try {
      await copyToClipboard(plaintext);
      plaintext = '';
      showCopiedFeedback(button);
      api.notify('已复制', { type: 'success' });
    } catch {
      plaintext = '';
      api.notify('复制失败：当前环境不支持剪贴板，请手动选择复制', { type: 'error' });
    }
    return;
  }

  if (action === 'edit') {
    if (!id) return;
    const all = await api.getCredentials();
    const entry = all.find((item) => String(item.id) === id);
    if (!entry) {
      api.notify('这个账号已不存在', { type: 'error' });
      await render();
      return;
    }
    await openEditor(entry);
  }
}

/** 绑定工具行与列表事件委托 */
function bindToolbar() {
  byId('vault-add-button')?.addEventListener('click', () => void openEditor());
  byId('vault-empty-action')?.addEventListener('click', () => void openEditor());

  byId('vault-empty-clear')?.addEventListener('click', async () => {
    state.keyword = '';
    state.categoryFilter = 'all';
    const searchInput = /** @type {HTMLInputElement | null} */ (byId('vault-search'));
    if (searchInput) searchInput.value = '';
    await render();
  });

  const searchInput = /** @type {HTMLInputElement | null} */ (byId('vault-search'));
  searchInput?.addEventListener('input', async () => {
    state.keyword = searchInput.value;
    await render();
  });

  const categorySelect = /** @type {HTMLSelectElement | null} */ (byId('vault-filter-category'));
  categorySelect?.addEventListener('change', async () => {
    state.categoryFilter = categorySelect.value;
    await render();
  });

  const listRoot = byId('vault-list');
  listRoot?.addEventListener('click', (event) => {
    void onListClick(event);
  });

  // 键盘可达：整行可聚焦，Enter / Space 打开编辑
  listRoot?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.classList.contains('lk-cred-row')) return;
    event.preventDefault();
    const id = target instanceof HTMLElement ? target.dataset.id ?? '' : '';
    if (id) void openEditById(id);
  });
}

/**
 * 按 id 打开编辑（键盘路径用）。
 * @param {string} id
 */
async function openEditById(id) {
  if (!api) return;
  const all = await api.getCredentials();
  const entry = all.find((item) => String(item.id) === id);
  if (entry) await openEditor(entry);
}

/* --------------------------------------------------------------------------
 * 对外入口
 * -------------------------------------------------------------------------- */

/**
 * 装配密码保管模块（由 main.js 注入数据、加解密与提示能力）。
 * @param {VaultApi} injectedApi
 */
export function mountVault(injectedApi) {
  if (mounted) return;
  mounted = true;
  api = injectedApi;
  bindToolbar();
  void render();
}

/**
 * 锁定 / 清空数据 / 页面隐藏时重置：收起所有明文显示、清掉生成器状态。
 */
export function resetVault() {
  clearReveal();
  state.keyword = '';
  state.categoryFilter = 'all';
  state.editingId = null;
  state.collapsed.clear();
  state.generator = { length: PASSWORD_LENGTH_DEFAULT, upper: true, digits: true, symbols: true };

  // 若 Modal 还开着，关闭并清空其中的明文输入
  if (activeDialog) closeEditor();

  const searchInput = /** @type {HTMLInputElement | null} */ (byId('vault-search'));
  if (searchInput) searchInput.value = '';
}

export { render as renderVault };
