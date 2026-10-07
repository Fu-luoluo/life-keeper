/* ==========================================================================
 * js/modules/items.js — M4 重要物品台账
 * --------------------------------------------------------------------------
 * 本阶段范围：添加 / 编辑（Modal，DESIGN.md E.1，宽 480px）+ 列表（按分类分组、可折叠）
 *   + 搜索 / 分类筛选 / 状态筛选 + 顶部小统计条（本页专用，v0.7 再接入仪表盘）。
 * 明确不做：图片附件、仪表盘改动。
 *
 * 分层约定（与 settings / account / diary 同一注入模式）：
 *   - 本模块 **不 import storage.js / main.js**，数据与提示能力全部由 main.js 注入；
 *   - 本文件无 innerHTML / outerHTML / insertAdjacentHTML：文本一律 textContent，
 *     图标一律 createElementNS 逐节点构造（几何属性来自文件内常量表，不含用户输入）；
 *   - id / createdAt / updatedAt 由 storage 层维护，本模块不生成、不改写。
 *
 * 视觉依据：DESIGN.md C（列表行）、E.1（Modal）、E.3（空状态）、H（交互状态）。
 * ========================================================================== */

import { byId, createEl, openConfirmDialog, openModal, setText } from '../lib/dom.js';
import {
  EXPIRING_WINDOW_DAYS,
  addYearsToDate,
  parseTags,
  warrantyStatus
} from '../lib/utils.js';

/**
 * @typedef {object} ItemData
 * @property {string} name
 * @property {string} category
 * @property {string} location
 * @property {number} quantity
 * @property {string | null} purchaseDate
 * @property {string | null} warrantyUntil
 * @property {string} note
 * @property {string[]} tags
 */

/**
 * @typedef {object} ItemsApi
 * @property {() => Promise<object[]>} getItems
 * @property {(data: ItemData) => Promise<object>} addItem
 * @property {(id: string, patch: ItemData) => Promise<object>} updateItem
 * @property {(id: string) => Promise<boolean>} removeItem
 * @property {(message: string, options?: {type?: 'success' | 'error' | 'neutral'}) => void} notify
 */

/* --------------------------------------------------------------------------
 * 常量
 * -------------------------------------------------------------------------- */

/** 编辑器宽度：DESIGN.md E.1 表单类默认 480px */
const EDITOR_WIDTH_PX = 480;

/**
 * 分类定义：tint = 图标容器底色（{colors.card-tint-*}），
 * ink = 图标颜色（只用 DESIGN.md 已定义的深色 Token）。
 */
const CATEGORIES = [
  { name: '证件', tint: 'lavender', ink: 'brand-purple-800', icon: 'card' },
  { name: '电子设备', tint: 'sky', ink: 'link-blue', icon: 'device' },
  { name: '钥匙箱包', tint: 'peach', ink: 'brand-orange-deep', icon: 'key' },
  { name: '文件资料', tint: 'cream', ink: 'charcoal', icon: 'folder' },
  { name: '首饰贵重', tint: 'rose', ink: 'brand-pink-deep', icon: 'gem' },
  { name: '其他', tint: 'gray', ink: 'slate', icon: 'box' }
];

const DEFAULT_CATEGORY = '证件';
const CATEGORY_BY_NAME = new Map(CATEGORIES.map((entry) => [entry.name, entry]));
const FALLBACK_CATEGORY = CATEGORY_BY_NAME.get('其他');

/** 常用存放位置（PRD F4-2：点击填入后仍可继续补充细节） */
const COMMON_LOCATIONS = ['书桌左抽屉', '书桌右抽屉', '卧室衣柜', '文件柜', '老家', '其他'];

/** 保修快捷年限 */
const WARRANTY_YEAR_PRESETS = [1, 2, 3];

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 图标形状表（24 网格、1.6 描边）。
 * @type {Record<string, Array<[string, Record<string, string>]>>}
 */
const ICON_SHAPES = {
  card: [
    ['rect', { x: '3.25', y: '5.25', width: '17.5', height: '13.5', rx: '2.5' }],
    ['circle', { cx: '9.25', cy: '10.5', r: '2' }],
    ['path', { d: 'M5.75 16.25c.85-1.5 2-2.25 3.5-2.25s2.65.75 3.5 2.25' }],
    ['path', { d: 'M15.75 10.25h3M15.75 13.25h3' }]
  ],
  device: [
    ['rect', { x: '6.25', y: '3.25', width: '11.5', height: '17.5', rx: '2' }],
    ['path', { d: 'M10.5 17.5h3' }]
  ],
  key: [
    ['circle', { cx: '8.25', cy: '12', r: '4.25' }],
    ['path', { d: 'M12.5 12h7.25' }],
    ['path', { d: 'M17.25 12v3' }],
    ['path', { d: 'M19.75 12v2' }]
  ],
  folder: [
    ['path', { d: 'M3.75 7.25a2 2 0 0 1 2-2h3.4l1.9 2.25h7.2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2z' }],
    ['path', { d: 'M3.75 11h16.5' }]
  ],
  gem: [
    ['path', { d: 'M7.25 4.75h9.5l3.25 4.5L12 19.25 4 9.25z' }],
    ['path', { d: 'M4 9.25h16' }],
    ['path', { d: 'M9.75 4.75 12 9.25l2.25-4.5' }]
  ],
  box: [
    ['path', { d: 'M3.25 7.75 12 3.5l8.75 4.25L12 12z' }],
    ['path', { d: 'M3.25 7.75V16L12 20.5l8.75-4.5V7.75' }],
    ['path', { d: 'M12 12v8.5' }]
  ],
  pin: [
    ['path', { d: 'M12 20.5s6-5.25 6-10a6 6 0 1 0-12 0c0 4.75 6 10 6 10z' }],
    ['circle', { cx: '12', cy: '10.25', r: '2.25' }]
  ],
  edit: [
    ['path', { d: 'M4.75 19.25h3.5L19 8.5a1.5 1.5 0 0 0 0-2.12l-1.38-1.38a1.5 1.5 0 0 0-2.12 0L4.75 15.75z' }]
  ],
  trash: [
    ['path', { d: 'M4.75 6.75h14.5' }],
    ['path', { d: 'M9.25 6.75V5a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 .75.75v1.75' }],
    ['path', { d: 'M6.75 6.75l.75 12.5h9l.75-12.5' }]
  ],
  chevron: [['path', { d: 'M9.25 6.5 15 12l-5.75 5.5' }]]
};

/**
 * 用 createElementNS 逐节点构造线性图标（不使用 innerHTML）。
 * @param {string} name
 * @param {number} [size]
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

  for (const [tag, attributes] of ICON_SHAPES[name] ?? ICON_SHAPES.box) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}

/* --------------------------------------------------------------------------
 * 模块状态（仅内存）
 * -------------------------------------------------------------------------- */

/** @type {ItemsApi | null} */
let api = null;
let mounted = false;

const state = {
  keyword: '',
  categoryFilter: 'all',
  statusFilter: 'all',
  editingId: null,
  /** 被用户折叠的分类名（默认全部展开） */
  collapsed: new Set()
};

/* --------------------------------------------------------------------------
 * 数据加工（纯函数）
 * -------------------------------------------------------------------------- */

/**
 * 取本地当天日期键（YYYY-MM-DD）。
 * @returns {string}
 */
function todayKey() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * 取物品的保修状态（无日期时 status 为 null）。
 * @param {object} item
 * @returns {{status: 'EXPIRED' | 'EXPIRING' | null, days: number | null}}
 */
function itemWarrantyStatus(item) {
  return warrantyStatus(item?.warrantyUntil ?? null, todayKey());
}

/**
 * 统计条数字：总数 / 临期 / 过期（只统计全部物品，不受筛选影响）。
 * @param {object[]} list
 * @returns {{total: number, expiring: number, expired: number}}
 */
function summarize(list) {
  let expiring = 0;
  let expired = 0;
  for (const item of list) {
    const { status } = itemWarrantyStatus(item);
    if (status === 'EXPIRED') expired += 1;
    else if (status === 'EXPIRING') expiring += 1;
  }
  return { total: list.length, expiring, expired };
}

/**
 * 搜索（名称 / 存放位置 / 备注）+ 分类筛选 + 保修状态筛选。
 * @param {object[]} list
 * @returns {object[]}
 */
function applyFilters(list) {
  const keyword = state.keyword.trim().toLowerCase();

  return list.filter((item) => {
    if (state.categoryFilter !== 'all' && item.category !== state.categoryFilter) return false;

    if (state.statusFilter !== 'all') {
      const { status } = itemWarrantyStatus(item);
      if (status !== state.statusFilter) return false;
    }

    if (keyword.length === 0) return true;
    const haystack = [item.name, item.location, item.note]
      .filter((value) => typeof value === 'string')
      .join('\n')
      .toLowerCase();
    return haystack.includes(keyword);
  });
}

/**
 * 按分类分组：固定分类顺序（CATEGORIES 的次序），组内按名称排序。
 * @param {object[]} list
 * @returns {Array<{category: string, items: object[]}>}
 */
function groupByCategory(list) {
  /** @type {Map<string, object[]>} */
  const buckets = new Map();
  for (const item of list) {
    const category = CATEGORY_BY_NAME.has(item.category) ? item.category : '其他';
    if (!buckets.has(category)) buckets.set(category, []);
    buckets.get(category).push(item);
  }

  return CATEGORIES.filter((entry) => buckets.has(entry.name)).map((entry) => ({
    category: entry.name,
    items: [...buckets.get(entry.name)].sort((a, b) =>
      String(a.name ?? '').localeCompare(String(b.name ?? ''), 'zh-Hans-CN')
    )
  }));
}

/**
 * 表单原始值 → ItemData。
 * @param {{name: string, category: string, location: string, quantity: string, purchaseDate: string, warrantyUntil: string, note: string, tags: string}} form
 * @returns {{ok: true, data: ItemData} | {ok: false, message: string}}
 */
function buildItemData(form) {
  const name = typeof form.name === 'string' ? form.name.trim() : '';
  if (name.length === 0) {
    return { ok: false, message: '请填写物品名称' };
  }

  const category = CATEGORY_BY_NAME.has(form.category) ? form.category : DEFAULT_CATEGORY;

  // 数量：整数、最小 1；非法输入回退 1 而不是报错（数量不是关键字段）
  const parsedQuantity = Number.parseInt(String(form.quantity).trim(), 10);
  const quantity = Number.isFinite(parsedQuantity) && parsedQuantity >= 1 ? parsedQuantity : 1;

  const purchaseDate = normalizeDateInput(form.purchaseDate);
  const warrantyUntil = normalizeDateInput(form.warrantyUntil);
  if (form.warrantyUntil && !warrantyUntil) {
    return { ok: false, message: '保修截止日期格式不正确' };
  }
  if (form.purchaseDate && !purchaseDate) {
    return { ok: false, message: '购买日期格式不正确' };
  }

  return {
    ok: true,
    data: {
      name,
      category,
      location: typeof form.location === 'string' ? form.location.trim() : '',
      quantity,
      purchaseDate,
      warrantyUntil,
      note: typeof form.note === 'string' ? form.note.trim() : '',
      tags: parseTags(form.tags)
    }
  };
}

/**
 * date 输入的原始值 → YYYY-MM-DD 或 null（空值即未填写）。
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeDateInput(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

/* --------------------------------------------------------------------------
 * 添加 / 编辑（Modal，DESIGN.md E.1）
 * -------------------------------------------------------------------------- */

/** @type {ReturnType<typeof openModal> | null} */
let activeDialog = null;
/** 仅在 Modal 打开期间有效的表单引用 */
let formRefs = null;

/** 关闭并清理 Modal 状态 */
function closeEditor() {
  const dialog = activeDialog;
  activeDialog = null;
  formRefs = null;
  state.editingId = null;
  dialog?.close();
}

/** 刷新分类 chip 的选中态 */
function renderCategoryChips() {
  if (!formRefs) return;
  for (const chip of formRefs.chipGrid.querySelectorAll('.lk-chip')) {
    if (!(chip instanceof HTMLElement)) continue;
    const isActive = chip.dataset.category === formRefs.categoryValue;
    chip.classList.toggle('is-active', isActive);
    chip.setAttribute('aria-checked', isActive ? 'true' : 'false');
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
 * 打开「添加 / 编辑物品」Modal。
 * @param {object | null} [editing]
 */
function openEditor(editing = null) {
  state.editingId = editing ? String(editing.id) : null;

  const form = /** @type {HTMLFormElement} */ (
    createEl('form', { className: 'lk-form', id: 'item-form' })
  );
  form.noValidate = true;

  /* 名称（必填） */
  const nameInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'item-name', type: 'text' })
  );
  nameInput.setAttribute('autocomplete', 'off');
  nameInput.setAttribute('placeholder', '如：身份证、相机');
  nameInput.required = true;

  /* 分类 chip 网格 */
  const chipGrid = createEl('div', { className: 'lk-chip-grid', id: 'item-category' });
  chipGrid.setAttribute('role', 'radiogroup');
  chipGrid.setAttribute('aria-label', '分类');
  for (const entry of CATEGORIES) {
    const chip = /** @type {HTMLButtonElement} */ (
      createEl('button', { className: 'lk-chip', type: 'button' })
    );
    chip.dataset.category = entry.name;
    chip.dataset.tint = entry.tint;
    chip.dataset.ink = entry.ink;
    chip.setAttribute('role', 'radio');
    chip.append(createIcon(entry.icon, 16), createEl('span', { text: entry.name }));
    chipGrid.append(chip);
  }

  /* 存放位置：常用位置快捷 chips + 可自由编辑的输入框 */
  const locationInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'item-location', type: 'text' })
  );
  locationInput.setAttribute('autocomplete', 'off');
  locationInput.setAttribute('placeholder', '如：书桌左抽屉 · 蓝色文件袋');
  const quickRow = createEl('div', { className: 'lk-quick-row' });
  for (const location of COMMON_LOCATIONS) {
    const button = /** @type {HTMLButtonElement} */ (
      createEl('button', { className: 'lk-quick-btn', text: location, type: 'button' })
    );
    button.dataset.location = location;
    quickRow.append(button);
  }

  /* 数量 */
  const quantityInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'item-quantity', type: 'number' })
  );
  quantityInput.min = '1';
  quantityInput.step = '1';
  quantityInput.value = '1';

  /* 购买日期 */
  const purchaseInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'item-purchase', type: 'date' })
  );

  /* 保修截止 + 快捷 +1/+2/+3 年 */
  const warrantyInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'item-warranty', type: 'date' })
  );
  const warrantyQuick = createEl('div', { className: 'lk-quick-row' });
  for (const years of WARRANTY_YEAR_PRESETS) {
    const button = /** @type {HTMLButtonElement} */ (
      createEl('button', { className: 'lk-quick-btn', text: `+${years}年`, type: 'button' })
    );
    button.dataset.years = String(years);
    warrantyQuick.append(button);
  }

  /* 备注 */
  const noteInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'item-note', type: 'text' })
  );
  noteInput.setAttribute('autocomplete', 'off');
  noteInput.setAttribute('placeholder', '选填');

  /* 标签 */
  const tagsInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'item-tags', type: 'text' })
  );
  tagsInput.setAttribute('autocomplete', 'off');
  tagsInput.setAttribute('placeholder', '用逗号分隔，如：重要，随身');

  formRefs = {
    form,
    nameInput,
    chipGrid,
    categoryValue: editing?.category && CATEGORY_BY_NAME.has(editing.category) ? editing.category : DEFAULT_CATEGORY,
    locationInput,
    quantityInput,
    purchaseInput,
    warrantyInput,
    noteInput,
    tagsInput
  };

  /* 组装 */
  const locationField = createEl('div', { className: 'lk-field' });
  const locationLabel = createEl('span', { className: 'lk-field-label', text: '存放位置' });
  const quickLabel = createEl('span', { className: 'lk-quick-hint', text: '常用位置' });
  locationField.append(locationLabel, quickLabel, quickRow, locationInput);

  const categoryField = createEl('div', { className: 'lk-field' });
  categoryField.append(createEl('span', { className: 'lk-field-label', text: '分类' }), chipGrid);

  const warrantyField = createField({ id: 'item-warranty', label: '保修截止', control: warrantyInput });
  warrantyField.append(
    createEl('span', {
      className: 'lk-quick-hint',
      text: `按购买日期快速推算（无购买日期则按今天）；截止前 ${EXPIRING_WINDOW_DAYS} 天内会标记临期`
    }),
    warrantyQuick
  );

  const grid = createEl('div', { className: 'lk-form-grid' });
  grid.append(
    createField({ id: 'item-quantity', label: '数量', control: quantityInput }),
    createField({ id: 'item-purchase', label: '购买日期（选填）', control: purchaseInput }),
    createField({ id: 'item-note', label: '备注', control: noteInput }),
    createField({ id: 'item-tags', label: '标签', control: tagsInput })
  );

  form.append(
    createField({ id: 'item-name', label: '名称', control: nameInput }),
    categoryField,
    locationField,
    grid,
    warrantyField
  );

  /* 预填 */
  renderCategoryChips();
  if (editing) {
    nameInput.value = typeof editing.name === 'string' ? editing.name : '';
    locationInput.value = typeof editing.location === 'string' ? editing.location : '';
    quantityInput.value = String(
      Number.isInteger(editing.quantity) && editing.quantity >= 1 ? editing.quantity : 1
    );
    purchaseInput.value = normalizeDateInput(editing.purchaseDate) ?? '';
    warrantyInput.value = normalizeDateInput(editing.warrantyUntil) ?? '';
    noteInput.value = typeof editing.note === 'string' ? editing.note : '';
    tagsInput.value = Array.isArray(editing.tags)
      ? editing.tags.filter((tag) => typeof tag === 'string').join('，')
      : '';
  }

  /* 交互 */
  chipGrid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !formRefs) return;
    const chip = target.closest('.lk-chip');
    if (!(chip instanceof HTMLElement) || !chip.dataset.category) return;
    formRefs.categoryValue = chip.dataset.category;
    renderCategoryChips();
    activeDialog?.setError('');
  });

  quickRow.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !formRefs) return;
    const button = target.closest('.lk-quick-btn');
    if (!(button instanceof HTMLElement) || !button.dataset.location) return;
    // 点击填入；若输入框已有内容则追加「·」，便于继续补充细节（PRD F4-2）
    const current = formRefs.locationInput.value.trim();
    const picked = button.dataset.location;
    if (current.length === 0) formRefs.locationInput.value = picked;
    else if (!current.includes(picked)) formRefs.locationInput.value = `${current} · ${picked}`;
    formRefs.locationInput.focus();
    activeDialog?.setError('');
  });

  warrantyQuick.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !formRefs) return;
    const button = target.closest('.lk-quick-btn');
    if (!(button instanceof HTMLElement) || !button.dataset.years) return;
    const years = Number(button.dataset.years);
    // 有购买日期按其推算，没有则按今天
    const base = normalizeDateInput(formRefs.purchaseInput.value) ?? todayKey();
    const computed = addYearsToDate(base, years);
    if (computed) formRefs.warrantyInput.value = computed;
    activeDialog?.setError('');
  });

  for (const input of [nameInput, locationInput, quantityInput, purchaseInput, warrantyInput, noteInput, tagsInput]) {
    input.addEventListener('input', () => activeDialog?.setError(''));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitEditor();
  });

  activeDialog = openModal({
    title: editing ? '编辑物品' : '添加物品',
    subtitle: editing ? '修改后立即生效' : '记录东西放在哪，随时搜得到',
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
      activeDialog = null;
      formRefs = null;
      state.editingId = null;
    }
  });

  nameInput.focus();
}

/** 提交：校验 → 落盘 → 刷新 */
async function submitEditor() {
  if (!formRefs || !api) return;

  const built = buildItemData({
    name: formRefs.nameInput.value,
    category: formRefs.chipGrid.dataset.selectedCategory ?? formRefs.categoryValue,
    location: formRefs.locationInput.value,
    quantity: formRefs.quantityInput.value,
    purchaseDate: formRefs.purchaseInput.value,
    warrantyUntil: formRefs.warrantyInput.value,
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
    if (editingId) await api.updateItem(editingId, built.data);
    else await api.addItem(built.data);
    closeEditor();
    api.notify(editingId ? '已保存修改' : '已添加物品', { type: 'success' });
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
 * 保修状态文本与样式类。
 * @param {{status: 'EXPIRED' | 'EXPIRING' | null, days: number | null}} warranty
 * @returns {{text: string, variant: 'expired' | 'expiring' | 'none'}}
 */
function warrantyLabel(warranty) {
  if (warranty.status === 'EXPIRED') {
    return { text: `已过期 ${warranty.days} 天`, variant: 'expired' };
  }
  if (warranty.status === 'EXPIRING') {
    return { text: `临期 · 还剩 ${warranty.days} 天`, variant: 'expiring' };
  }
  return { text: '', variant: 'none' };
}

/**
 * 创建一行物品。
 * @param {object} item
 * @returns {HTMLElement}
 */
function createItemRow(item) {
  const style = CATEGORY_BY_NAME.get(item.category) ?? FALLBACK_CATEGORY;
  const warranty = itemWarrantyStatus(item);
  const label = warrantyLabel(warranty);

  const row = createEl('div', { className: 'lk-item-row' });
  row.dataset.id = String(item.id);

  /* 36px 淡彩分类图标容器 + 18px 图标 */
  const iconBox = createEl('div', { className: 'lk-row-icon' });
  iconBox.dataset.tint = style.tint;
  iconBox.dataset.ink = style.ink;
  iconBox.append(createIcon(style.icon, 18));

  /* 主文本 = 名称；副文本 = 位置（前置定位图标）/ 标签 / 备注 */
  const main = createEl('div', { className: 'lk-item-main' });
  main.append(createEl('span', { className: 'lk-item-name', text: String(item.name ?? '') }));

  const metaRow = createEl('div', { className: 'lk-item-meta' });
  if (typeof item.location === 'string' && item.location.length > 0) {
    const locationWrap = createEl('span', { className: 'lk-item-location' });
    locationWrap.append(createIcon('pin', 14), createEl('span', { text: item.location }));
    metaRow.append(locationWrap);
  }
  for (const tag of Array.isArray(item.tags) ? item.tags : []) {
    if (typeof tag !== 'string' || tag.length === 0) continue;
    metaRow.append(createEl('span', { className: 'lk-tag-chip', text: tag }));
  }
  if (typeof item.note === 'string' && item.note.length > 0) {
    metaRow.append(createEl('span', { className: 'lk-item-note', text: item.note }));
  }
  if (Number.isInteger(item.quantity) && item.quantity > 1) {
    metaRow.append(createEl('span', { className: 'lk-item-qty', text: `×${item.quantity}` }));
  }
  if (metaRow.childElementCount > 0) main.append(metaRow);

  /* 右侧：保修状态 */
  const aside = createEl('div', { className: 'lk-item-aside' });
  const status = createEl('span', { className: 'lk-warranty', text: label.text });
  status.dataset.variant = label.variant;
  status.hidden = label.variant === 'none';
  aside.append(status);

  /* 行内操作 */
  const actions = createEl('div', { className: 'lk-row-actions' });
  for (const action of [
    { key: 'edit', icon: 'edit', label: `编辑 ${item.name ?? ''}` },
    { key: 'delete', icon: 'trash', label: `删除 ${item.name ?? ''}` }
  ]) {
    const button = /** @type {HTMLButtonElement} */ (
      createEl('button', { className: 'lk-icon-btn lk-icon-btn-sm', type: 'button' })
    );
    button.dataset.action = action.key;
    button.dataset.id = String(item.id);
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
 * 创建一个分类分组（可折叠，用原生 details/summary 保证键盘可达）。
 * @param {{category: string, items: object[]}} group
 * @returns {HTMLElement}
 */
function createCategoryGroup(group) {
  const style = CATEGORY_BY_NAME.get(group.category) ?? FALLBACK_CATEGORY;
  const details = /** @type {HTMLDetailsElement} */ (createEl('details', { className: 'lk-item-group' }));
  details.open = !state.collapsed.has(group.category);
  details.dataset.category = group.category;

  const summary = createEl('summary', { className: 'lk-item-group-head' });
  const chevron = createEl('span', { className: 'lk-item-chevron' });
  chevron.append(createIcon('chevron', 16));

  const iconBox = createEl('span', { className: 'lk-row-icon lk-row-icon-sm' });
  iconBox.dataset.tint = style.tint;
  iconBox.dataset.ink = style.ink;
  iconBox.append(createIcon(style.icon, 16));

  summary.append(
    chevron,
    iconBox,
    createEl('span', { className: 'lk-item-group-title', text: group.category }),
    createEl('span', { className: 'lk-item-group-count', text: `${group.items.length} 件` })
  );

  const list = createEl('div', { className: 'lk-item-list' });
  for (const item of group.items) list.append(createItemRow(item));

  details.append(summary, list);

  // 记录折叠状态，刷新后保持（不落盘，仅内存）
  details.addEventListener('toggle', () => {
    if (details.open) state.collapsed.delete(group.category);
    else state.collapsed.add(group.category);
  });

  return details;
}

/**
 * 渲染整页：统计条 + 工具行 + 分组列表。
 */
async function render() {
  if (!api) return;

  const all = await api.getItems();
  const summary = summarize(all);
  const groups = groupByCategory(applyFilters(all));

  /* 统计条：只统计全部物品，不受筛选影响 */
  setText(byId('items-stat-total'), String(summary.total));
  setText(byId('items-stat-expiring'), String(summary.expiring));
  setText(byId('items-stat-expired'), String(summary.expired));

  /* 工具行 */
  fillSelect(
    /** @type {HTMLSelectElement | null} */ (byId('items-filter-category')),
    [{ value: 'all', label: '全部分类' }, ...CATEGORIES.map((entry) => ({ value: entry.name, label: entry.name }))],
    state.categoryFilter
  );

  for (const button of document.querySelectorAll('[data-status-filter]')) {
    if (!(button instanceof HTMLElement)) continue;
    button.classList.toggle('is-active', button.dataset.statusFilter === state.statusFilter);
    button.setAttribute('aria-selected', button.dataset.statusFilter === state.statusFilter ? 'true' : 'false');
  }

  /* 列表 */
  const listRoot = byId('items-list');
  const emptyRoot = byId('items-empty');
  if (!listRoot || !emptyRoot) return;

  listRoot.replaceChildren();

  if (groups.length === 0) {
    listRoot.hidden = true;
    emptyRoot.hidden = false;

    const hasAny = all.length > 0;
    setText(byId('items-empty-title'), hasAny ? '没有符合条件的物品' : '还没有登记任何物品');
    setText(
      byId('items-empty-desc'),
      hasAny
        ? '试着换个关键词，或清除搜索与筛选条件。'
        : '点击右上角「添加物品」，把东西放在哪记下来。'
    );
    const emptyAction = byId('items-empty-action');
    if (emptyAction) emptyAction.hidden = hasAny;
    const clearButton = byId('items-empty-clear');
    if (clearButton) clearButton.hidden = !hasAny;
    return;
  }

  listRoot.hidden = false;
  emptyRoot.hidden = true;

  const fragment = document.createDocumentFragment();
  for (const group of groups) fragment.append(createCategoryGroup(group));
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

  const all = await api.getItems();
  const entry = all.find((item) => String(item.id) === id);

  if (button.dataset.action === 'edit') {
    if (!entry) {
      api.notify('这件物品已不存在', { type: 'error' });
      await render();
      return;
    }
    openEditor(entry);
    return;
  }

  if (button.dataset.action === 'delete') {
    if (!entry) return;
    const detail = [entry.location, entry.category].filter((v) => typeof v === 'string' && v).join(' · ');
    openConfirmDialog({
      title: '删除这件物品',
      subtitle: '删除后无法恢复',
      message: detail.length > 0 ? `${entry.name}（${detail}）` : String(entry.name ?? ''),
      confirmLabel: '删除',
      variant: 'danger',
      onConfirm: async () => {
        await api.removeItem(id);
        api.notify('已删除', { type: 'success' });
        await render();
      }
    });
  }
}

/** 绑定工具行、筛选项与列表事件委托 */
function bindToolbar() {
  byId('items-add-button')?.addEventListener('click', () => openEditor());
  byId('items-empty-action')?.addEventListener('click', () => openEditor());

  byId('items-empty-clear')?.addEventListener('click', async () => {
    state.keyword = '';
    state.categoryFilter = 'all';
    state.statusFilter = 'all';
    const searchInput = /** @type {HTMLInputElement | null} */ (byId('items-search'));
    if (searchInput) searchInput.value = '';
    await render();
  });

  const searchInput = /** @type {HTMLInputElement | null} */ (byId('items-search'));
  searchInput?.addEventListener('input', async () => {
    state.keyword = searchInput.value;
    await render();
  });

  const categorySelect = /** @type {HTMLSelectElement | null} */ (byId('items-filter-category'));
  categorySelect?.addEventListener('change', async () => {
    state.categoryFilter = categorySelect.value;
    await render();
  });

  for (const button of document.querySelectorAll('[data-status-filter]')) {
    button.addEventListener('click', async () => {
      if (!(button instanceof HTMLElement) || !button.dataset.statusFilter) return;
      state.statusFilter = button.dataset.statusFilter;
      await render();
    });
  }

  byId('items-list')?.addEventListener('click', (event) => {
    void onListClick(event);
  });
}

/* --------------------------------------------------------------------------
 * 对外入口
 * -------------------------------------------------------------------------- */

/**
 * 装配物品台账模块（由 main.js 注入数据与提示能力）。
 * @param {ItemsApi} injectedApi
 */
export function mountItems(injectedApi) {
  if (mounted) return;
  mounted = true;
  api = injectedApi;
  bindToolbar();
  void render();
}

/**
 * 锁定 / 清空数据后重置内存状态。
 */
export function resetItems() {
  state.keyword = '';
  state.categoryFilter = 'all';
  state.statusFilter = 'all';
  state.editingId = null;
  state.collapsed.clear();

  const searchInput = /** @type {HTMLInputElement | null} */ (byId('items-search'));
  if (searchInput) searchInput.value = '';
}

export { render as renderItems };
