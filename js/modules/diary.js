/* ==========================================================================
 * js/modules/diary.js — M3 生活记录
 * --------------------------------------------------------------------------
 * 本阶段范围：写记录 / 编辑（宽 Modal，DESIGN.md E.1）+ 草稿 + 列表（按月份分组）
 *   + 搜索 / 标签筛选 / 视图切换（时间线 · 卡片）。
 * 明确不做：图片附件、富文本（仅纯文本 + 换行）、仪表盘改动。
 *
 * 分层约定（与 settings / account 同一注入模式）：
 *   - 本模块 **不 import storage.js / main.js**，数据、草稿与提示能力全部由 main.js 注入；
 *   - 本文件无 innerHTML / outerHTML / insertAdjacentHTML：文本一律 textContent，
 *     图标一律 createElementNS 逐节点构造（几何属性来自文件内常量表，不含用户输入）；
 *   - 正文换行靠 CSS white-space: pre-wrap 呈现，绝不把文本拼进 HTML；
 *   - id / createdAt / updatedAt 由 storage 层维护，本模块不生成、不改写。
 * ========================================================================== */

import { byId, createEl, openConfirmDialog, openModal, setText } from '../lib/dom.js';
import {
  formatDayGroupTitle,
  formatTagsInput,
  isoToLocalInputValue,
  localDateToIso,
  localInputValueToIso,
  localMonthKeyFromIso,
  parseTags
} from '../lib/utils.js';

/**
 * @typedef {object} DiaryData
 * @property {string} title
 * @property {string} content
 * @property {number | null} mood
 * @property {string} date
 * @property {string[]} tags
 */

/**
 * @typedef {object} DiaryApi
 * @property {() => Promise<object[]>} getDiaries
 * @property {(data: DiaryData) => Promise<object>} addDiary
 * @property {(id: string, patch: DiaryData) => Promise<object>} updateDiary
 * @property {(id: string) => Promise<boolean>} removeDiary
 * @property {() => Promise<object | null>} getDraft
 * @property {(data: object) => Promise<boolean>} saveDraft
 * @property {() => Promise<void>} clearDraft
 * @property {(message: string, options?: {type?: 'success' | 'error' | 'neutral'}) => void} notify
 */

/* --------------------------------------------------------------------------
 * 常量
 * -------------------------------------------------------------------------- */

/** 草稿命名空间（最终键为 life-keeper:draft:diary） */
export const DIARY_DRAFT_NAMESPACE = 'diary';

/** 草稿自动保存节流间隔（毫秒） */
const DRAFT_THROTTLE_MS = 800;

/** 编辑器宽度（DESIGN.md E.1 的 480px 是表单类默认值，宽表单用 720px） */
const EDITOR_WIDTH_PX = 720;

/**
 * 5 档心情：1 → 5 由差到好。
 * ink 只用 DESIGN.md 已定义的 Token；未选中一律 {colors.stone}。
 */
const MOODS = [
  { value: 1, label: '很糟', ink: 'semantic-error' },
  { value: 2, label: '较差', ink: 'brand-orange' },
  { value: 3, label: '一般', ink: 'brand-yellow' },
  { value: 4, label: '不错', ink: 'brand-teal' },
  { value: 5, label: '很好', ink: 'brand-green' }
];

const MOOD_BY_VALUE = new Map(MOODS.map((mood) => [mood.value, mood]));

/** 视图模式 */
const VIEW_MODES = { timeline: '时间线', card: '卡片' };

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 图标形状表（24 网格、1.6 描边）。
 * face 为统一的线性圆脸：心情只靠颜色区分，不换图形，未选中态为 {colors.stone}。
 * @type {Record<string, Array<[string, Record<string, string>]>>}
 */
const ICON_SHAPES = {
  face: [
    ['circle', { cx: '12', cy: '12', r: '8.75' }],
    ['path', { d: 'M9 10.25h.01M15 10.25h.01' }],
    ['path', { d: 'M9 14.75c.8.75 1.8 1.15 3 1.15s2.2-.4 3-1.15' }]
  ],
  note: [
    ['path', { d: 'M5.75 4.25h9.5a3 3 0 0 1 3 3v12.5H8.75a3 3 0 0 1-3-3z' }],
    ['path', { d: 'M5.75 16.75h12.5' }],
    ['path', { d: 'M9.25 9.25h5.75' }],
    ['path', { d: 'M9.25 12.5h5.75' }]
  ],
  search: [
    ['circle', { cx: '10.75', cy: '10.75', r: '6.5' }],
    ['path', { d: 'M15.75 15.75 20.5 20.5' }]
  ],
  trash: [
    ['path', { d: 'M4.75 6.75h14.5' }],
    ['path', { d: 'M9.25 6.75V5a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 .75.75v1.75' }],
    ['path', { d: 'M6.75 6.75l.75 12.5h9l.75-12.5' }]
  ],
  plus: [['path', { d: 'M12 5.25v13.5M5.25 12h13.5' }]],
  timeline: [
    ['path', { d: 'M6.25 4.5v15' }],
    ['circle', { cx: '6.25', cy: '8', r: '1.85' }],
    ['circle', { cx: '6.25', cy: '16', r: '1.85' }],
    ['path', { d: 'M10.25 8h8.5M10.25 16h8.5' }]
  ],
  card: [
    ['rect', { x: '3.75', y: '4.75', width: '16.5', height: '6.5', rx: '2' }],
    ['rect', { x: '3.75', y: '13.25', width: '16.5', height: '6.5', rx: '2' }]
  ]
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

  for (const [tag, attributes] of ICON_SHAPES[name] ?? ICON_SHAPES.note) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}

/* --------------------------------------------------------------------------
 * 模块状态（仅内存）
 * -------------------------------------------------------------------------- */

/** @type {DiaryApi | null} */
let api = null;
let mounted = false;

const state = {
  keyword: '',
  tagFilter: 'all',
  viewMode: 'timeline',
  editingId: null,
  /** 待触发的草稿定时器 */
  draftTimerId: 0,
  /** 本编辑器是否处于「恢复的草稿」状态（决定是否显示「丢弃草稿」） */
  hasRestoredDraft: false
};

/* --------------------------------------------------------------------------
 * 数据加工（纯函数）
 * -------------------------------------------------------------------------- */

/**
 * 取一篇记录用于展示的标题：空标题回退为「M月D日 星期X」。
 * @param {object} entry
 * @returns {string}
 */
function displayTitle(entry) {
  const title = typeof entry.title === 'string' ? entry.title.trim() : '';
  if (title.length > 0) return title;
  const dayKey = localIsoToDayKey(entry.date);
  return dayKey ? formatDayGroupTitle(dayKey) : '无标题';
}

/**
 * ISO → 本地日键（内部用，避免与 utils 的命名混淆）。
 * @param {string} iso
 * @returns {string}
 */
function localIsoToDayKey(iso) {
  if (typeof iso !== 'string' || iso.length === 0) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 收集全部已有标签并统计出现次数，按次数倒序、同次数按名称排序。
 * @param {object[]} list
 * @returns {Array<{name: string, count: number}>}
 */
function collectTags(list) {
  /** @type {Map<string, number>} */
  const counter = new Map();
  for (const entry of list) {
    if (!Array.isArray(entry.tags)) continue;
    for (const tag of entry.tags) {
      if (typeof tag !== 'string' || tag.length === 0) continue;
      counter.set(tag, (counter.get(tag) ?? 0) + 1);
    }
  }
  return [...counter.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

/**
 * 搜索（标题 / 正文 / 标签）+ 标签筛选。
 * @param {object[]} list
 * @returns {object[]}
 */
function applyFilters(list) {
  const keyword = state.keyword.trim().toLowerCase();

  return list.filter((entry) => {
    if (state.tagFilter !== 'all') {
      const tags = Array.isArray(entry.tags) ? entry.tags : [];
      if (!tags.includes(state.tagFilter)) return false;
    }
    if (keyword.length === 0) return true;

    const haystack = [
      entry.title,
      entry.content,
      ...(Array.isArray(entry.tags) ? entry.tags : [])
    ]
      .filter((value) => typeof value === 'string')
      .join('\n')
      .toLowerCase();
    return haystack.includes(keyword);
  });
}

/**
 * 按月份分组（倒序），组内按日期倒序。
 * @param {object[]} list
 * @returns {Array<{monthKey: string, items: object[]}>}
 */
function groupByMonth(list) {
  /** @type {Map<string, object[]>} */
  const buckets = new Map();
  for (const entry of list) {
    const monthKey = localMonthKeyFromIso(entry.date);
    if (!monthKey) continue;
    if (!buckets.has(monthKey)) buckets.set(monthKey, []);
    buckets.get(monthKey).push(entry);
  }

  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([monthKey, items]) => ({
      monthKey,
      items: [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }));
}

/**
 * 正文摘要：把连续空行压缩成单个换行，便于列表预览（不改动落盘内容）。
 * @param {string} content
 * @returns {string}
 */
function toSummary(content) {
  if (typeof content !== 'string') return '';
  return content.replace(/\n{2,}/g, '\n').trim();
}

/**
 * 表单原始值 → DiaryData。
 * @param {{title: string, content: string, mood: number | null, dateTime: string, tags: string}} form
 * @returns {{ok: true, data: DiaryData} | {ok: false, message: string}}
 */
function buildDiaryData(form) {
  const content = typeof form.content === 'string' ? form.content : '';
  if (content.trim().length === 0) {
    return { ok: false, message: '正文不能为空' };
  }

  const date = localInputValueToIso(form.dateTime);
  if (!date) {
    return { ok: false, message: '请选择有效的日期与时间' };
  }

  const mood =
    Number.isInteger(form.mood) && MOOD_BY_VALUE.has(form.mood) ? /** @type {number} */ (form.mood) : null;

  return {
    ok: true,
    data: {
      title: typeof form.title === 'string' ? form.title.trim() : '',
      // 只去掉首尾空白，正文内部换行原样保留（F3-1：纯文本 + 换行）
      content: content.replace(/^\s+|\s+$/g, ''),
      mood,
      date,
      tags: parseTags(form.tags)
    }
  };
}

/* --------------------------------------------------------------------------
 * 编辑器（宽 Modal，DESIGN.md E.1）
 * -------------------------------------------------------------------------- */

/** @type {ReturnType<typeof openModal> | null} */
let activeDialog = null;
/** 仅在编辑器打开期间有效的表单引用 */
let formRefs = null;

/**
 * 收集当前表单值（草稿与提交共用）。
 * @returns {{title: string, content: string, mood: number | null, dateTime: string, tags: string}}
 */
function readForm() {
  if (!formRefs) {
    return { title: '', content: '', mood: null, dateTime: '', tags: '' };
  }
  return {
    title: formRefs.titleInput.value,
    content: formRefs.contentInput.value,
    mood: formRefs.moodValue,
    dateTime: formRefs.dateInput.value,
    tags: formRefs.tagsInput.value
  };
}

/** 取消待触发的草稿定时器 */
function cancelDraftTimer() {
  if (state.draftTimerId) {
    window.clearTimeout(state.draftTimerId);
    state.draftTimerId = 0;
  }
}

/**
 * 立即把当前表单写入草稿（节流到期、关闭、保存前都会调用）。
 * 仅新记录写草稿；编辑现有条目时不读写草稿。
 */
async function flushDraft() {
  cancelDraftTimer();
  if (!api || state.editingId || !formRefs) return;

  const form = readForm();
  const empty =
    form.title.trim().length === 0 && form.content.trim().length === 0 && form.tags.trim().length === 0;
  if (empty) {
    // 全空视为没有草稿，避免留下无意义记录
    await api.clearDraft();
    return;
  }
  await api.saveDraft({ ...form, savedAt: new Date().toISOString() });
}

/**
 * 安排一次节流后的草稿保存（每 800ms 最多一次）。
 */
function scheduleDraftSave() {
  if (state.editingId || !formRefs) return;
  if (state.draftTimerId) return;
  state.draftTimerId = window.setTimeout(() => {
    state.draftTimerId = 0;
    void flushDraft();
  }, DRAFT_THROTTLE_MS);
}

/** 关闭并清理编辑器状态 */
function closeEditor() {
  cancelDraftTimer();
  const dialog = activeDialog;
  activeDialog = null;
  formRefs = null;
  state.editingId = null;
  state.hasRestoredDraft = false;
  dialog?.close();
}

/** 刷新心情按钮的选中态与无障碍属性 */
function renderMoodButtons() {
  if (!formRefs) return;
  for (const button of formRefs.moodRow.querySelectorAll('.lk-mood-btn')) {
    if (!(button instanceof HTMLElement)) continue;
    const value = Number(button.dataset.mood);
    const isActive = formRefs.moodValue === value;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-checked', isActive ? 'true' : 'false');
  }
}

/**
 * 把一份数据回填到表单（编辑预填 / 草稿恢复共用）。
 * @param {{title?: string, content?: string, mood?: number | null, dateTime?: string, date?: string, tags?: string[] | string}} source
 */
function fillForm(source) {
  if (!formRefs) return;

  formRefs.titleInput.value = typeof source.title === 'string' ? source.title : '';
  formRefs.contentInput.value = typeof source.content === 'string' ? source.content : '';

  if (typeof source.dateTime === 'string' && source.dateTime) {
    formRefs.dateInput.value = source.dateTime;
  } else if (typeof source.date === 'string' && source.date) {
    formRefs.dateInput.value = isoToLocalInputValue(source.date);
  } else {
    formRefs.dateInput.value = isoToLocalInputValue(localDateToIso(new Date()));
  }

  formRefs.moodValue = Number.isInteger(source.mood) && MOOD_BY_VALUE.has(source.mood) ? source.mood : null;
  renderMoodButtons();

  if (typeof source.tags === 'string') formRefs.tagsInput.value = source.tags;
  else formRefs.tagsInput.value = formatTagsInput(source.tags);
}

/**
 * 打开编辑器。
 * @param {object | null} [editing] 传入记录即为编辑模式
 * @param {object | null} [draft] 新记录模式下要恢复的草稿
 */
function openEditor(editing = null, draft = null) {
  state.editingId = editing ? String(editing.id) : null;
  state.hasRestoredDraft = false;

  const form = /** @type {HTMLFormElement} */ (
    createEl('form', { className: 'lk-form', id: 'diary-form' })
  );
  form.noValidate = true;

  /* 标题 */
  const titleInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'diary-title', type: 'text' })
  );
  titleInput.setAttribute('autocomplete', 'off');
  titleInput.setAttribute('placeholder', '可空，默认用日期');

  /* 正文：大文本域，min-height 240px，white-space: pre-wrap */
  const contentInput = /** @type {HTMLTextAreaElement} */ (
    createEl('textarea', { className: 'lk-textarea', id: 'diary-content' })
  );
  contentInput.rows = 10;
  contentInput.setAttribute('placeholder', '写点什么…（支持换行，纯文本）');

  /* 日期时间 */
  const dateInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'diary-date', type: 'datetime-local' })
  );

  /* 心情：5 档圆形按钮，可再次点击取消 */
  const moodRow = createEl('div', { className: 'lk-mood-row', id: 'diary-mood' });
  moodRow.setAttribute('role', 'radiogroup');
  moodRow.setAttribute('aria-label', '心情');
  for (const mood of MOODS) {
    const button = /** @type {HTMLButtonElement} */ (
      createEl('button', { className: 'lk-mood-btn', type: 'button' })
    );
    button.dataset.mood = String(mood.value);
    button.dataset.ink = mood.ink;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', 'false');
    button.setAttribute('aria-label', `心情：${mood.label}`);
    button.append(createIcon('face', 18), createEl('span', { className: 'lk-mood-label', text: mood.label }));
    moodRow.append(button);
  }

  /* 标签 */
  const tagsInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'diary-tags', type: 'text' })
  );
  tagsInput.setAttribute('autocomplete', 'off');
  tagsInput.setAttribute('placeholder', '用逗号分隔，如：科研，随笔');

  formRefs = { form, titleInput, contentInput, dateInput, moodRow, moodValue: null, tagsInput };

  /* 字段组装 */
  const titleField = createEl('div', { className: 'lk-field' });
  const titleLabel = createEl('label', { className: 'lk-field-label', text: '标题' });
  titleLabel.setAttribute('for', 'diary-title');
  titleField.append(titleLabel, titleInput);

  const contentField = createEl('div', { className: 'lk-field' });
  const contentLabel = createEl('label', { className: 'lk-field-label', text: '正文' });
  contentLabel.setAttribute('for', 'diary-content');
  contentField.append(contentLabel, contentInput);

  const dateField = createEl('div', { className: 'lk-field' });
  const dateLabel = createEl('label', { className: 'lk-field-label', text: '日期时间' });
  dateLabel.setAttribute('for', 'diary-date');
  dateField.append(dateLabel, dateInput);

  const moodField = createEl('div', { className: 'lk-field' });
  moodField.append(createEl('span', { className: 'lk-field-label', text: '心情' }), moodRow);

  const tagsField = createEl('div', { className: 'lk-field' });
  const tagsLabel = createEl('label', { className: 'lk-field-label', text: '标签' });
  tagsLabel.setAttribute('for', 'diary-tags');
  tagsField.append(tagsLabel, tagsInput);

  const metaGrid = createEl('div', { className: 'lk-form-grid' });
  metaGrid.append(dateField, tagsField);

  form.append(titleField, contentField, moodField, metaGrid);

  /* 预填 */
  if (editing) {
    fillForm({
      title: editing.title,
      content: editing.content,
      mood: editing.mood,
      date: editing.date,
      tags: editing.tags
    });
  } else if (draft) {
    fillForm(draft);
    state.hasRestoredDraft = true;
  } else {
    fillForm({});
  }

  /* 交互 */
  moodRow.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !formRefs) return;
    const button = target.closest('.lk-mood-btn');
    if (!(button instanceof HTMLElement) || !button.dataset.mood) return;
    const value = Number(button.dataset.mood);
    // 再次点击同一个 → 取消选择（PRD：心情可选）
    formRefs.moodValue = formRefs.moodValue === value ? null : value;
    renderMoodButtons();
    activeDialog?.setError('');
    scheduleDraftSave();
  });

  for (const input of [titleInput, contentInput, tagsInput, dateInput]) {
    input.addEventListener('input', () => {
      activeDialog?.setError('');
      scheduleDraftSave();
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitEditor();
  });

  /* 「丢弃草稿」只在「恢复过草稿的新记录」场景出现 */
  const actions = [
    { label: '取消', variant: 'secondary', onClick: () => closeEditor() }
  ];
  if (state.hasRestoredDraft) {
    actions.push({
      label: '丢弃草稿',
      variant: 'ghost',
      onClick: async () => {
        await api?.clearDraft();
        state.hasRestoredDraft = false;
        cancelDraftTimer();
        fillForm({});
        activeDialog?.setError('');
        api?.notify('草稿已丢弃', { type: 'success' });
      }
    });
  }
  actions.push({
    label: editing ? '保存修改' : '保存',
    variant: 'primary',
    onClick: () => form.requestSubmit()
  });

  activeDialog = openModal({
    title: editing ? '编辑记录' : '写记录',
    subtitle: editing ? '修改后立即生效' : '纯文本，支持换行',
    widthPx: EDITOR_WIDTH_PX,
    bodyChildren: [form],
    actions,
    onClose: () => {
      // 关闭时把未到节流窗口的改动落成草稿，避免丢失
      void flushDraft();
      activeDialog = null;
      formRefs = null;
      state.editingId = null;
      state.hasRestoredDraft = false;
    }
  });

  titleInput.focus();
}

/** 提交编辑器：校验 → 落盘 → 清草稿 → 刷新 */
async function submitEditor() {
  if (!formRefs || !api) return;

  const built = buildDiaryData(readForm());
  if (!built.ok) {
    // 校验失败：不关闭弹窗、不落盘
    activeDialog?.setError(built.message);
    return;
  }

  const editingId = state.editingId;
  try {
    if (editingId) {
      // 编辑现有条目：不读写草稿（草稿仅服务「新记录」）
      await api.updateDiary(editingId, built.data);
    } else {
      await api.addDiary(built.data);
      // 保存成功后自动清除草稿
      cancelDraftTimer();
      await api.clearDraft();
    }
    closeEditor();
    api.notify(editingId ? '已保存修改' : '已保存记录', { type: 'success' });
    await render();
  } catch (error) {
    activeDialog?.setError(`保存失败：${error?.message ?? '未知错误'}`);
  }
}

/**
 * 打「写记录」：有新草稿则恢复并提示，否则开空白编辑器。
 */
async function openNewDiary() {
  if (!api) return;
  const draft = await api.getDraft();
  const hasDraft =
    draft &&
    ((typeof draft.content === 'string' && draft.content.trim().length > 0) ||
      (typeof draft.title === 'string' && draft.title.trim().length > 0) ||
      (typeof draft.tags === 'string' && draft.tags.trim().length > 0));

  if (hasDraft) {
    openEditor(null, draft);
    api.notify('已恢复上次草稿', { type: 'success' });
    return;
  }
  openEditor(null, null);
}

/* --------------------------------------------------------------------------
 * 列表渲染
 * -------------------------------------------------------------------------- */

/**
 * 填充标签筛选下拉。
 * @param {HTMLSelectElement | null} select
 * @param {Array<{name: string, count: number}>} tags
 */
function fillTagSelect(select, tags) {
  if (!select) return;
  select.replaceChildren();
  const all = /** @type {HTMLOptionElement} */ (createEl('option', { text: '全部标签' }));
  all.value = 'all';
  select.append(all);
  for (const tag of tags) {
    const option = /** @type {HTMLOptionElement} */ (
      createEl('option', { text: `${tag.name}（${tag.count}）` })
    );
    option.value = tag.name;
    select.append(option);
  }
  // 若当前选中的标签已不存在（被删空），回退到「全部标签」
  select.value = tags.some((tag) => tag.name === state.tagFilter) ? state.tagFilter : 'all';
  if (select.value === 'all') state.tagFilter = 'all';
}

/**
 * 创建一条记录的行（时间线视图）。
 * @param {object} entry
 * @returns {HTMLElement}
 */
function createTimelineRow(entry) {
  const row = createEl('div', { className: 'lk-entry', tabindex: '0' });
  row.setAttribute('role', 'button');
  row.dataset.id = String(entry.id);
  row.dataset.action = 'edit';

  const main = createEl('div', { className: 'lk-entry-main' });
  main.append(
    createEl('span', { className: 'lk-entry-title', text: displayTitle(entry) }),
    createEl('p', { className: 'lk-entry-body lk-clamp-3', text: toSummary(entry.content) })
  );

  const footer = createEl('div', { className: 'lk-entry-footer' });
  const mood = moodOf(entry.mood);
  if (mood) {
    const moodTag = createEl('span', { className: 'lk-entry-mood' });
    moodTag.dataset.ink = mood.ink;
    moodTag.append(createIcon('face', 16), createEl('span', { text: mood.label }));
    footer.append(moodTag);
  }
  for (const tag of Array.isArray(entry.tags) ? entry.tags : []) {
    if (typeof tag !== 'string' || tag.length === 0) continue;
    footer.append(createEl('span', { className: 'lk-tag-chip', text: tag }));
  }
  footer.append(createEl('span', { className: 'lk-entry-time', text: formatEntryTime(entry.date) }));

  const actions = createEl('div', { className: 'lk-row-actions' });
  const removeButton = /** @type {HTMLButtonElement} */ (
    createEl('button', { className: 'lk-icon-btn lk-icon-btn-sm', type: 'button' })
  );
  removeButton.dataset.action = 'delete';
  removeButton.dataset.id = String(entry.id);
  removeButton.setAttribute('aria-label', `删除记录 ${displayTitle(entry)}`);
  removeButton.append(
    createIcon('trash', 16),
    createEl('span', { className: 'lk-sr-only', text: '删除' })
  );
  actions.append(removeButton);

  const aside = createEl('div', { className: 'lk-entry-aside' });
  aside.append(actions);

  row.append(main, aside);
  row.append(footer);
  return row;
}

/**
 * 创建一条记录的卡片（卡片视图）。
 * @param {object} entry
 * @returns {HTMLElement}
 */
function createCard(entry) {
  const card = createEl('div', { className: 'lk-note-card', tabindex: '0' });
  card.setAttribute('role', 'button');
  card.dataset.id = String(entry.id);
  card.dataset.action = 'edit';

  const head = createEl('div', { className: 'lk-note-card-head' });
  const mood = moodOf(entry.mood);
  if (mood) {
    const moodTag = createEl('span', { className: 'lk-entry-mood' });
    moodTag.dataset.ink = mood.ink;
    moodTag.append(createIcon('face', 16), createEl('span', { text: mood.label }));
    head.append(moodTag);
  }
  head.append(createEl('span', { className: 'lk-entry-time', text: formatEntryTime(entry.date) }));

  const actions = createEl('div', { className: 'lk-row-actions' });
  const removeButton = /** @type {HTMLButtonElement} */ (
    createEl('button', { className: 'lk-icon-btn lk-icon-btn-sm', type: 'button' })
  );
  removeButton.dataset.action = 'delete';
  removeButton.dataset.id = String(entry.id);
  removeButton.setAttribute('aria-label', `删除记录 ${displayTitle(entry)}`);
  removeButton.append(createIcon('trash', 16), createEl('span', { className: 'lk-sr-only', text: '删除' }));
  actions.append(removeButton);
  head.append(actions);

  const body = createEl('p', { className: 'lk-note-card-body lk-clamp-3', text: toSummary(entry.content) });

  const footer = createEl('div', { className: 'lk-entry-footer' });
  for (const tag of Array.isArray(entry.tags) ? entry.tags : []) {
    if (typeof tag !== 'string' || tag.length === 0) continue;
    footer.append(createEl('span', { className: 'lk-tag-chip', text: tag }));
  }

  card.append(
    head,
    createEl('span', { className: 'lk-entry-title', text: displayTitle(entry) }),
    body
  );
  if (footer.childElementCount > 0) card.append(footer);
  return card;
}

/**
 * 按心情值取定义。
 * @param {unknown} value
 * @returns {{value: number, label: string, ink: string} | null}
 */
function moodOf(value) {
  return Number.isInteger(value) && MOOD_BY_VALUE.has(value) ? MOOD_BY_VALUE.get(value) : null;
}

/**
 * 条目的时间文本：M月D日 HH:mm。
 * @param {string} iso
 * @returns {string}
 */
function formatEntryTime(iso) {
  const value = isoToLocalInputValue(iso);
  if (!value) return '';
  const [datePart, timePart] = value.split('T');
  const [, month, day] = datePart.split('-').map(Number);
  return `${month}月${day}日 ${timePart}`;
}

/**
 * 渲染整页。
 */
async function render() {
  if (!api) return;

  const all = await api.getDiaries();
  const tags = collectTags(all);
  const visible = applyFilters(all);
  const groups = groupByMonth(visible);

  fillTagSelect(/** @type {HTMLSelectElement | null} */ (byId('diary-filter-tag')), tags);

  for (const button of document.querySelectorAll('[data-view-mode]')) {
    if (!(button instanceof HTMLElement)) continue;
    button.classList.toggle('is-active', button.dataset.viewMode === state.viewMode);
    button.setAttribute('aria-selected', button.dataset.viewMode === state.viewMode ? 'true' : 'false');
  }

  const listRoot = byId('diary-list');
  const emptyRoot = byId('diary-empty');
  if (!listRoot || !emptyRoot) return;

  listRoot.replaceChildren();
  listRoot.dataset.view = state.viewMode;

  if (groups.length === 0) {
    listRoot.hidden = true;
    emptyRoot.hidden = false;

    const hasAny = all.length > 0;
    setText(byId('diary-empty-title'), hasAny ? '没有符合条件的记录' : '还没有生活记录');
    setText(
      byId('diary-empty-desc'),
      hasAny
        ? '试着换个关键词，或清除搜索与标签筛选。'
        : '点击右上角「写记录」，写下今天值得留下的事。'
    );
    const emptyAction = byId('diary-empty-action');
    if (emptyAction) emptyAction.hidden = hasAny;
    const clearButton = byId('diary-empty-clear');
    if (clearButton) clearButton.hidden = !hasAny;
    return;
  }

  listRoot.hidden = false;
  emptyRoot.hidden = true;

  const fragment = document.createDocumentFragment();
  for (const group of groups) {
    const section = createEl('section', { className: 'lk-month-group' });
    const head = createEl('div', { className: 'lk-day-head' });
    head.append(
      createEl('span', {
        className: 'lk-day-title',
        text: `${group.monthKey.slice(0, 4)}年${Number(group.monthKey.slice(5, 7))}月 · ${group.items.length} 篇`
      })
    );
    section.append(head);

    if (state.viewMode === 'card') {
      const grid = createEl('div', { className: 'lk-note-grid' });
      for (const entry of group.items) grid.append(createCard(entry));
      section.append(grid);
    } else {
      const list = createEl('div', { className: 'lk-note-list' });
      for (const entry of group.items) list.append(createTimelineRow(entry));
      section.append(list);
    }
    fragment.append(section);
  }
  listRoot.append(fragment);
}

/* --------------------------------------------------------------------------
 * 事件
 * -------------------------------------------------------------------------- */

/**
 * 列表点击：删除按钮拦截，其余位置进入编辑。
 * @param {Event} event
 */
async function onListClick(event) {
  const target = event.target;
  if (!(target instanceof Element) || !api) return;

  const deleteButton = target.closest('[data-action="delete"]');
  if (deleteButton instanceof HTMLElement) {
    const id = deleteButton.dataset.id ?? '';
    if (!id) return;
    const all = await api.getDiaries();
    const entry = all.find((item) => String(item.id) === id);
    if (!entry) return;

    openConfirmDialog({
      title: '删除这条记录',
      subtitle: '删除后无法恢复',
      message: displayTitle(entry),
      confirmLabel: '删除',
      variant: 'danger',
      onConfirm: async () => {
        await api.removeDiary(id);
        api.notify('已删除', { type: 'success' });
        await render();
      }
    });
    return;
  }

  const row = target.closest('[data-action="edit"]');
  if (!(row instanceof HTMLElement)) return;
  const id = row.dataset.id ?? '';
  if (!id) return;

  const all = await api.getDiaries();
  const entry = all.find((item) => String(item.id) === id);
  if (!entry) {
    api.notify('这条记录已不存在', { type: 'error' });
    await render();
    return;
  }
  openEditor(entry, null);
}

/** 绑定工具行与列表事件委托 */
function bindToolbar() {
  byId('diary-add-button')?.addEventListener('click', () => void openNewDiary());
  byId('diary-empty-action')?.addEventListener('click', () => void openNewDiary());

  byId('diary-empty-clear')?.addEventListener('click', async () => {
    state.keyword = '';
    state.tagFilter = 'all';
    const searchInput = /** @type {HTMLInputElement | null} */ (byId('diary-search'));
    if (searchInput) searchInput.value = '';
    await render();
  });

  const searchInput = /** @type {HTMLInputElement | null} */ (byId('diary-search'));
  searchInput?.addEventListener('input', async () => {
    state.keyword = searchInput.value;
    await render();
  });

  const tagSelect = /** @type {HTMLSelectElement | null} */ (byId('diary-filter-tag'));
  tagSelect?.addEventListener('change', async () => {
    state.tagFilter = tagSelect.value;
    await render();
  });

  for (const button of document.querySelectorAll('[data-view-mode]')) {
    button.addEventListener('click', async () => {
      if (!(button instanceof HTMLElement) || !button.dataset.viewMode) return;
      state.viewMode = button.dataset.viewMode === 'card' ? 'card' : 'timeline';
      await render();
    });
  }

  const listRoot = byId('diary-list');
  listRoot?.addEventListener('click', (event) => {
    void onListClick(event);
  });
  // 键盘可达：整行可聚焦，Enter / Space 进入编辑
  listRoot?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-action="delete"]')) return;
    const row = target.closest('[data-action="edit"]');
    if (!row) return;
    event.preventDefault();
    void onListClick(event);
  });
}

/* --------------------------------------------------------------------------
 * 对外入口
 * -------------------------------------------------------------------------- */

/**
 * 装配生活记录模块（由 main.js 注入数据、草稿与提示能力）。
 * @param {DiaryApi} injectedApi
 */
export function mountDiary(injectedApi) {
  if (mounted) return;
  mounted = true;
  api = injectedApi;
  bindToolbar();
  void render();
}

/**
 * 锁定 / 清空数据后重置内存状态。
 */
export function resetDiary() {
  cancelDraftTimer();
  state.keyword = '';
  state.tagFilter = 'all';
  state.viewMode = 'timeline';
  state.editingId = null;
  state.hasRestoredDraft = false;

  const searchInput = /** @type {HTMLInputElement | null} */ (byId('diary-search'));
  if (searchInput) searchInput.value = '';
}

export { render as renderDiary };
