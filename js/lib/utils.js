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
 * 标签：记账与生活记录共用的落盘规则（去空白、去重、支持中英文逗号）
 * -------------------------------------------------------------------------- */

/**
 * 逗号分隔的标签文本 → 去重后的数组。
 * @param {string} text
 * @returns {string[]}
 */
export function parseTags(text) {
  if (typeof text !== 'string') return [];
  const seen = new Set();
  const result = [];
  for (const piece of text.split(/[,，]/)) {
    const tag = piece.trim();
    if (tag.length === 0 || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }
  return result;
}

/**
 * 标签数组 → 逗号分隔的输入框文本（编辑时回填用）。
 * @param {unknown} tags
 * @returns {string}
 */
export function formatTagsInput(tags) {
  if (!Array.isArray(tags)) return '';
  return tags.filter((tag) => typeof tag === 'string' && tag.length > 0).join('，');
}

/* --------------------------------------------------------------------------
 * 日历日期键（YYYY-MM-DD）工具：物品台账的保修计算用
 * -------------------------------------------------------------------------- */

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 把日期键解析为本地当天 00:00 的 Date。
 * 用 new Date(y, m-1, d) 而非 new Date('YYYY-MM-DD')：后者按 UTC 解析，
 * 在东八区会得到前一天 08:00，跨时区比较就会错一天。
 * @param {string} dateKey
 * @returns {Date | null}
 */
function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !DATE_KEY_PATTERN.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  // 反向校验：2026-02-31 这类非法日期会被 Date 归一化，此处予以拒绝
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Date → 日期键（YYYY-MM-DD，本地时区）。
 * @param {Date} date
 * @returns {string}
 */
function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 一天的毫秒数 */
const DAY_MS = 86_400_000;

/**
 * 临期窗口（天）：截止前 30 天内（含截止当天）为临期（PRD F4-3）。
 * 作为唯一真值放在这里，供物品台账与后续仪表盘共用。
 */
export const EXPIRING_WINDOW_DAYS = 30;

/**
 * 计算两个日期键之间相差的天数（按本地日期差，不受时区偏移影响）。
 * 两个日期都归一到本地 00:00，相加后取整可自动吸收夏令时造成的 23/25 小时日。
 * @param {string} fromKey
 * @param {string} toKey
 * @returns {number | null} toKey - fromKey（天）；任一非法时返回 null
 */
export function daysBetweenDateKeys(fromKey, toKey) {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * 保修状态判定（PRD F4-3：截止前 30 天内为临期，已过截止为过期）。
 * 规则：
 *   - 无保修日期 / 非法日期     → { status: null, days: null }
 *   - 截止当天（days = 0）      → EXPIRING，days 0
 *   - 还剩 1..30 天             → EXPIRING，days 1..30
 *   - 还剩 ≥ 31 天              → { status: null, days }
 *   - 已过截止（days < 0）      → EXPIRED，days 为已过天数（正数）
 * @param {unknown} warrantyDate 日期键 YYYY-MM-DD
 * @param {string} todayKey 今天（可注入，便于测试）
 * @returns {{status: 'EXPIRED' | 'EXPIRING' | null, days: number | null}}
 */
export function warrantyStatus(warrantyDate, todayKey) {
  const today = parseDateKey(todayKey);
  const target = parseDateKey(warrantyDate);
  if (!today || !target) return { status: null, days: null };

  const days = Math.round((target.getTime() - today.getTime()) / DAY_MS);
  if (days < 0) return { status: 'EXPIRED', days: -days };
  if (days <= EXPIRING_WINDOW_DAYS) return { status: 'EXPIRING', days };
  return { status: null, days };
}

/**
 * 日期键 + n 年（保修快捷「+1年 / +2年 / +3年」）。
 * 闰年 2 月 29 日在目标年份不存在时回退为 2 月 28 日。
 * @param {string} dateKey
 * @param {number} years
 * @returns {string} 新日期键；输入非法或 years 非整数时返回 ''
 */
export function addYearsToDate(dateKey, years) {
  const date = parseDateKey(dateKey);
  if (!date || !Number.isInteger(years)) return '';

  const targetYear = date.getFullYear() + years;
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const candidate = new Date(targetYear, month - 1, day);
  // 2 月 29 日在平年会被归一化到 3 月 1 日：回退到该月最后一天（即 2 月 28 日）
  if (candidate.getMonth() + 1 !== month) {
    return toDateKey(new Date(targetYear, month, 0));
  }
  return toDateKey(candidate);
}

/* --------------------------------------------------------------------------
 * 密码生成（纯逻辑；随机源为 crypto.getRandomValues）
 * -------------------------------------------------------------------------- */

/** 生成器长度可调范围（DESIGN.md F：长度滑杆 12–24） */
export const PASSWORD_LENGTH_MIN = 12;
export const PASSWORD_LENGTH_MAX = 24;
export const PASSWORD_LENGTH_DEFAULT = 16;

/** 生成器的固定小写字母池（大、小写由 upper 开关一并控制） */
const PASSWORD_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const PASSWORD_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PASSWORD_DIGITS = '0123456789';
const PASSWORD_SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?';

/**
 * 拒绝采样：返回 [0, bound) 上的均匀随机整数。
 *
 * 不能直接用 value % bound——2^32 通常不是 bound 的整数倍，
 * 取模会让较小的余数区间多分到一些样本，产生可观测的偏差。
 * 这里把采样空间截断到 bound 的最大整数倍，落在尾巴上的样本直接丢弃重取。
 * @param {number} bound
 * @returns {number}
 */
function randomIntBelow(bound) {
  if (!Number.isInteger(bound) || bound <= 0) {
    throw new RangeError('bound must be a positive integer');
  }
  const limit = Math.floor(0x1_0000_0000 / bound) * bound;
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    globalThis.crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % bound;
}

/**
 * 生成随机密码。
 * 多字符集时先给每个启用的字符集各放一个字符（保证「勾选了就一定有该字符」），
 * 其余位从合并池中取，最后整体洗牌。
 * @param {{length?: number, upper?: boolean, digits?: boolean, symbols?: boolean}} [options]
 * @returns {string}
 */
export function generatePassword(options = {}) {
  const requested = Number.isFinite(options.length) ? Math.trunc(options.length) : PASSWORD_LENGTH_DEFAULT;
  const length = Math.min(PASSWORD_LENGTH_MAX, Math.max(PASSWORD_LENGTH_MIN, requested));

  const upper = options.upper ?? true;
  const digits = options.digits ?? true;
  const symbols = options.symbols ?? true;

  /** @type {string[]} */
  const pools = [PASSWORD_LOWER];
  if (upper) pools.push(PASSWORD_UPPER);
  if (digits) pools.push(PASSWORD_DIGITS);
  if (symbols) pools.push(PASSWORD_SYMBOLS);

  const merged = pools.join('');
  /** @type {number[]} */
  const codes = [];

  // 每个启用的字符集先占一位（自身内部也做拒绝采样，避免集合内偏差）
  for (const pool of pools) {
    if (codes.length >= length) break;
    codes.push(pool.charCodeAt(randomIntBelow(pool.length)));
  }
  while (codes.length < length) {
    codes.push(merged.charCodeAt(randomIntBelow(merged.length)));
  }

  // Fisher–Yates 洗牌，避免「首位总是小写」这类可预测结构
  for (let i = codes.length - 1; i > 0; i -= 1) {
    const j = randomIntBelow(i + 1);
    const swap = codes[i];
    codes[i] = codes[j];
    codes[j] = swap;
  }

  return String.fromCharCode(...codes);
}

/* --------------------------------------------------------------------------
 * 收支聚合（仪表盘的纯逻辑层；输入输出都是普通数据，便于推演与测试）
 * --------------------------------------------------------------------------
 * 约定：
 *   - 金额一律以「分」为整数参与计算；
 *   - 月份的归组一律用「本地日期」，因此入参是 ISO 8601 带偏移字符串，
 *     内部用 localMonthKeyFromIso / localDayKeyFromIso 换算（不涉 UTC 截断）；
 *   - 所有函数对残缺数据（缺字段、非法日期）都做跳过而不是抛错。
 * -------------------------------------------------------------------------- */

/**
 * 取某月全部流水（不做类型/分类过滤）。
 * @param {object[]} transactions
 * @param {string} monthKey 形如 "2026-10"
 * @returns {object[]}
 */
export function transactionsOfMonth(transactions, monthKey) {
  if (!Array.isArray(transactions)) return [];
  return transactions.filter((entry) => localMonthKeyFromIso(entry?.date) === monthKey);
}

/**
 * 月度汇总：收入 / 支出 / 结余（结余 = 收入 − 支出）。
 * @param {object[]} transactions
 * @returns {{income: number, expense: number, balance: number}}
 */
export function summarizeTransactions(transactions) {
  let income = 0;
  let expense = 0;
  for (const entry of Array.isArray(transactions) ? transactions : []) {
    const cents = Number.isFinite(entry?.amountCents) ? Math.trunc(entry.amountCents) : 0;
    if (entry?.type === 'income') income += cents;
    else expense += cents;
  }
  return { income, expense, balance: income - expense };
}

/**
 * 分类占比（默认只统计支出）。
 * 结果按金额倒序；相同金额按分类名排序，保证渲染稳定。
 * percent 为占总额的百分比（0–100，保留一位小数）；
 * 总额为 0 时返回空数组。
 * @param {object[]} transactions
 * @param {{type?: 'expense' | 'income'}} [options]
 * @returns {Array<{category: string, amount: number, percent: number}>}
 */
export function categoryBreakdown(transactions, options = {}) {
  const type = options.type ?? 'expense';
  /** @type {Map<string, number>} */
  const totals = new Map();
  let sum = 0;

  for (const entry of Array.isArray(transactions) ? transactions : []) {
    if (entry?.type !== type) continue;
    const cents = Number.isFinite(entry?.amountCents) ? Math.trunc(entry.amountCents) : 0;
    const category = typeof entry?.category === 'string' && entry.category ? entry.category : '其他';
    totals.set(category, (totals.get(category) ?? 0) + cents);
    sum += cents;
  }

  if (sum <= 0) return [];

  return [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      percent: Math.round((amount / sum) * 1000) / 10
    }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, 'zh-Hans-CN'));
}

/**
 * 生成以 endMonthKey 结尾、向前 count 个月的连续月份键（升序）。
 * @param {string} endMonthKey 形如 "2026-10"
 * @param {number} [count]
 * @returns {string[]} 形如 ["2026-05", ..., "2026-10"]
 */
export function monthKeysEndingAt(endMonthKey, count = 6) {
  if (!/^\d{4}-\d{2}$/.test(String(endMonthKey)) || !Number.isInteger(count) || count < 1) return [];
  const keys = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const key = shiftMonthKey(endMonthKey, -offset);
    if (key) keys.push(key);
  }
  return keys;
}

/**
 * 近 N 个月收支分桶（默认 6 个月，以 endMonthKey 结尾）。
 * 无数据的月份同样返回（收入/支出为 0），供图表画空柱位。
 * @param {object[]} transactions
 * @param {string} endMonthKey
 * @param {number} [count]
 * @returns {Array<{monthKey: string, label: string, income: number, expense: number}>}
 */
export function monthlyTrendBuckets(transactions, endMonthKey, count = 6) {
  const keys = monthKeysEndingAt(endMonthKey, count);
  return keys.map((monthKey) => {
    const summary = summarizeTransactions(transactionsOfMonth(transactions, monthKey));
    return {
      monthKey,
      label: `${Number(monthKey.slice(5, 7))}月`,
      income: summary.income,
      expense: summary.expense
    };
  });
}

/**
 * 环比：当前值相对上期值的变化。
 *   - 上期为 0（或没有上期数据）→ percent 为 null，direction 为 'none'
 *     （界面据此隐藏环比文案，避免出现「+∞%」）
 *   - 上期非 0 → percent 为保留一位小数的百分比（可正可负），
 *     direction 为 'up' | 'down' | 'flat'
 * @param {number} current
 * @param {number} previous
 * @returns {{percent: number | null, direction: 'up' | 'down' | 'flat' | 'none', delta: number}}
 */
export function periodOverPeriod(current, previous) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safePrevious = Number.isFinite(previous) ? previous : 0;
  const delta = safeCurrent - safePrevious;

  if (safePrevious === 0) {
    return { percent: null, direction: 'none', delta };
  }

  const percent = Math.round((delta / Math.abs(safePrevious)) * 1000) / 10;
  let direction = 'flat';
  if (percent > 0) direction = 'up';
  else if (percent < 0) direction = 'down';
  return { percent, direction, delta };
}

/**
 * 取最近 N 条记录（按日期倒序）。
 * @param {object[]} list
 * @param {number} [count]
 * @returns {object[]}
 */
export function latestByDate(list, count = 3) {
  if (!Array.isArray(list)) return [];
  return [...list]
    .filter((entry) => localDayKeyFromIso(entry?.date) !== '')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, Math.max(0, count));
}

/* --------------------------------------------------------------------------
 * 备份：解析校验与合并（纯逻辑，不触碰存储与密钥）
 * --------------------------------------------------------------------------
 * 备份文件就是「整库快照」——与 life-keeper:db:v1 的 JSON 完全同构。
 * 加密备份里 credentials 的 password/note 仍是 { iv, ct } 密文，
 * 因此导出加密备份不需要密钥；只有明文导出才需要 sessionKey（在 main.js 完成）。
 * -------------------------------------------------------------------------- */

/** 备份文件约定的 app 标识 */
export const BACKUP_APP_ID = 'life-keeper';

/** 当前支持的 schemaVersion（更高版本一律拒绝，避免误解未知结构） */
export const BACKUP_SCHEMA_VERSION = 1;

/** 备份解析失败的错误码 */
export const BACKUP_ERRORS = {
  INVALID_JSON: 'INVALID_JSON',
  NOT_LIFEKEEPER: 'NOT_LIFEKEEPER',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  INVALID_SHAPE: 'INVALID_SHAPE'
};

/** 四个业务集合（与 storage.js 的 COLLECTIONS 保持一致） */
const BACKUP_COLLECTIONS = ['transactions', 'diaries', 'items', 'credentials'];

/**
 * 校验 verifier 是否为合法密文结构（与 storage.isValidVerifier 同规则）。
 * 这里再写一份是为了让 utils 不依赖 storage（保持 lib 层的单向依赖）。
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidCipher(value) {
  return (
    isPlainObject(value) &&
    typeof (/** @type {any} */ (value).iv) === 'string' &&
    /** @type {any} */ (value).iv.length > 0 &&
    typeof (/** @type {any} */ (value).ct) === 'string' &&
    /** @type {any} */ (value).ct.length > 0
  );
}

/**
 * 解析并校验备份文本。只读，绝不写盘。
 * @param {string} text
 * @returns {{ok: true, db: object, summary: {transactions: number, diaries: number, items: number, credentials: number}, hasSecurity: boolean, schemaVersion: number}
 *          | {ok: false, code: string}}
 */
export function parseBackup(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, code: BACKUP_ERRORS.INVALID_JSON };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, code: BACKUP_ERRORS.INVALID_JSON };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, code: BACKUP_ERRORS.NOT_LIFEKEEPER };
  }

  /** @type {Record<string, any>} */
  const raw = /** @type {any} */ (parsed);

  // app 标识：必须存在且匹配
  if (typeof raw.app !== 'string' || raw.app !== BACKUP_APP_ID) {
    return { ok: false, code: BACKUP_ERRORS.NOT_LIFEKEEPER };
  }

  // schemaVersion：必须是正整数且不高于当前支持版本
  if (!Number.isInteger(raw.schemaVersion) || raw.schemaVersion < 1) {
    return { ok: false, code: BACKUP_ERRORS.UNSUPPORTED_VERSION };
  }
  if (raw.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { ok: false, code: BACKUP_ERRORS.UNSUPPORTED_VERSION };
  }

  // 四个集合必须都是数组（缺失视为空数组，缺字段不算损坏）
  /** @type {Record<string, any[]>} */
  const collections = {};
  for (const name of BACKUP_COLLECTIONS) {
    const value = raw[name];
    if (value === undefined || value === null) {
      collections[name] = [];
      continue;
    }
    if (!Array.isArray(value)) {
      return { ok: false, code: BACKUP_ERRORS.INVALID_SHAPE };
    }
    collections[name] = value.filter(isPlainObject);
  }

  const security = isPlainObject(raw.security) ? /** @type {any} */ (raw.security) : {};
  const hasSecurity = typeof security.salt === 'string' && security.salt.length > 0 && isValidCipher(security.verifier);

  return {
    ok: true,
    db: {
      app: BACKUP_APP_ID,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      meta: isPlainObject(raw.meta) ? raw.meta : {},
      security,
      settings: isPlainObject(raw.settings) ? raw.settings : { theme: 'system', currency: 'CNY' },
      ...collections
    },
    summary: {
      transactions: collections.transactions.length,
      diaries: collections.diaries.length,
      items: collections.items.length,
      credentials: collections.credentials.length
    },
    hasSecurity,
    schemaVersion: raw.schemaVersion
  };
}

/**
 * 合并两个库：按 id 合并，同 id 以 incoming 为准，其余保留 current。
 * 四个集合互不污染；条目做浅拷贝，避免调用方后续改动影响到入参。
 * @param {object} current
 * @param {object} incoming
 * @returns {object} 合并后的新库（不修改任何入参）
 */
export function mergeDB(current, incoming) {
  const base = isPlainObject(current) ? /** @type {any} */ (current) : {};
  const add = isPlainObject(incoming) ? /** @type {any} */ (incoming) : {};

  /** @type {any} */
  const merged = deepClone(base);

  for (const name of BACKUP_COLLECTIONS) {
    const currentList = Array.isArray(base[name]) ? base[name] : [];
    const incomingList = Array.isArray(add[name]) ? add[name] : [];

    // 以 id 为键：先用现有条目铺底，再用备份条目覆盖同 id 的位置
    /** @type {Map<string, any>} */
    const byId = new Map();
    /** @type {any[]} */
    const withoutId = [];

    for (const entry of currentList) {
      if (!isPlainObject(entry)) continue;
      const id = typeof entry.id === 'string' && entry.id ? entry.id : '';
      if (id) byId.set(id, deepClone(entry));
      else withoutId.push(deepClone(entry));
    }

    /** @type {any[]} */
    const appended = [];
    for (const entry of incomingList) {
      if (!isPlainObject(entry)) continue;
      const id = typeof entry.id === 'string' && entry.id ? entry.id : '';
      if (id) {
        if (byId.has(id)) byId.set(id, deepClone(entry)); // 同 id：备份为准
        else appended.push(deepClone(entry)); // 新 id：追加
      } else {
        appended.push(deepClone(entry));
      }
    }

    merged[name] = [...withoutId, ...byId.values(), ...appended];
  }

  // security / settings：由调用方决定是否替换，这里只做结构保底
  merged.security = isPlainObject(base.security) ? deepClone(base.security) : {};
  merged.settings = isPlainObject(base.settings) ? deepClone(base.settings) : { theme: 'system', currency: 'CNY' };
  merged.app = BACKUP_APP_ID;
  merged.schemaVersion = Number.isInteger(base.schemaVersion) ? base.schemaVersion : BACKUP_SCHEMA_VERSION;
  merged.meta = isPlainObject(base.meta) ? deepClone(base.meta) : {};

  return merged;
}

/**
 * 备份自带的 security 是否「有效且与本地不同」。
 * 用于决定导入后是否需要锁定（换了主密码就必须重新解锁）。
 * @param {object} localSecurity
 * @param {object} incomingSecurity
 * @returns {boolean}
 */
export function isSecurityChanged(localSecurity, incomingSecurity) {
  const local = isPlainObject(localSecurity) ? /** @type {any} */ (localSecurity) : {};
  const incoming = isPlainObject(incomingSecurity) ? /** @type {any} */ (incomingSecurity) : {};

  const incomingValid =
    typeof incoming.salt === 'string' && incoming.salt.length > 0 && isValidCipher(incoming.verifier);
  if (!incomingValid) return false; // 备份没带可用凭据 → 不算变更

  if (typeof local.salt !== 'string' || local.salt !== incoming.salt) return true;
  if (!isValidCipher(local.verifier)) return true;

  return (
    /** @type {any} */ (local.verifier).iv !== incoming.verifier.iv ||
    /** @type {any} */ (local.verifier).ct !== incoming.verifier.ct
  );
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
