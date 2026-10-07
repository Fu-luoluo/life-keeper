/* ==========================================================================
 * js/modules/account.js — M2 日常收支
 * --------------------------------------------------------------------------
 * 本阶段范围：记一笔 / 编辑（Modal，DESIGN.md E.1）+ 流水列表（DESIGN.md C）
 *   + 月份切换、类型 / 分类 / 账户 / 关键词筛选、月度汇总条。
 * 明确不做：分类占比与趋势图表（v0.7）、自定义账户管理、仪表盘改动。
 *
 * 分层约定（与 settings.js 同一注入模式）：
 *   - 本模块 **不 import storage.js / main.js**，数据与提示能力全部由 main.js 注入；
 *   - 本文件无 innerHTML / outerHTML / insertAdjacentHTML：文本一律 textContent，
 *     图标一律用 createElementNS 逐节点构造（d 等几何属性来自文件内的常量表，
 *     不接受任何用户输入，不存在注入面）；
 *   - 金额只在输入与显示两端转换：落盘恒为 amountCents 整数；
 *     id / createdAt / updatedAt 由 storage 层维护，本模块不生成、不改写。
 *
 * 视觉依据：DESIGN.md C（列表行）、E.1（Modal）、E.3（空状态）、H（交互状态）；
 *           分类配色只用既有 {colors.card-tint-*} 与既有深色 Token，不新增色值。
 * ========================================================================== */

import { byId, createEl, openConfirmDialog, openModal, setText } from '../lib/dom.js';
import {
  currentMonthKey,
  formatCurrency,
  formatDayGroupTitle,
  formatMonthKeyText,
  isoToLocalInputValue,
  localDateToIso,
  localDayKeyFromIso,
  localInputValueToIso,
  localMonthKeyFromIso,
  parseAmountToCents,
  parseTags,
  shiftMonthKey
} from '../lib/utils.js';

/**
 * @typedef {object} TransactionData
 * @property {'expense' | 'income'} type
 * @property {number} amountCents
 * @property {string} category
 * @property {string} account
 * @property {string} date
 * @property {string} note
 * @property {string[]} tags
 */

/**
 * @typedef {object} AccountApi
 * @property {() => Promise<object[]>} getTransactions
 * @property {(data: TransactionData) => Promise<object>} addTransaction
 * @property {(id: string, patch: TransactionData) => Promise<object>} updateTransaction
 * @property {(id: string) => Promise<boolean>} removeTransaction
 * @property {(message: string, options?: {type?: 'success' | 'error' | 'neutral'}) => void} notify
 */

/* --------------------------------------------------------------------------
 * 常量：类型、账户、分类
 * -------------------------------------------------------------------------- */

/** @type {Array<{value: 'expense' | 'income', label: string}>} */
const TYPES = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' }
];

const TYPE_LABEL = { expense: '支出', income: '收入' };

/** 账户选项（PRD M2 默认账户；自定义管理属后续版本） */
const ACCOUNTS = ['现金', '储蓄卡', '支付宝', '微信'];

/**
 * 分类定义：
 *   tint = 图标容器底色（{colors.card-tint-*}）
 *   ink  = 图标颜色（只用 DESIGN.md 已定义的深色 Token，参照 badge-tag-* 的配色思路）
 *   icon = 16px 线性小图标的形状 key
 */
const CATEGORIES = {
  expense: [
    { name: '餐饮', tint: 'peach', ink: 'brand-orange-deep', icon: 'meal' },
    { name: '交通', tint: 'sky', ink: 'link-blue', icon: 'transport' },
    { name: '购物', tint: 'rose', ink: 'brand-pink-deep', icon: 'shopping' },
    { name: '学习', tint: 'lavender', ink: 'brand-purple-800', icon: 'study' },
    { name: '娱乐', tint: 'yellow', ink: 'brand-brown', icon: 'fun' },
    { name: '医疗', tint: 'mint', ink: 'brand-green', icon: 'medical' },
    { name: '居家', tint: 'cream', ink: 'charcoal', icon: 'home' },
    { name: '人情', tint: 'yellow-bold', ink: 'brand-brown', icon: 'gift' },
    { name: '其他', tint: 'gray', ink: 'slate', icon: 'more' }
  ],
  income: [
    { name: '工资补助', tint: 'mint', ink: 'brand-green', icon: 'salary' },
    { name: '兼职', tint: 'sky', ink: 'link-blue', icon: 'parttime' },
    { name: '奖学金', tint: 'lavender', ink: 'brand-purple-800', icon: 'award' },
    { name: '红包', tint: 'rose', ink: 'brand-pink-deep', icon: 'redpacket' },
    { name: '投资', tint: 'yellow', ink: 'brand-brown', icon: 'invest' },
    { name: '其他', tint: 'gray', ink: 'slate', icon: 'more' }
  ]
};

/** 各类型的默认分类（PRD M2：支出 = 餐饮、收入 = 工资补助） */
const DEFAULT_CATEGORY = { expense: '餐饮', income: '工资补助' };

/** 找不到分类定义时的兜底 */
const FALLBACK_CATEGORY = { tint: 'gray', ink: 'slate', icon: 'more' };

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 图标形状表：只描述几何，不含任何用户数据。
 * 键为形状标签，值为属性表；属性值全部是本文件写死的常量字符串。
 * @type {Record<string, Array<[string, Record<string, string>]>>}
 */
const ICON_SHAPES = {
  meal: [
    ['path', { d: 'M4.25 10.75h15.5a7.75 7.75 0 0 1-15.5 0z' }],
    ['path', { d: 'M3.25 19.75h17.5' }],
    ['path', { d: 'M12 3v3.5' }]
  ],
  transport: [
    ['rect', { x: '5.25', y: '3.75', width: '13.5', height: '12.5', rx: '2.5' }],
    ['path', { d: 'M5.25 10.5h13.5' }],
    ['path', { d: 'M9 20.25h.01M15 20.25h.01' }]
  ],
  shopping: [
    ['path', { d: 'M5.75 8.25h12.5l-1 11.5H6.75z' }],
    ['path', { d: 'M9.25 8.25V6.5a2.75 2.75 0 0 1 5.5 0v1.75' }]
  ],
  study: [
    ['path', { d: 'M4.25 5.75a1.5 1.5 0 0 1 1.5-1.5h13a1.5 1.5 0 0 1 1.5 1.5v12.5a1.5 1.5 0 0 1-1.5 1.5h-13a1.5 1.5 0 0 1-1.5-1.5z' }],
    ['path', { d: 'M12 4.25v15.5' }]
  ],
  fun: [
    ['rect', { x: '2.75', y: '7.75', width: '18.5', height: '8.5', rx: '4.25' }],
    ['path', { d: 'M8 10.75v3M6.5 12.25h3' }],
    ['path', { d: 'M15.75 11.5h.01M17.75 13.5h.01' }]
  ],
  medical: [
    ['rect', { x: '3.25', y: '7.25', width: '17.5', height: '12.5', rx: '2.5' }],
    ['path', { d: 'M9.5 7.25V5.5h5v1.75' }],
    ['path', { d: 'M12 10.75v5M9.5 13.25h5' }]
  ],
  home: [
    ['path', { d: 'M4.25 10.5 12 4.25l7.75 6.25v8.5a1.5 1.5 0 0 1-1.5 1.5H5.75a1.5 1.5 0 0 1-1.5-1.5z' }],
    ['path', { d: 'M10 20.5v-5.75h4v5.75' }]
  ],
  gift: [
    ['rect', { x: '3.75', y: '8.25', width: '16.5', height: '4', rx: '1.5' }],
    ['path', { d: 'M5.25 12.25v6a1.5 1.5 0 0 0 1.5 1.5h10.5a1.5 1.5 0 0 0 1.5-1.5v-6' }],
    ['path', { d: 'M12 8.25v11.5' }],
    ['path', { d: 'M12 8.25S10.75 3.75 8.5 3.75a2.25 2.25 0 0 0 0 4.5zM12 8.25s1.25-4.5 3.5-4.5a2.25 2.25 0 0 1 0 4.5z' }]
  ],
  more: [
    ['circle', { cx: '5.75', cy: '12', r: '1.5' }],
    ['circle', { cx: '12', cy: '12', r: '1.5' }],
    ['circle', { cx: '18.25', cy: '12', r: '1.5' }]
  ],
  salary: [
    ['rect', { x: '3.25', y: '6.25', width: '17.5', height: '11.5', rx: '2.5' }],
    ['circle', { cx: '12', cy: '12', r: '2.5' }],
    ['path', { d: 'M6.75 9.5h.01M17.25 14.5h.01' }]
  ],
  parttime: [
    ['circle', { cx: '12', cy: '12', r: '8.5' }],
    ['path', { d: 'M12 7.5V12l3 2' }]
  ],
  award: [
    ['circle', { cx: '12', cy: '9.5', r: '5.25' }],
    ['path', { d: 'M8.75 14 7.5 20.5l4.5-2.25 4.5 2.25L15.25 14' }]
  ],
  redpacket: [
    ['path', { d: 'M6.25 6.25h11.5a1.5 1.5 0 0 1 1.5 1.5v10.5a1.5 1.5 0 0 1-1.5 1.5H6.25a1.5 1.5 0 0 1-1.5-1.5V7.75a1.5 1.5 0 0 1 1.5-1.5z' }],
    ['path', { d: 'M11 6.25a1 1 0 0 1 2 0v2.5a1 1 0 0 0 1 1h2.5' }]
  ],
  invest: [
    ['path', { d: 'M4.25 16.5 10 10.75l3.5 3.5 6.25-6.25' }],
    ['path', { d: 'M15.5 8h4.25v4.25' }]
  ],
  edit: [
    ['path', { d: 'M4.75 19.25h3.5L19 8.5a1.5 1.5 0 0 0 0-2.12l-1.38-1.38a1.5 1.5 0 0 0-2.12 0L4.75 15.75z' }]
  ],
  trash: [
    ['path', { d: 'M4.75 6.75h14.5' }],
    ['path', { d: 'M9.25 6.75V5a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 .75.75v1.75' }],
    ['path', { d: 'M6.75 6.75l.75 12.5h9l.75-12.5' }]
  ],
  list: [
    ['rect', { x: '3.25', y: '5.75', width: '17.5', height: '12.5', rx: '3' }],
    ['path', { d: 'M3.25 10.25h17.5' }],
    ['path', { d: 'M6.75 14.5h3.5' }]
  ]
};

/**
 * 用 createElementNS 逐节点构造线性图标（不使用 innerHTML）。
 * @param {string} name ICON_SHAPES 的键
 * @param {number} [size] 边长（px）；分类 chip 用 16，列表行用 18
 * @returns {SVGElement}
 */
function createIcon(name, size = 16) {
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

  for (const [tag, attributes] of ICON_SHAPES[name] ?? ICON_SHAPES.more) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}

/**
 * 按类型与分类名取视觉映射。
 * @param {'expense' | 'income'} type
 * @param {string} category
 * @returns {{name?: string, tint: string, ink: string, icon: string}}
 */
function categoryStyle(type, category) {
  const list = CATEGORIES[type] ?? CATEGORIES.expense;
  return list.find((entry) => entry.name === category) ?? FALLBACK_CATEGORY;
}

/* --------------------------------------------------------------------------
 * 模块状态（仅内存）
 * -------------------------------------------------------------------------- */

/** @type {AccountApi | null} */
let api = null;
let mounted = false;

const state = {
  monthKey: currentMonthKey(),
  typeFilter: 'all',
  categoryFilter: 'all',
  accountFilter: 'all',
  keyword: '',
  editingId: null
};

/* --------------------------------------------------------------------------
 * 数据加工（纯函数）
 * -------------------------------------------------------------------------- */

/**
 * 取某月全部流水。
 * @param {object[]} all
 * @param {string} monthKey
 * @returns {object[]}
 */
function transactionsOfMonth(all, monthKey) {
  return all.filter((entry) => localMonthKeyFromIso(entry.date) === monthKey);
}

/**
 * 月度汇总（只看当月全部流水，不受筛选影响）。
 * @param {object[]} monthTransactions
 * @returns {{income: number, expense: number, balance: number}}
 */
function summarize(monthTransactions) {
  let income = 0;
  let expense = 0;
  for (const entry of monthTransactions) {
    const cents = Number.isFinite(entry.amountCents) ? entry.amountCents : 0;
    if (entry.type === 'income') income += cents;
    else expense += cents;
  }
  return { income, expense, balance: income - expense };
}

/**
 * 应用类型 / 分类 / 账户 / 关键词筛选。
 * @param {object[]} monthTransactions
 * @returns {object[]}
 */
function applyFilters(monthTransactions) {
  const keyword = state.keyword.trim().toLowerCase();

  return monthTransactions.filter((entry) => {
    if (state.typeFilter !== 'all' && entry.type !== state.typeFilter) return false;
    if (state.categoryFilter !== 'all' && entry.category !== state.categoryFilter) return false;
    if (state.accountFilter !== 'all' && entry.account !== state.accountFilter) return false;
    if (keyword.length === 0) return true;

    const haystack = [entry.note, entry.category, entry.account]
      .filter((value) => typeof value === 'string')
      .join(' ')
      .toLowerCase();
    return haystack.includes(keyword);
  });
}

/**
 * 按本地日期分组并倒序；组内按时间倒序；同时算出当日支出小计。
 * @param {object[]} list
 * @returns {Array<{dayKey: string, expense: number, items: object[]}>}
 */
function groupByDay(list) {
  /** @type {Map<string, object[]>} */
  const buckets = new Map();
  for (const entry of list) {
    const dayKey = localDayKeyFromIso(entry.date);
    if (!dayKey) continue;
    if (!buckets.has(dayKey)) buckets.set(dayKey, []);
    buckets.get(dayKey).push(entry);
  }

  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dayKey, items]) => {
      const sorted = [...items].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const expense = sorted.reduce(
        (sum, entry) => (entry.type === 'expense' ? sum + (entry.amountCents || 0) : sum),
        0
      );
      return { dayKey, expense, items: sorted };
    });
}

/**
 * 表单原始值 → TransactionData（金额与日期严格校验）。
 * @param {{type: string, amount: string, category: string, account: string, dateTime: string, note: string, tags: string}} form
 * @returns {{ok: true, data: TransactionData} | {ok: false, message: string}}
 */
function buildTransactionData(form) {
  const type = form.type === 'income' ? 'income' : 'expense';
  const allowed = CATEGORIES[type].map((entry) => entry.name);
  const category = allowed.includes(form.category) ? form.category : DEFAULT_CATEGORY[type];

  const amountCents = parseAmountToCents(form.amount);
  if (amountCents === null) {
    return { ok: false, message: '请输入大于 0 的金额，最多两位小数' };
  }

  const date = localInputValueToIso(form.dateTime);
  if (!date) {
    return { ok: false, message: '请选择有效的日期与时间' };
  }

  const account = ACCOUNTS.includes(form.account) ? form.account : ACCOUNTS[0];

  return {
    ok: true,
    data: {
      type,
      amountCents,
      category,
      account,
      date,
      note: typeof form.note === 'string' ? form.note.trim() : '',
      tags: parseTags(form.tags)
    }
  };
}

/**
 * 分 → 金额输入框可编辑文本（不带千分位与货币符号）。
 * @param {number} amountCents
 * @returns {string}
 */
function toAmountInputValue(amountCents) {
  const cents = Number.isFinite(amountCents) ? Math.trunc(amountCents) : 0;
  const absolute = Math.abs(cents);
  return `${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

/* --------------------------------------------------------------------------
 * 记一笔 / 编辑（Modal，DESIGN.md E.1）
 * -------------------------------------------------------------------------- */

/** @type {ReturnType<typeof openModal> | null} */
let activeDialog = null;
/** 仅在 Modal 打开期间有效的表单引用 */
let formRefs = null;

/** 关闭并清理 Modal 状态 */
function closeComposer() {
  const dialog = activeDialog;
  activeDialog = null;
  formRefs = null;
  state.editingId = null;
  dialog?.close();
}

/** 按 dataset.active 刷新分段控件选中态 */
function renderTypeButtons() {
  if (!formRefs) return;
  const active = formRefs.typeRow.dataset.active === 'income' ? 'income' : 'expense';
  for (const button of formRefs.typeRow.querySelectorAll('.lk-segmented-item')) {
    if (!(button instanceof HTMLElement)) continue;
    const isActive = button.dataset.type === active;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
}

/**
 * 渲染分类 chip 网格（随类型切换整套分类）。
 * @param {string} selectedCategory
 */
function renderChips(selectedCategory) {
  if (!formRefs) return;
  const type = formRefs.typeRow.dataset.active === 'income' ? 'income' : 'expense';
  const list = CATEGORIES[type];
  const selected = list.some((entry) => entry.name === selectedCategory)
    ? selectedCategory
    : DEFAULT_CATEGORY[type];

  formRefs.chipGrid.dataset.selected = selected;
  formRefs.chipGrid.replaceChildren();

  for (const entry of list) {
    const chip = /** @type {HTMLButtonElement} */ (
      createEl('button', { className: 'lk-chip', type: 'button' })
    );
    chip.dataset.category = entry.name;
    chip.dataset.tint = entry.tint;
    chip.dataset.ink = entry.ink;
    chip.setAttribute('role', 'radio');
    const isActive = entry.name === selected;
    chip.classList.toggle('is-active', isActive);
    chip.setAttribute('aria-checked', isActive ? 'true' : 'false');
    chip.append(createIcon(entry.icon, 16), createEl('span', { text: entry.name }));
    formRefs.chipGrid.append(chip);
  }
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
 * 打开「记一笔 / 编辑」Modal。
 * @param {object | null} [editing] 传入流水即为编辑模式
 */
function openComposer(editing = null) {
  state.editingId = editing ? String(editing.id) : null;
  const initialType = editing?.type === 'income' ? 'income' : 'expense';

  const form = /** @type {HTMLFormElement} */ (
    createEl('form', { className: 'lk-form', id: 'tx-form' })
  );
  form.noValidate = true;

  /* 类型：分段控件（DESIGN.md segmented-tab） */
  const typeRow = createEl('div', { className: 'lk-segmented', id: 'tx-type', role: 'tablist' });
  typeRow.setAttribute('aria-label', '类型');
  typeRow.dataset.active = initialType;
  for (const type of TYPES) {
    const button = /** @type {HTMLButtonElement} */ (
      createEl('button', { className: 'lk-segmented-item', text: type.label, type: 'button' })
    );
    button.dataset.type = type.value;
    typeRow.append(button);
  }

  /* 金额：前缀 ¥ + inputmode=decimal */
  const amountWrap = createEl('div', { className: 'lk-input-affix' });
  const amountInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'tx-amount', type: 'text' })
  );
  amountInput.setAttribute('inputmode', 'decimal');
  amountInput.setAttribute('autocomplete', 'off');
  amountInput.setAttribute('placeholder', '0.00');
  amountWrap.append(createEl('span', { className: 'lk-input-prefix', text: '¥' }), amountInput);

  /* 分类：chip 网格 */
  const chipGrid = createEl('div', { className: 'lk-chip-grid', id: 'tx-category' });
  chipGrid.setAttribute('role', 'radiogroup');
  chipGrid.setAttribute('aria-label', '分类');
  const categoryField = createEl('div', { className: 'lk-field' });
  categoryField.append(createEl('span', { className: 'lk-field-label', text: '分类' }), chipGrid);

  /* 日期时间 + 快捷值 */
  const dateInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'tx-date', type: 'datetime-local' })
  );
  const dateField = createField({ id: 'tx-date', label: '日期时间', control: dateInput });
  const quickRow = createEl('div', { className: 'lk-quick-row' });
  for (const quick of [
    { label: '此刻', dayOffset: 0, atMidnight: false },
    { label: '今天 00:00', dayOffset: 0, atMidnight: true },
    { label: '昨天 00:00', dayOffset: -1, atMidnight: true }
  ]) {
    const button = /** @type {HTMLButtonElement} */ (
      createEl('button', { className: 'lk-quick-btn', text: quick.label, type: 'button' })
    );
    button.dataset.dayOffset = String(quick.dayOffset);
    button.dataset.atMidnight = quick.atMidnight ? '1' : '0';
    quickRow.append(button);
  }
  dateField.append(quickRow);

  /* 账户 */
  const accountSelect = /** @type {HTMLSelectElement} */ (
    createEl('select', { className: 'lk-select', id: 'tx-account' })
  );
  for (const account of ACCOUNTS) {
    const option = /** @type {HTMLOptionElement} */ (createEl('option', { text: account }));
    option.value = account;
    accountSelect.append(option);
  }

  /* 备注 */
  const noteInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'tx-note', type: 'text' })
  );
  noteInput.setAttribute('autocomplete', 'off');
  noteInput.setAttribute('placeholder', '选填');

  /* 标签 */
  const tagsInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'tx-tags', type: 'text' })
  );
  tagsInput.setAttribute('autocomplete', 'off');
  tagsInput.setAttribute('placeholder', '用逗号分隔，如：校园，聚餐');

  const grid = createEl('div', { className: 'lk-form-grid' });
  grid.append(
    createField({ id: 'tx-account', label: '账户', control: accountSelect }),
    createField({ id: 'tx-note', label: '备注', control: noteInput }),
    createField({ id: 'tx-tags', label: '标签', control: tagsInput })
  );

  form.append(
    typeRow,
    createField({ id: 'tx-amount', label: '金额', control: amountWrap }),
    categoryField,
    dateField,
    grid
  );

  formRefs = { form, typeRow, amountInput, chipGrid, dateInput, accountSelect, noteInput, tagsInput };

  /* 预填 */
  renderTypeButtons();
  renderChips(editing?.category ?? DEFAULT_CATEGORY[initialType]);
  amountInput.value = editing ? toAmountInputValue(editing.amountCents) : '';
  dateInput.value = editing
    ? isoToLocalInputValue(editing.date)
    : isoToLocalInputValue(localDateToIso(new Date()));
  const accountValue =
    typeof editing?.account === 'string' && ACCOUNTS.includes(editing.account)
      ? editing.account
      : ACCOUNTS[0];
  accountSelect.value = accountValue;
  noteInput.value = typeof editing?.note === 'string' ? editing.note : '';
  tagsInput.value = Array.isArray(editing?.tags) ? editing.tags.join('，') : '';

  /* 交互 */
  typeRow.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('.lk-segmented-item');
    if (!(button instanceof HTMLElement) || !button.dataset.type) return;
    const nextType = button.dataset.type === 'income' ? 'income' : 'expense';
    if (!formRefs || formRefs.typeRow.dataset.active === nextType) return;
    formRefs.typeRow.dataset.active = nextType;
    renderTypeButtons();
    // 切换类型后分类回到该类型的默认值（两套分类名不通用）
    renderChips(DEFAULT_CATEGORY[nextType]);
    activeDialog?.setError('');
  });

  chipGrid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const chip = target.closest('.lk-chip');
    if (!(chip instanceof HTMLElement) || !chip.dataset.category) return;
    renderChips(chip.dataset.category);
    activeDialog?.setError('');
  });

  quickRow.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('.lk-quick-btn');
    if (!(button instanceof HTMLElement) || !formRefs) return;
    const base = new Date();
    const dayOffset = Number(button.dataset.dayOffset ?? '0');
    if (dayOffset !== 0) base.setDate(base.getDate() + dayOffset);
    if (button.dataset.atMidnight === '1') base.setHours(0, 0, 0, 0);
    formRefs.dateInput.value = isoToLocalInputValue(localDateToIso(base));
    activeDialog?.setError('');
  });

  amountInput.addEventListener('input', () => activeDialog?.setError(''));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitComposer();
  });

  activeDialog = openModal({
    title: editing ? '编辑流水' : '记一笔',
    subtitle: editing ? '修改后立即生效' : '金额按「分」存储，不会出现浮点误差',
    bodyChildren: [form],
    actions: [
      { label: '取消', variant: 'secondary', onClick: () => closeComposer() },
      {
        label: editing ? '保存修改' : '保存',
        variant: 'primary',
        onClick: () => form.requestSubmit()
      }
    ],
    onClose: () => {
      activeDialog = null;
      formRefs = null;
      state.editingId = null;
    }
  });

  amountInput.focus();
}

/** 提交 Modal：校验 → 落盘 → 刷新 */
async function submitComposer() {
  if (!formRefs || !api) return;

  const built = buildTransactionData({
    type: formRefs.typeRow.dataset.active === 'income' ? 'income' : 'expense',
    amount: formRefs.amountInput.value,
    category: formRefs.chipGrid.dataset.selected ?? DEFAULT_CATEGORY.expense,
    account: formRefs.accountSelect.value,
    dateTime: formRefs.dateInput.value,
    note: formRefs.noteInput.value,
    tags: formRefs.tagsInput.value
  });

  if (!built.ok) {
    // 校验失败：不关闭弹窗、不落盘
    activeDialog?.setError(built.message);
    return;
  }

  const editingId = state.editingId;
  try {
    if (editingId) {
      await api.updateTransaction(editingId, built.data);
      closeComposer();
      api.notify('已保存修改', { type: 'success' });
    } else {
      await api.addTransaction(built.data);
      closeComposer();
      api.notify('已记一笔', { type: 'success' });
    }
    await render();
  } catch (error) {
    activeDialog?.setError(`保存失败：${error?.message ?? '未知错误'}`);
  }
}

/* --------------------------------------------------------------------------
 * 列表渲染（DESIGN.md C）
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
 * 行内次值：当天时间 HH:mm。
 * @param {string} iso
 * @returns {string}
 */
function formatRowTime(iso) {
  const value = isoToLocalInputValue(iso);
  return value ? value.slice(11, 16) : '';
}

/**
 * 创建一行流水。
 * @param {object} entry
 * @returns {HTMLElement}
 */
function createTransactionRow(entry) {
  const type = entry.type === 'income' ? 'income' : 'expense';
  const style = categoryStyle(type, entry.category);
  const isIncome = type === 'income';

  const row = createEl('div', { className: 'lk-row' });
  row.dataset.id = String(entry.id);
  row.dataset.type = type;

  const iconBox = createEl('div', { className: 'lk-row-icon' });
  iconBox.dataset.tint = style.tint;
  iconBox.dataset.ink = style.ink;
  iconBox.append(createIcon(style.icon, 18));

  const main = createEl('div', { className: 'lk-row-main' });
  const title = createEl('span', { className: 'lk-row-title' });
  title.textContent =
    typeof entry.note === 'string' && entry.note.length > 0
      ? `${entry.category} · ${entry.note}`
      : String(entry.category);
  const subtitle = createEl('span', { className: 'lk-row-subtitle' });
  subtitle.textContent = [entry.account, ...(Array.isArray(entry.tags) ? entry.tags : [])]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .join(' · ');
  main.append(title, subtitle);

  const aside = createEl('div', { className: 'lk-row-aside' });
  const amount = createEl('span', { className: 'lk-row-amount' });
  amount.classList.add(isIncome ? 'is-income' : 'is-expense');
  amount.textContent = `${isIncome ? '+' : '-'}${formatCurrency(entry.amountCents)}`;
  aside.append(amount, createEl('span', { className: 'lk-row-time', text: formatRowTime(entry.date) }));

  const actions = createEl('div', { className: 'lk-row-actions' });
  for (const action of [
    { key: 'edit', icon: 'edit', label: `编辑 ${entry.category}` },
    { key: 'delete', icon: 'trash', label: `删除 ${entry.category}` }
  ]) {
    const button = /** @type {HTMLButtonElement} */ (
      createEl('button', { className: 'lk-icon-btn lk-icon-btn-sm', type: 'button' })
    );
    button.dataset.action = action.key;
    button.dataset.id = String(entry.id);
    button.setAttribute('aria-label', action.label);
    button.append(
      createIcon(action.icon, 16),
      createEl('span', { className: 'lk-sr-only', text: action.label })
    );
    actions.append(button);
  }

  row.append(iconBox, main, aside, actions);
  return row;
}

/**
 * 创建一天的分组。
 * @param {{dayKey: string, expense: number, items: object[]}} group
 * @returns {HTMLElement}
 */
function createDayGroup(group) {
  const wrapper = createEl('section', { className: 'lk-day-group' });
  const head = createEl('div', { className: 'lk-day-head' });
  head.append(
    createEl('span', { className: 'lk-day-title', text: formatDayGroupTitle(group.dayKey) }),
    createEl('span', {
      className: 'lk-day-subtotal',
      text: group.expense > 0 ? `支出 ${formatCurrency(group.expense)}` : ''
    })
  );

  const rows = createEl('div', { className: 'lk-row-list' });
  for (const entry of group.items) rows.append(createTransactionRow(entry));

  wrapper.append(head, rows);
  return wrapper;
}

/**
 * 描述当前生效的筛选条件（用于无结果提示）。
 * @returns {string}
 */
function describeFilters() {
  const parts = [];
  if (state.typeFilter !== 'all') parts.push(`类型=${TYPE_LABEL[state.typeFilter]}`);
  if (state.categoryFilter !== 'all') parts.push(`分类=${state.categoryFilter}`);
  if (state.accountFilter !== 'all') parts.push(`账户=${state.accountFilter}`);
  if (state.keyword.trim().length > 0) parts.push(`关键词「${state.keyword.trim()}」`);
  return parts.length > 0 ? parts.join('，') : '无';
}

/**
 * 渲染整页：汇总条 + 工具行 + 分组列表。
 */
async function render() {
  if (!api) return;

  const all = await api.getTransactions();
  const monthTransactions = transactionsOfMonth(all, state.monthKey);
  const summary = summarize(monthTransactions);
  const groups = groupByDay(applyFilters(monthTransactions));

  setText(byId('account-summary-income'), formatCurrency(summary.income));
  setText(byId('account-summary-expense'), formatCurrency(summary.expense));
  setText(byId('account-summary-balance'), formatCurrency(summary.balance));
  setText(byId('account-month-label'), formatMonthKeyText(state.monthKey));

  byId('account-month-current')?.classList.toggle('is-active', state.monthKey === currentMonthKey());

  fillSelect(
    /** @type {HTMLSelectElement | null} */ (byId('account-filter-category')),
    [
      { value: 'all', label: '全部分类' },
      ...CATEGORIES.expense.map((entry) => ({ value: entry.name, label: `支出 · ${entry.name}` })),
      ...CATEGORIES.income.map((entry) => ({ value: entry.name, label: `收入 · ${entry.name}` }))
    ],
    state.categoryFilter
  );

  fillSelect(
    /** @type {HTMLSelectElement | null} */ (byId('account-filter-account')),
    [{ value: 'all', label: '全部账户' }, ...ACCOUNTS.map((name) => ({ value: name, label: name }))],
    state.accountFilter
  );

  for (const button of document.querySelectorAll('[data-type-filter]')) {
    if (!(button instanceof HTMLElement)) continue;
    button.classList.toggle('is-active', button.dataset.typeFilter === state.typeFilter);
  }

  const listRoot = byId('account-list');
  const emptyRoot = byId('account-empty');
  const hintRoot = byId('account-filter-hint');
  if (!listRoot || !emptyRoot) return;

  listRoot.replaceChildren();

  if (groups.length === 0) {
    listRoot.hidden = true;
    emptyRoot.hidden = false;

    const monthHasData = monthTransactions.length > 0;
    setText(byId('account-empty-title'), monthHasData ? '没有符合条件的流水' : '本月还没有流水');
    setText(
      byId('account-empty-desc'),
      monthHasData
        ? '试着放宽筛选条件，或切换到其它月份查看。'
        : '点击右上角「记一笔」，开始记录第一笔收支。'
    );
    // 只有「本月确实没有数据」时才引导去记一笔；纯筛选无结果时隐藏该按钮
    const emptyAction = byId('account-empty-action');
    if (emptyAction) emptyAction.hidden = monthHasData;
    setText(hintRoot, monthHasData ? `当前筛选：${describeFilters()}` : '');
    return;
  }

  listRoot.hidden = false;
  emptyRoot.hidden = true;
  setText(hintRoot, '');

  const fragment = document.createDocumentFragment();
  for (const group of groups) fragment.append(createDayGroup(group));
  listRoot.append(fragment);
}

/* --------------------------------------------------------------------------
 * 事件
 * -------------------------------------------------------------------------- */

/**
 * 行内「编辑 / 删除」。
 * @param {Event} event
 */
async function onListClick(event) {
  const target = event.target;
  if (!(target instanceof Element) || !api) return;
  const button = target.closest('[data-action]');
  if (!(button instanceof HTMLElement)) return;

  const id = button.dataset.id ?? '';
  if (!id) return;

  const all = await api.getTransactions();
  const entry = all.find((item) => String(item.id) === id);

  if (button.dataset.action === 'edit') {
    if (!entry) {
      api.notify('这条流水已不存在', { type: 'error' });
      await render();
      return;
    }
    openComposer(entry);
    return;
  }

  if (button.dataset.action === 'delete') {
    if (!entry) return;
    openConfirmDialog({
      title: '删除这条流水',
      subtitle: '删除后无法恢复',
      message: `${entry.category} ${formatCurrency(entry.amountCents)}（${entry.account ?? '未填账户'}）`,
      confirmLabel: '删除',
      variant: 'danger',
      onConfirm: async () => {
        await api.removeTransaction(id);
        api.notify('已删除', { type: 'success' });
        await render();
      }
    });
  }
}

/**
 * 打开原生月份选择器。
 * 优先用 input.showPicker()（需用户激活，由按钮点击提供）；
 * 浏览器不支持或调用失败时回退为对该 input 的 click。
 * @param {HTMLInputElement} input
 */
function pickMonth(input) {
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker();
      return;
    } catch {
      // 落到下面的 click 回退（例如浏览器判定缺少用户激活）
    }
  }
  try {
    input.focus({ preventScroll: true });
    input.click();
  } catch {
    // 两条路径都不可用时保持静默：用户仍可用 < > 与「本月」按钮翻月
  }
}

/**
 * 绑定月份按钮与隐藏的 input[type=month]。
 * 每次打开前把 input 的值同步为当前查看月份；
 * 选中后清空，保证「再次选择同一个月」也会触发 change。
 */
function bindMonthPicker() {
  const button = byId('account-month-button');
  const input = /** @type {HTMLInputElement | null} */ (byId('account-month-input'));
  if (!button || !input) return;

  button.addEventListener('click', () => {
    // 同步当前查看月份：设值不触发 change，因此不会造成重复渲染
    input.value = state.monthKey;
    pickMonth(input);
  });

  input.addEventListener('change', async () => {
    const picked = input.value;
    input.value = '';
    // 只接受合法的 YYYY-MM；月份的切换沿用现有渲染路径，筛选条件按既有规则保留
    if (!/^\d{4}-\d{2}$/.test(picked)) return;
    if (picked === state.monthKey) return;
    state.monthKey = picked;
    await render();
  });
}
/** 绑定工具行、筛选项与列表事件委托 */
function bindToolbar() {
  byId('account-add-button')?.addEventListener('click', () => openComposer());
  byId('account-empty-action')?.addEventListener('click', () => openComposer());

  byId('account-month-prev')?.addEventListener('click', async () => {
    state.monthKey = shiftMonthKey(state.monthKey, -1);
    await render();
  });
  byId('account-month-next')?.addEventListener('click', async () => {
    state.monthKey = shiftMonthKey(state.monthKey, 1);
    await render();
  });
  byId('account-month-current')?.addEventListener('click', async () => {
    state.monthKey = currentMonthKey();
    await render();
  });

  bindMonthPicker();

  for (const button of document.querySelectorAll('[data-type-filter]')) {
    button.addEventListener('click', async () => {
      if (!(button instanceof HTMLElement) || !button.dataset.typeFilter) return;
      state.typeFilter = button.dataset.typeFilter;
      await render();
    });
  }

  const categorySelect = /** @type {HTMLSelectElement | null} */ (byId('account-filter-category'));
  categorySelect?.addEventListener('change', async () => {
    state.categoryFilter = categorySelect.value;
    await render();
  });

  const accountSelect = /** @type {HTMLSelectElement | null} */ (byId('account-filter-account'));
  accountSelect?.addEventListener('change', async () => {
    state.accountFilter = accountSelect.value;
    await render();
  });

  const searchInput = /** @type {HTMLInputElement | null} */ (byId('account-search'));
  searchInput?.addEventListener('input', async () => {
    state.keyword = searchInput.value;
    await render();
  });

  byId('account-list')?.addEventListener('click', (event) => {
    void onListClick(event);
  });
}

/* --------------------------------------------------------------------------
 * 对外入口
 * -------------------------------------------------------------------------- */

/**
 * 装配日常收支模块（由 main.js 注入数据与提示能力）。
 * @param {AccountApi} injectedApi
 */
export function mountAccount(injectedApi) {
  if (mounted) return;
  mounted = true;
  api = injectedApi;

  state.monthKey = currentMonthKey();
  bindToolbar();
  void render();
}

/**
 * 锁定 / 清空数据后重置内存状态；重新解锁时由 main.js 再次调用 render。
 */
export function resetAccount() {
  state.monthKey = currentMonthKey();
  state.typeFilter = 'all';
  state.categoryFilter = 'all';
  state.accountFilter = 'all';
  state.keyword = '';
  state.editingId = null;

  const searchInput = /** @type {HTMLInputElement | null} */ (byId('account-search'));
  if (searchInput) searchInput.value = '';
}

/** 重新渲染当前页面（`render` 不在外部使用，仅为保持模块自洽而保留此说明） */
export { render as renderAccount };
