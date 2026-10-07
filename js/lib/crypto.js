/* ==========================================================================
 * js/lib/crypto.js — 唯一加解密出口（纯函数，不持有任何状态）
 * --------------------------------------------------------------------------
 * 算法（AGENTS.md 4.2 / PRD 7.2）：
 *   - PBKDF2-SHA256 从主密码派生 AES-GCM-256 密钥，迭代次数由调用方传入
 *     （默认 210000，真值来自 db.security.iterations，便于将来提升迭代数而不写坏老数据）；
 *   - 密文统一为 { iv: "<base64>", ct: "<base64>" }；
 *   - 派生出的 CryptoKey 一律 extractable = false（无法被 exportKey 带走）。
 *
 * 安全红线：
 *   - 密钥与明文只存在于内存，本文件不保存任何模块级状态；
 *   - 全文件无 console 输出，错误对象只携带 code，不回带入参内容；
 *   - 仅使用浏览器原生 Web Crypto API（安全上下文要求：必须经 Live Server 访问）。
 * ========================================================================== */

import { bytesToBase64, base64ToBytes } from './utils.js';

export { bytesToBase64, base64ToBytes };

/** 密钥校验用的固定明文常量（不是秘密，可随代码分发） */
export const VERIFIER_PLAINTEXT = 'life-keeper:verifier:v1';

/** PBKDF2 迭代次数默认值（PRD 7.1） */
export const DEFAULT_ITERATIONS = 210000;

/** 盐长度（字节） */
export const SALT_BYTES = 16;

/** AES-GCM 推荐的 IV 长度（字节） */
export const IV_BYTES = 12;

/**
 * 加解密相关错误的统一类型：只带 code，不带任何明文 / 密钥 / 入参。
 */
export class CryptoError extends Error {
  /** @param {'CRYPTO_UNAVAILABLE' | 'INVALID_PAYLOAD' | 'DECRYPT_FAILED' | 'INVALID_ARGUMENT'} code */
  constructor(code) {
    super(`crypto:${code}`);
    this.name = 'CryptoError';
    this.code = code;
  }
}

/**
 * 当前环境是否可用 Web Crypto（file:// 或非安全上下文下为 false）。
 * @returns {boolean}
 */
export function isCryptoAvailable() {
  return (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined' &&
    globalThis.isSecureContext === true
  );
}

/** @returns {Crypto} */
function getCrypto() {
  if (!isCryptoAvailable()) throw new CryptoError('CRYPTO_UNAVAILABLE');
  return globalThis.crypto;
}

/**
 * 生成 16 字节随机盐。
 * @returns {Uint8Array}
 */
export function generateSalt() {
  return getCrypto().getRandomValues(new Uint8Array(SALT_BYTES));
}

/**
 * 由主密码派生 AES-GCM-256 密钥（non-extractable）。
 * @param {string} password 主密码明文（只在本次调用内使用，不落盘、不打印）
 * @param {Uint8Array} salt
 * @param {number} [iterations] 缺省 210000；不接受小于 210000 的值
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(password, salt, iterations = DEFAULT_ITERATIONS) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new CryptoError('INVALID_ARGUMENT');
  }
  if (!(salt instanceof Uint8Array) || salt.length === 0) {
    throw new CryptoError('INVALID_ARGUMENT');
  }
  if (!Number.isInteger(iterations) || iterations < DEFAULT_ITERATIONS) {
    throw new CryptoError('INVALID_ARGUMENT');
  }

  const subtle = getCrypto().subtle;
  // 用 TextEncoder 而非 encodeURIComponent：对孤立代理项不会抛错，且是标准 UTF-8
  const baseKey = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey'
  ]);

  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // extractable = false：密钥无法被导出
    ['encrypt', 'decrypt']
  );
}

/**
 * AES-GCM 加密。每次调用生成新的随机 12 字节 IV。
 * @param {CryptoKey} key
 * @param {string} plaintext
 * @returns {Promise<{iv: string, ct: string}>}
 */
export async function encrypt(key, plaintext) {
  if (!key || typeof plaintext !== 'string') throw new CryptoError('INVALID_ARGUMENT');
  const iv = getCrypto().getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await getCrypto().subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return { iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ct)) };
}

/**
 * AES-GCM 解密。任何失败（结构非法 / base64 非法 / GCM 校验不通过 / 密钥不匹配）
 * 一律抛出统一的 CryptoError('DECRYPT_FAILED')，避免向上层泄露失败细节。
 * @param {CryptoKey} key
 * @param {{iv: string, ct: string}} payload
 * @returns {Promise<string>}
 */
export async function decrypt(key, payload) {
  if (!key) throw new CryptoError('INVALID_ARGUMENT');
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.iv !== 'string' ||
    typeof payload.ct !== 'string' ||
    payload.iv.length === 0 ||
    payload.ct.length === 0
  ) {
    throw new CryptoError('INVALID_PAYLOAD');
  }

  try {
    const plainBuffer = await getCrypto().subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
      key,
      base64ToBytes(payload.ct)
    );
    return new TextDecoder().decode(plainBuffer);
  } catch {
    throw new CryptoError('DECRYPT_FAILED');
  }
}

/**
 * 生成主密码校验值：用派生密钥加密固定常量。
 * @param {CryptoKey} key
 * @returns {Promise<{iv: string, ct: string}>}
 */
export async function createVerifier(key) {
  return encrypt(key, VERIFIER_PLAINTEXT);
}

/**
 * 校验主密码是否正确。
 * @param {CryptoKey} key
 * @param {{iv: string, ct: string}} verifier
 * @returns {Promise<boolean>} 解密失败 / 结构非法 / 内容不符 一律返回 false，不抛错
 */
export async function verifyKey(key, verifier) {
  try {
    const plaintext = await decrypt(key, verifier);
    return plaintext === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}
