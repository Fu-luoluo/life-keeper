/* ==========================================================================
 * js/lib/utils.js — 通用工具（无依赖、无副作用、不持有状态）
 * --------------------------------------------------------------------------
 * 覆盖 v0.2 所需：时间（ISO 8601 带时区偏移）、日期展示、base64、节流、深拷贝、类型判定。
 * 约定：时间统一 ISO 8601；金额以「分」为整数；id 由 storage.js 用 crypto.randomUUID() 生成。
 * 安全：本文件不做任何 console 输出，也不接收密码类入参。
 * ========================================================================== */

/**
 * 字节数组 → base64 字符串。
 * 分块处理，避免对超长数组使用 Function.prototype.apply 造成栈溢出。
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE));
  }
  return btoa(binary);
}

/**
 * base64 字符串 → 字节数组。
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * 生成本地时区的 ISO 8601 字符串（带偏移，如 2026-10-07T13:41:00.123+08:00）。
 * 注意：不使用 toISOString()，它会把时间转成 UTC（+00:00），
 * 与 PRD 7.2「ISO 8601 字符串（带时区）」及示例中的 +08:00 不一致。
 * @param {Date} [date]
 * @returns {string}
 */
export function nowIso(date = new Date()) {
  const pad = (value, width = 2) => String(value).padStart(width, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}${offset}`
  );
}

const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/**
 * 生成本机日期文字，格式如「2026年10月7日 星期三」。
 * @param {Date} [date]
 * @returns {string}
 */
export function formatLocalDateText(date = new Date()) {
  const weekday = WEEKDAY_LABELS[date.getDay()] ?? '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`;
}

/**
 * 节流：在 waitMs 窗口内最多执行一次，且首次调用必定立即执行。
 * @template {(...args: any[]) => void} F
 * @param {F} fn
 * @param {number} waitMs
 * @returns {(...args: Parameters<F>) => void}
 */
export function throttle(fn, waitMs) {
  // 初值取 -Infinity 而非 0：保证首次调用一定执行，
  // 也避免在 Date.now() 恰好为 0（如被测试注入可控时钟）时被误判为「窗口内」。
  let lastRunAt = Number.NEGATIVE_INFINITY;
  return (...args) => {
    const now = Date.now();
    if (now - lastRunAt < waitMs) return;
    lastRunAt = now;
    fn(...args);
  };
}

/**
 * 递归克隆 JSON 兼容数据。
 * 本项目根结构只含字符串 / 数字 / 布尔 / null / 数组 / 普通对象，
 * 因此不需要 structuredClone（避免为 MVP 引入额外兼容性要求）。
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepClone(value) {
  if (Array.isArray(value)) return /** @type {any} */ (value.map((entry) => deepClone(entry)));
  if (value !== null && typeof value === 'object') {
    /** @type {Record<string, any>} */
    const result = {};
    for (const [key, entry] of Object.entries(value)) result[key] = deepClone(entry);
    return /** @type {any} */ (result);
  }
  return value;
}

/**
 * 是否为「普通对象」（排除 null 与数组）。
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 格式化为「剩余 N 秒」倒计时文本。
 * @param {number} msRemaining
 * @returns {string}
 */
export function formatRemainingSeconds(msRemaining) {
  const seconds = Math.max(0, Math.ceil(msRemaining / 1000));
  return `剩余 ${seconds} 秒`;
}

/* --------------------------------------------------------------------------
 * 金额：内部一律以「分」（整数）存储与计算（AGENTS.md 5 / PRD F2-5）
 * -------------------------------------------------------------------------- */

/** 金额前缀（PRD settings.currency 默认 CNY） */
export const CURRENCY_PREFIX = '¥';

/**
 * 分 → 显示用金额文本，千分位 + 两位小数 + 前缀，如 128650 → "¥1,286.50"。
 * 负数会得到 "-¥12.50"（负号在货币符号前，符合中文排版习惯）。
 * @param {number} amountCents
 * @param {{signed?: boolean}} [options] signed 为 true 时正数也带 "+"
 * @returns {string}
 */
export function formatCurrency(amountCents, options = {}) {
  const value = Number.isFinite(amountCents) ? Math.trunc(amountCents) : 0;
  const minus = value < 0 ? '-' : options.signed === true && value > 0 ? '+' : '';
  const absolute = Math.abs(value);

  const yuan = Math.floor(absolute / 100);
  const cents = absolute % 100;
  const grouped = String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${minus}${CURRENCY_PREFIX}${grouped}.${String(cents).padStart(2, '0')}`;
}

/** 金额输入允许的格式：整数或最多两位小数，不接受符号、千分位、科学计数法 */
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * 金额文本 → 分（整数）。
 * 只接受 /^\d+(\.\d{1,2})?$/；非法格式、非正数（0 / 0.00）一律返回 null。
 *
 * 实现要点：**不对浮点数做乘法**。把「元」与「小数位」当作字符串分别处理，
 * 元部分用 BigInt 承载（避免超长整数在 Number 下丢精度），
 * 分部分按缺失位数补零，因此 12.5 → 1250、0.01 → 1 都是精确值。
 *
 * @param {string | number} text
 * @returns {number | null} 分为单位的正整数；无法解析或非正数时返回 null
 */
export function parseAmountToCents(text) {
  const raw = typeof text === 'number' ? String(text) : typeof text === 'string' ? text : '';
  const trimmed = raw.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return null;

  const [yuanPart, decimalPart = ''] = trimmed.split('.');
  const paddedDecimals = (decimalPart + '00').slice(0, 2);

  let cents;
  try {
    cents = Number(BigInt(yuanPart) * 100n + BigInt(paddedDecimals));
  } catch {
    return null;
  }

  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

/* --------------------------------------------------------------------------
 * 时间：本地输入 ↔ ISO 8601（带偏移）
 * -------------------------------------------------------------------------- */

const pad2 = (value) => String(value).padStart(2, '0');

/**
 * 从 ISO 8601（带偏移）字符串取出**本地**日期部分。
 * Date 的 getFullYear/getMonth/getDate 本身就按本地时区换算，
 * 因此 "2026-10-06T12:20:00+08:00" 在东八区得到 2026-10-06。
 * @param {string} iso
 * @returns {{year: number, month: number, day: number} | null}
 */
export function localDatePartsFromIso(iso) {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/**
 * 从 ISO 8601 取「YYYY-MM」（按月切换 / 月度汇总用）。
 * @param {string} iso
 * @returns {string} 如 "2026-10"；无法解析时返回 ''
 */
export function localMonthKeyFromIso(iso) {
  const parts = localDatePartsFromIso(iso);
  if (!parts) return '';
  return `${parts.year}-${pad2(parts.month)}`;
}

/**
 * 从 ISO 8601 取「YYYY-MM-DD」（按日分组用）。
 * @param {string} iso
 * @returns {string} 如 "2026-10-06"；无法解析时返回 ''
 */
export function localDayKeyFromIso(iso) {
  const parts = localDatePartsFromIso(iso);
  if (!parts) return '';
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/**
 * 某个「YYYY-MM-DD」的星期文本，如 "星期二"。
 * 用 Date(y, m-1, d) 构造，得到的是本地当天 00:00，不受时区偏移影响。
 * @param {string} dayKey
 * @returns {string} 无法解析时返回 ''
 */
export function weekdayOfDayKey(dayKey) {
  if (typeof dayKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return '';
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return WEEKDAY_LABELS[date.getDay()] ?? '';
}

/**
 * 把本地日期时间编码为 ISO 8601（带本地时区偏移），用于落盘。
 * @param {Date} date
 * @returns {string} 如 "2026-10-06T12:20:00.000+08:00"
 */
export function localDateToIso(date = new Date()) {
  return nowIso(date);
}

/**
 * ISO 8601 → datetime-local 输入框可用的值（"YYYY-MM-DDTHH:mm"）。
 * @param {string} iso
 * @returns {string} 无法解析时返回 ''
 */
export function isoToLocalInputValue(iso) {
  if (typeof iso !== 'string' || iso.length === 0) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  );
}

/**
 * datetime-local 输入框的值 → ISO 8601（带本地时区偏移）。
 * 输入值不含时区信息，按本地时间解读后再生成偏移。
 * @param {string} value 形如 "2026-10-06T12:20"
 * @returns {string} 无法解析时返回 ''
 */
export function localInputValueToIso(value) {
  if (typeof value !== 'string') return '';
  const matched = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!matched) return '';
  const [, year, month, day, hour, minute, second = '00'] = matched;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  if (Number.isNaN(date.getTime())) return '';
  // 反向校验：输入 2026-02-31 这类非法日期会被 Date 归一化，此处予以拒绝
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  ) {
    return '';
  }
  return nowIso(date);
}

/**
 * 取某个「YYYY-MM」月份的前后相邻月份。
 * @param {string} monthKey 形如 "2026-10"
 * @param {number} delta 负数往前、正数往后
 * @returns {string} 形如 "2026-11"
 */
export function shiftMonthKey(monthKey, delta) {
  const matched = String(monthKey).match(/^(\d{4})-(\d{2})$/);
  if (!matched) return '';
  const base = new Date(Number(matched[1]), Number(matched[2]) - 1, 1);
  base.setMonth(base.getMonth() + delta);
  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}`;
}

/**
 * 当前月份键，如 "2026-10"。
 * @param {Date} [date]
 * @returns {string}
 */
export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

/**
 * 月份标题，如 "2026年10月"。
 * @param {string} monthKey
 * @returns {string}
 */
export function formatMonthKeyText(monthKey) {
  const matched = String(monthKey).match(/^(\d{4})-(\d{2})$/);
  if (!matched) return '';
  return `${Number(matched[1])}年${Number(matched[2])}月`;
}

/**
 * 分组标题：今天 / 昨天 / M月D日 星期X。
 * @param {string} dayKey 形如 "2026-10-06"
 * @param {Date} [today] 取数基准，便于测试注入
 * @returns {string}
 */
export function formatDayGroupTitle(dayKey, today = new Date()) {
  if (typeof dayKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return '';
  const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${pad2(yesterday.getMonth() + 1)}-${pad2(yesterday.getDate())}`;

  if (dayKey === todayKey) return '今天';
  if (dayKey === yesterdayKey) return '昨天';

  const [, month, day] = dayKey.split('-').map(Number);
  const weekday = weekdayOfDayKey(dayKey);
  return `${month}月${day}日 ${weekday}`;
}
