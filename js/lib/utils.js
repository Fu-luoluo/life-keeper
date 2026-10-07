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
