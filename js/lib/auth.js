/* ==========================================================================
 * js/lib/auth.js — M0 初始化/解锁 + M6 修改主密码的纯逻辑层
 * --------------------------------------------------------------------------
 * 设计原则：
 *   - 不持有会话密钥，也不导入 main.js：密钥由调用方（main.js 的单一模块变量）传入；
 *   - 不碰 DOM、不碰 location，只做「派生 → 校验 → 落盘」与错误码；
 *   - 全文件无 console 输出，AuthError 只携带 code，绝不回带密码内容；
 *   - 本文件是唯一编排 crypto.js 与 storage.js 的地方。
 *
 * 强度条规则（与用户确认的方案一致，仅提示、不阻断）：
 *   长度 < 8 → 1 段「弱」；否则基分 1 +（长度≥12）+（同时含小写与大写）+（含数字）+（含符号），
 *   分别映射为 2「中」/ 3「强」/ 4「极强」。
 *   阻断提交的条件只有两条：长度 ≥ 8、两次输入一致。
 * ========================================================================== */

import {
  createVerifier,
  decrypt,
  deriveKey,
  encrypt,
  generateSalt,
  verifyKey
} from './crypto.js';
import {
  DEFAULT_ITERATIONS,
  clearAll,
  getCollection,
  getSecurity,
  isValidVerifier,
  mutateDB,
  patchSecurity
} from './storage.js';
import { base64ToBytes, bytesToBase64, deepClone } from './utils.js';

/** 主密码最小长度（PRD F0-1） */
export const MIN_PASSWORD_LENGTH = 8;

/** 连续失败上限（PRD F0-2） */
export const MAX_FAILED_ATTEMPTS = 5;

/** 冷却时长（毫秒，PRD F0-2 的 30 秒） */
export const COOLDOWN_MS = 30_000;

/** 强度标签（DESIGN.md F：弱 / 中 / 强 / 极强） */
export const STRENGTH_LABELS = { 1: '弱', 2: '中', 3: '强', 4: '极强' };

/**
 * 认证层统一错误：只带 code，便于界面层映射为文案。
 */
export class AuthError extends Error {
  /**
   * @param {'PASSWORD_TOO_SHORT' | 'PASSWORD_MISMATCH' | 'PASSWORD_REQUIRED' | 'WRONG_OLD_PASSWORD' | 'WRONG_PASSWORD' | 'VERIFIER_MISSING' | 'REENCRYPT_FAILED'} code
   */
  constructor(code) {
    super(`auth:${code}`);
    this.name = 'AuthError';
    this.code = code;
  }
}

/* --------------------------------------------------------------------------
 * 强度评估（纯函数，便于自检）
 * -------------------------------------------------------------------------- */

/**
 * 评估密码强度。
 * @param {string} password
 * @returns {{score: 1|2|3|4, label: string, segments: number}}
 */
export function evaluateStrength(password = '') {
  const value = typeof password === 'string' ? password : '';
  let score = 1;

  if (value.length >= MIN_PASSWORD_LENGTH) {
    score = 1;
    if (value.length >= 12) score += 1;
    const hasLower = /[a-z]/.test(value);
    const hasUpper = /[A-Z]/.test(value);
    if (hasLower && hasUpper) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    score = Math.min(4, score);
  }

  const normalized = /** @type {1|2|3|4} */ (score);
  return { score: normalized, label: STRENGTH_LABELS[normalized], segments: normalized };
}

/**
 * 校验主密码输入（长度 + 二次确认）。不阻断弱密码，只阻断不合规。
 * @param {string} password
 * @param {string} confirmation
 * @returns {{ok: true} | {ok: false, code: 'PASSWORD_REQUIRED' | 'PASSWORD_TOO_SHORT' | 'PASSWORD_MISMATCH'}}
 */
export function validatePasswordInput(password, confirmation) {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, code: 'PASSWORD_REQUIRED' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, code: 'PASSWORD_TOO_SHORT' };
  }
  if (password !== confirmation) {
    return { ok: false, code: 'PASSWORD_MISMATCH' };
  }
  return { ok: true };
}

/* --------------------------------------------------------------------------
 * 失败计数与冷却（仅内存，刷新即重置）
 * -------------------------------------------------------------------------- */

/**
 * 创建登录失败计数器（闭包持有状态，不落盘）。
 * @param {{maxAttempts?: number, cooldownMs?: number, now?: () => number}} [options]
 */
export function createAttemptLimiter(options = {}) {
  const maxAttempts = options.maxAttempts ?? MAX_FAILED_ATTEMPTS;
  const cooldownMs = options.cooldownMs ?? COOLDOWN_MS;
  const now = options.now ?? (() => Date.now());

  let failures = 0;
  let cooldownUntil = 0;

  return {
    /** @returns {number} */
    getFailures() {
      return failures;
    },
    /** @param {number} [at] */
    getCooldownRemainingMs(at = now()) {
      return Math.max(0, cooldownUntil - at);
    },
    /** @param {number} [at] */
    isCoolingDown(at = now()) {
      return this.getCooldownRemainingMs(at) > 0;
    },
    /**
     * 记录一次失败。
     * @returns {{failures: number, cooldownMs: number}}
     */
    registerFailure() {
      failures += 1;
      let startedCooldown = 0;
      if (failures >= maxAttempts) {
        cooldownUntil = now() + cooldownMs;
        startedCooldown = cooldownMs;
        failures = 0; // 冷却开始后重新计数，避免冷却结束立刻又触发一轮
      }
      return { failures, cooldownMs: startedCooldown };
    },
    reset() {
      failures = 0;
      cooldownUntil = 0;
    }
  };
}

/* --------------------------------------------------------------------------
 * 初始化 / 解锁
 * -------------------------------------------------------------------------- */

/**
 * 首次设置主密码：生成 salt → 派生密钥 → 写入 verifier 与 security。
 * @param {string} password
 * @param {{iterations?: number}} [options]
 * @returns {Promise<{key: CryptoKey, salt: string}>}
 */
export async function setupMasterPassword(password, options = {}) {
  if (typeof password !== 'string' || password.length === 0) throw new AuthError('PASSWORD_REQUIRED');
  if (password.length < MIN_PASSWORD_LENGTH) throw new AuthError('PASSWORD_TOO_SHORT');

  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const saltBytes = generateSalt();
  const key = await deriveKey(password, saltBytes, iterations);
  const verifier = await createVerifier(key);

  await patchSecurity({
    kdf: 'PBKDF2',
    iterations,
    salt: bytesToBase64(saltBytes),
    verifier
  });

  return { key, salt: bytesToBase64(saltBytes) };
}

/**
 * 解锁：按库中 salt/iterations 派生密钥并校验 verifier。
 * 无论成功失败都不返回 / 打印任何密码内容。
 * @param {string} password
 * @returns {Promise<{ok: true, key: CryptoKey} | {ok: false, code: 'PASSWORD_REQUIRED' | 'VERIFIER_MISSING' | 'WRONG_PASSWORD'}>}
 */
export async function unlock(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, code: 'PASSWORD_REQUIRED' };
  }

  const security = await getSecurity();
  if (!security.salt || !isValidVerifier(security.verifier)) {
    return { ok: false, code: 'VERIFIER_MISSING' };
  }

  const key = await deriveKey(password, base64ToBytes(security.salt), security.iterations);
  const passed = await verifyKey(key, security.verifier);
  return passed ? { ok: true, key } : { ok: false, code: 'WRONG_PASSWORD' };
}

/**
 * 用给定密钥校验主密码是否正确（已解锁状态下验证旧密码 / 清空数据前验证）。
 * @param {string} password
 * @param {{key?: CryptoKey, iterations?: number}} [options] 传入 key 可跳过重新派生
 * @returns {Promise<boolean>}
 */
export async function verifyMasterPassword(password, options = {}) {
  if (typeof password !== 'string' || password.length === 0) return false;

  if (options.key) return verifyKey(options.key, (await getSecurity()).verifier);

  const result = await unlock(password);
  return result.ok === true;
}

/* --------------------------------------------------------------------------
 * 修改主密码 + 重加密
 * -------------------------------------------------------------------------- */

/**
 * 用新密钥重新加密 credentials 集合中的密文字段。
 * 当前 credentials 为空 → 空转通过，逻辑保留给 v0.6 直接复用。
 *
 * 原子性保证：先在内存中解密并加密出全新的 records，
 * 任何一步失败都不写盘；只有全部成功才用 replaceAll 一次性整体替换。
 * @param {CryptoKey} oldKey
 * @param {CryptoKey} newKey
 * @returns {Promise<{reencrypted: number}>}
 */
export async function reencryptAll(oldKey, newKey) {
  const credentials = await getCollection('credentials');
  /** @type {any[]} */
  const reencrypted = [];

  try {
    for (const credential of credentials) {
      const next = deepClone(credential);
      for (const field of ['password', 'note']) {
        const value = next[field];
        if (value && typeof value === 'object' && typeof value.iv === 'string' && typeof value.ct === 'string') {
          const plaintext = await decrypt(oldKey, value);
          next[field] = await encrypt(newKey, plaintext);
        }
      }
      reencrypted.push(next);
    }
  } catch {
    // 不把任何密文 / 明文细节向上抛
    throw new AuthError('REENCRYPT_FAILED');
  }

  if (reencrypted.length > 0) {
    await mutateDB((db) => {
      db.credentials = reencrypted;
    });
  }

  return { reencrypted: reencrypted.length };
}

/**
 * 修改主密码：验证旧密码 → 生成新 salt/verifier → 重加密全部密文 → 落盘。
 * 成功返回新密钥，由调用方放入 main.js 的会话变量，保持解锁状态。
 * @param {string} oldPassword
 * @param {string} newPassword
 * @param {string} newPasswordConfirmation
 * @returns {Promise<{key: CryptoKey}>}
 */
export async function changeMasterPassword(oldPassword, newPassword, newPasswordConfirmation) {
  const validation = validatePasswordInput(newPassword, newPasswordConfirmation);
  if (!validation.ok) throw new AuthError(validation.code);

  const current = await unlock(oldPassword);
  if (!current.ok) {
    throw new AuthError(current.code === 'VERIFIER_MISSING' ? 'VERIFIER_MISSING' : 'WRONG_OLD_PASSWORD');
  }

  const security = await getSecurity();
  const iterations = security.iterations ?? DEFAULT_ITERATIONS;

  const saltBytes = generateSalt();
  const newKey = await deriveKey(newPassword, saltBytes, iterations);
  const verifier = await createVerifier(newKey);

  // 先重加密（失败则整库不动），再切换 salt/verifier
  await reencryptAll(current.key, newKey);
  await patchSecurity({ salt: bytesToBase64(saltBytes), verifier });

  return { key: newKey };
}

/* --------------------------------------------------------------------------
 * 清空数据（两条路径共用的底层动作）
 * -------------------------------------------------------------------------- */

/**
 * 清空所有数据。调用方负责决定是否需要先验证主密码：
 *   - 设置页（已解锁）路径：先 verifyMasterPassword；
 *   - 解锁页 / 数据损坏门禁路径：这是忘记主密码的恢复路径，禁止要求验证主密码。
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  await clearAll();
}

/* --------------------------------------------------------------------------
 * 供界面层复用的常量
 * -------------------------------------------------------------------------- */

/** 错误码 → 简体中文文案（集中管理，PRD 第 8 节「文案集中管理」） */
export const AUTH_MESSAGES = {
  PASSWORD_REQUIRED: '请输入主密码',
  PASSWORD_TOO_SHORT: `主密码至少 ${MIN_PASSWORD_LENGTH} 位`,
  PASSWORD_MISMATCH: '两次输入的主密码不一致',
  WRONG_PASSWORD: '主密码错误',
  WRONG_OLD_PASSWORD: '旧密码不正确',
  VERIFIER_MISSING: '本机尚未设置主密码',
  REENCRYPT_FAILED: '重新加密失败，主密码未修改',
  COOLDOWN: '尝试次数过多，请稍后重试'
};

/**
 * 把错误码映射为文案。
 * @param {string} code
 * @returns {string}
 */
export function messageOf(code) {
  return AUTH_MESSAGES[code] ?? '操作失败，请重试';
}
