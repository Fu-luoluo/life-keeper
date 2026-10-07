/* ==========================================================================
 * js/lib/storage.js 鈥?鍞竴鏁版嵁璁块棶灞? * --------------------------------------------------------------------------
 * 閾佸緥锛圓GENTS.md 5 / PRD 9.1锛夛細
 *   涓氬姟妯″潡绂佹鐩存帴璇诲啓 localStorage / IndexedDB锛屼竴寰嬬粡鐢辨湰鏂囦欢銆? *
 * 缁撴瀯锛歅RD 7.1 鐨勫崟涓€鏁版嵁婧愶紝localStorage 閿悕 'life-keeper:db:v1'銆? *
 * 銆屾棤缂濇浛鎹负 IndexedDB銆嶇殑涓夋潯璁捐淇濊瘉锛? *   1. 鎵€鏈夊叕寮€鎺ュ彛涓€寮€濮嬪氨鏄?async 鈥斺€?璋冪敤鏂规棤闇€鍥犲垏鎹粙璐ㄨ€屾敼 await锛? *   2. 鍙緷璧?driver 鐨勪笁涓師璇細readRaw / writeRaw / removeRaw锛? *      鏇挎崲浠嬭川 = 鎹竴涓?driver 瀵硅薄锛屽叕寮€鎺ュ彛绛惧悕涓庤涔夊畬鍏ㄤ笉鍙橈紱
 *   3. 鏈枃浠舵槸鍏ㄩ」鐩敮涓€寮曠敤鎸佷箙浠嬭川鐨勫湴鏂癸紝涓氬姟妯″潡涓嶆劅鐭ヤ粙璐ㄣ€? *
 * 鍐欐搷浣滀竴寰嬨€屽厛璇荤洏 鈫?鏀?鈫?鏁翠綋鍐欏洖銆嶏紝涓嶅仛闀挎湡鍐呭瓨缂撳瓨锛? * 鍥犳澶氭爣绛鹃〉鍚屾椂鍐欎笉浼氫骇鐢熻剰鍐欙紙閰嶅悎 onExternalChange 閫氱煡 UI 鍒锋柊锛夈€? * ========================================================================== */

import { deepClone, isPlainObject, nowIso } from './utils.js';

/** localStorage 閿悕锛圥RD 7.1锛?*/
export const DB_KEY = 'life-keeper:db:v1';

/** 鍥涗釜涓氬姟闆嗗悎锛堥敭鍚嶄笌 PRD 7.1 瀹屽叏涓€鑷达級 */
export const COLLECTIONS = ['transactions', 'diaries', 'items', 'credentials'];

/** 榛樿鑷姩閿佸畾鏃堕暱锛堝垎閽燂級 */
export const DEFAULT_AUTO_LOCK_MINUTES = 5;

/** PBKDF2 榛樿杩唬娆℃暟锛堜笌 crypto.js 鐨?DEFAULT_ITERATIONS 淇濇寔涓€鑷达級 */
export const DEFAULT_ITERATIONS = 210000;

/** 鍏佽鍐欏叆 settings 鐨勯敭 */
const SETTINGS_KEYS = ['theme', 'currency'];

/** 鍏佽鍐欏叆 security 鐨勯敭 */
const SECURITY_KEYS = ['kdf', 'iterations', 'salt', 'verifier', 'autoLockMinutes'];

/** 姣忔潯璁板綍鐨勫叕鍏卞彲鍙樺瓧娈?*/
const COMMON_MUTABLE_FIELDS = ['tags'];

/** 鍚勯泦鍚堝厑璁?update 鍚堝苟鐨勫瓧娈电櫧鍚嶅崟锛坕d / createdAt / updatedAt 鐢辨湰灞傜嫭鍗犵鐞嗭級 */
const MUTABLE_FIELDS = {
  transactions: ['type', 'amountCents', 'category', 'account', 'date', 'note'],
  diaries: ['title', 'content', 'mood', 'date'],
  items: ['name', 'category', 'location', 'quantity', 'purchaseDate', 'warrantyUntil', 'note'],
  credentials: ['title', 'site', 'url', 'username', 'password', 'note', 'category']
};

/**
 * 瀛樺偍灞傜粺涓€閿欒锛氫笂灞傚彧鍒?code锛屼笉瑙ｆ瀽瀛楃涓层€? */
export class StorageError extends Error {
  /**
   * @param {'DB_CORRUPTED' | 'DB_INVALID' | 'UNKNOWN_COLLECTION' | 'NOT_FOUND' | 'WRITE_FAILED' | 'INVALID_ARGUMENT'} code
   * @param {string} [detail] 浠呯敤浜庡紑鍙戞帓鏌ョ殑绠€鐭鏄庯紝绂佹鏀惧叆鐢ㄦ埛鏁版嵁 / 瀵嗙爜 / 瀵嗛挜
   */
  constructor(code, detail = '') {
    super(detail ? `storage:${code}:${detail}` : `storage:${code}`);
    this.name = 'StorageError';
    this.code = code;
  }
}

/**
 * verifier 鏄惁涓哄悎娉曠殑瀵嗘枃缁撴瀯 { iv, ct }锛堝潎涓洪潪绌?base64 瀛楃涓诧級銆? *
 * 娉ㄦ剰锛歷erifier 鏄瘑鏂囧璞¤€屼笉鏄瓧绗︿覆锛圥RD 7.2锛氬瘑鏂囩粺涓€涓?{ iv, ct }锛夈€? * 鏇惧洜鍙帴鍙?string 瀵艰嚧姣忔璇荤洏閮芥妸 verifier 涓㈡帀锛岃繘鑰岃鍚庣画鍐欐搷浣滆鐩栨垚绌哄€硷紝
 * 浣垮凡鍒濆鍖栫殑搴撻€€鍖栨垚銆屾湭鍒濆鍖栥€嶏紝鍥犳杩欓噷蹇呴』鎸夊璞＄粨鏋勪弗鏍兼牎楠屻€? * @param {unknown} value
 * @returns {boolean}
 */
export function isValidVerifier(value) {
  return (
    isPlainObject(value) &&
    typeof (/** @type {any} */ (value).iv) === 'string' &&
    /** @type {any} */ (value).iv.length > 0 &&
    typeof (/** @type {any} */ (value).ct) === 'string' &&
    /** @type {any} */ (value).ct.length > 0
  );
}

/* --------------------------------------------------------------------------
 * 椹卞姩灞傦紙鍞竴闇€瑕佹浛鎹㈢殑鍦版柟锛? * -------------------------------------------------------------------------- */

/**
 * @typedef {object} StorageDriver
 * @property {() => Promise<string | null>} readRaw
 * @property {(text: string) => Promise<void>} writeRaw
 * @property {() => Promise<void>} removeRaw
 */

/** @type {StorageDriver} */
const localStorageDriver = {
  async readRaw() {
    return globalThis.localStorage.getItem(DB_KEY);
  },
  async writeRaw(text) {
    globalThis.localStorage.setItem(DB_KEY, text);
  },
  async removeRaw() {
    globalThis.localStorage.removeItem(DB_KEY);
  }
};

/**
 * IndexedDB 椹卞姩锛堝綋鍓嶆湭鍚敤锛屼粎浣滀负銆屾崲浠嬭川銆嶇殑钀界偣淇濈暀鍦ㄥ悓涓€鏂囦欢鍐咃級銆? * 涓?localStorage 椹卞姩璇箟绛変环锛氭暣浣撳瓨涓€涓?JSON 瀛楃涓层€? * 鍚敤鏂瑰紡锛氭妸涓嬫柟鐨?`driver` 甯搁噺鏀逛负 `indexedDBDriver`銆? * @type {StorageDriver}
 */
// eslint-disable-next-line no-unused-vars
const indexedDBDriver = {
  DB_NAME: 'life-keeper',
  STORE_NAME: 'kv',
  _dbPromise: /** @type {Promise<IDBDatabase> | null} */ (null),

  /** @returns {Promise<IDBDatabase>} */
  _open() {
    if (!this._dbPromise) {
      const storeName = this.STORE_NAME;
      this._dbPromise = new Promise((resolve, reject) => {
        const request = globalThis.indexedDB.open(this.DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this._dbPromise;
  },

  /**
   * @param {IDBTransactionMode} mode
   * @returns {Promise<IDBObjectStore>}
   */
  async _store(mode) {
    const db = await this._open();
    return db.transaction(this.STORE_NAME, mode).objectStore(this.STORE_NAME);
  },

  async readRaw() {
    const store = await this._store('readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(DB_KEY);
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  },

  async writeRaw(text) {
    const store = await this._store('readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(text, DB_KEY);
      request.onsuccess = () => resolve(undefined);
      request.onerror = () => reject(request.error);
    });
  },

  async removeRaw() {
    const store = await this._store('readwrite');
    await new Promise((resolve, reject) => {
      const request = store.delete(DB_KEY);
      request.onsuccess = () => resolve(undefined);
      request.onerror = () => reject(request.error);
    });
  }
};

/** 褰撳墠鐢熸晥鐨勯┍鍔細鎹㈡垚 indexedDBDriver 鍗冲彲鍒囨崲浠嬭川锛屽叕寮€鎺ュ彛鏃犻渶鏀瑰姩 */
const driver = localStorageDriver;

/* --------------------------------------------------------------------------
 * 鍐呴儴宸ュ叿
 * -------------------------------------------------------------------------- */

/**
 * @param {string} collection
 * @returns {string} 鏍￠獙閫氳繃鐨勯泦鍚堝悕
 */
function assertCollection(collection) {
  if (!COLLECTIONS.includes(collection)) {
    throw new StorageError('UNKNOWN_COLLECTION', String(collection));
  }
  return collection;
}

/**
 * 鏋勯€犲叏鏂版暟鎹簱瀵硅薄锛圥RD 7.1锛夈€? * @returns {object}
 */
function createEmptyDB() {
  const timestamp = nowIso();
  return {
    app: 'life-keeper',
    schemaVersion: 1,
    meta: { createdAt: timestamp, updatedAt: timestamp },
    security: {
      kdf: 'PBKDF2',
      iterations: DEFAULT_ITERATIONS,
      salt: '',
      verifier: null,
      autoLockMinutes: DEFAULT_AUTO_LOCK_MINUTES
    },
    settings: { theme: 'system', currency: 'CNY' },
    transactions: [],
    diaries: [],
    items: [],
    credentials: []
  };
}

/**
 * 瑙勮寖鍖栦换鎰忚緭鍏ヤ负鍚堟硶鏍圭粨鏋勶細缂哄瓧娈佃ˉ榛樿鍊笺€佺被鍨嬩笉绗﹀洖閫€榛樿鍊笺€? * 娉ㄦ剰锛氭湰鍑芥暟涓嶆姏閿欙紙鍙湁銆屾棤娉曡В鏋?/ 鏍逛笉鏄璞°€嶆墠鐢辫皟鐢ㄦ柟鍒ゅ畾涓烘崯鍧忥級锛? * 杩欐牱涓€浠藉瓧娈典笉鍏ㄧ殑澶囦唤涔熻兘琚畨鍏ㄥ鍏ワ紝鑰屼笉鏄妸鐣岄潰鐩存帴鎵撳穿銆? * @param {unknown} raw
 * @returns {object}
 */
function normalizeDB(raw) {
  const base = createEmptyDB();
  if (!isPlainObject(raw)) return base;

  /** @type {Record<string, any>} */
  const source = /** @type {any} */ (raw);
  const db = base;

  if (typeof source.schemaVersion === 'number' && Number.isFinite(source.schemaVersion)) {
    db.schemaVersion = source.schemaVersion;
  }
  if (isPlainObject(source.meta)) {
    const meta = /** @type {any} */ (source.meta);
    if (typeof meta.createdAt === 'string' && meta.createdAt) db.meta.createdAt = meta.createdAt;
    if (typeof meta.updatedAt === 'string' && meta.updatedAt) db.meta.updatedAt = meta.updatedAt;
  }

  if (isPlainObject(source.security)) {
    const security = /** @type {any} */ (source.security);
    if (typeof security.kdf === 'string' && security.kdf) db.security.kdf = security.kdf;
    if (
      Number.isInteger(security.iterations) &&
      security.iterations >= DEFAULT_ITERATIONS
    ) {
      db.security.iterations = security.iterations;
    }
    if (typeof security.salt === 'string') db.security.salt = security.salt;
    if (isValidVerifier(security.verifier)) {
      db.security.verifier = { iv: security.verifier.iv, ct: security.verifier.ct };
    }
    if (Number.isInteger(security.autoLockMinutes) && security.autoLockMinutes > 0) {
      db.security.autoLockMinutes = security.autoLockMinutes;
    }
  }

  if (isPlainObject(source.settings)) {
    const settings = /** @type {any} */ (source.settings);
    if (typeof settings.theme === 'string' && settings.theme) db.settings.theme = settings.theme;
    if (typeof settings.currency === 'string' && settings.currency) {
      db.settings.currency = settings.currency;
    }
  }

  for (const collection of COLLECTIONS) {
    if (Array.isArray(source[collection])) {
      db[collection] = /** @type {any[]} */ (source[collection]).filter(isPlainObject);
    }
  }

  return db;
}

/**
 * 璇诲彇骞惰В鏋愬簱锛涢敭涓嶅瓨鍦ㄨ繑鍥?null锛涘唴瀹规崯鍧忔姏 StorageError('DB_CORRUPTED')銆? * @returns {Promise<object | null>}
 */
async function readDB() {
  const text = await driver.readRaw();
  if (text === null || text === undefined || text === '') return null;

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new StorageError('DB_CORRUPTED', 'json-parse');
  }
  if (!isPlainObject(parsed)) throw new StorageError('DB_CORRUPTED', 'not-an-object');

  return normalizeDB(parsed);
}

/**
 * 鏁翠綋鍐欏洖銆? * @param {object} db
 * @returns {Promise<object>}
 */
async function writeDB(db) {
  try {
    await driver.writeRaw(JSON.stringify(db));
  } catch (error) {
    throw new StorageError('WRITE_FAILED', error instanceof Error ? error.name : 'unknown');
  }
  return db;
}

/**
 * 璇?鈫?鍙樻崲 鈫?鍐?鐨勫叕鍏辨祦绋嬨€? * @param {(db: object) => void} mutate
 * @returns {Promise<object>}
 */
async function withDB(mutate) {
  const db = (await readDB()) ?? createEmptyDB();
  mutate(db);
  db.meta.updatedAt = nowIso();
  return writeDB(db);
}

/**
 * 鎸?id 瀹氫綅鏉＄洰涓嬫爣銆? * @param {any[]} list
 * @param {string} id
 * @returns {number}
 */
function indexOfId(list, id) {
  return list.findIndex((entry) => entry && entry.id === id);
}

/* --------------------------------------------------------------------------
 * 鍏紑鎺ュ彛
 * -------------------------------------------------------------------------- */

/**
 * 鍒濆鍖栵細璇诲彇骞惰鑼冨寲锛涙湰鍦版棤鏁版嵁鏃跺啓鍏ュ叏鏂板簱銆? * 鍐呭鎹熷潖鏃舵姏 StorageError('DB_CORRUPTED')锛岀敱鐣岄潰灞傝浆鎴愩€屾暟鎹崯鍧忋€嶉棬绂佽鍥俱€? * @returns {Promise<object>}
 */
export async function initDB() {
  const existing = await readDB();
  if (existing) return existing;
  return writeDB(createEmptyDB());
}

/**
 * 鏄惁宸插畬鎴愪富瀵嗙爜鍒濆鍖栵紙salt 闈炵┖涓?verifier 鏄悎娉曞瘑鏂囧璞★級銆? * 杩欐槸鍚姩鍒嗘祦鐨勫敮涓€渚濇嵁銆? * @returns {Promise<boolean>}
 */
export async function isInitialized() {
  const db = await readDB();
  if (!db) return false;
  return db.security.salt !== '' && isValidVerifier(db.security.verifier);
}

/**
 * 璇诲彇鏁翠釜闆嗗悎锛堣繑鍥炴繁鎷疯礉锛岃皟鐢ㄦ柟鏀逛笉鍔ㄥ簱鍐呮暟鎹級銆? * @param {string} collection
 * @returns {Promise<any[]>}
 */
export async function getCollection(collection) {
  assertCollection(collection);
  const db = (await readDB()) ?? createEmptyDB();
  return deepClone(db[collection]);
}

/**
 * 鎸?id 璇诲彇鍗曟潯銆? * @param {string} collection
 * @param {string} id
 * @returns {Promise<object | null>}
 */
export async function getById(collection, id) {
  assertCollection(collection);
  const db = (await readDB()) ?? createEmptyDB();
  const list = db[collection];
  const index = indexOfId(list, id);
  return index === -1 ? null : deepClone(list[index]);
}

/**
 * 鏂板鏉＄洰锛氳嚜鍔ㄨˉ id锛坈rypto.randomUUID锛夈€乧reatedAt銆乽pdatedAt銆? * @param {string} collection
 * @param {object} item
 * @returns {Promise<object>} 钀藉簱鍚庣殑瀹屾暣鏉＄洰
 */
export async function add(collection, item) {
  assertCollection(collection);
  if (!isPlainObject(item)) throw new StorageError('INVALID_ARGUMENT', 'item');

  const timestamp = nowIso();
  const record = { ...deepClone(item) };
  record.id = typeof record.id === 'string' && record.id ? record.id : globalThis.crypto.randomUUID();
  record.createdAt = timestamp;
  record.updatedAt = timestamp;
  if (!Array.isArray(record.tags)) record.tags = [];

  await withDB((db) => {
    db[collection].push(record);
  });

  return deepClone(record);
}

/**
 * 鏇存柊鏉＄洰锛氬彧鍚堝苟鐧藉悕鍗曞瓧娈碉紝鍒锋柊 updatedAt 涓?meta.updatedAt銆? * @param {string} collection
 * @param {string} id
 * @param {object} patch
 * @returns {Promise<object>} 鏇存柊鍚庣殑瀹屾暣鏉＄洰
 */
export async function update(collection, id, patch) {
  assertCollection(collection);
  if (!isPlainObject(patch)) throw new StorageError('INVALID_ARGUMENT', 'patch');

  const allowed = [...COMMON_MUTABLE_FIELDS, ...MUTABLE_FIELDS[collection]];
  /** @type {Record<string, any>} */
  const cleaned = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) cleaned[key] = deepClone(patch[key]);
  }

  const db = (await readDB()) ?? createEmptyDB();
  const list = db[collection];
  const index = indexOfId(list, id);
  if (index === -1) throw new StorageError('NOT_FOUND', 'update');

  const updated = { ...list[index], ...cleaned, updatedAt: nowIso() };
  list[index] = updated;
  db.meta.updatedAt = nowIso();
  await writeDB(db);

  return deepClone(updated);
}

/**
 * 鍒犻櫎鏉＄洰銆? * @param {string} collection
 * @param {string} id
 * @returns {Promise<boolean>} 鏄惁纭疄鍒犻櫎浜嗚褰? */
export async function remove(collection, id) {
  assertCollection(collection);

  const db = (await readDB()) ?? createEmptyDB();
  const list = db[collection];
  const index = indexOfId(list, id);
  if (index === -1) return false;

  list.splice(index, 1);
  db.meta.updatedAt = nowIso();
  await writeDB(db);
  return true;
}

/**
 * 璇诲彇 security锛坰alt 涓?verifier 閮戒笉鏄瀵嗭紝鍙槑鏂囧瓨鍌級銆? * @returns {Promise<object>}
 */
export async function getSecurity() {
  const db = (await readDB()) ?? createEmptyDB();
  return deepClone(db.security);
}

/**
 * 灞€閮ㄦ洿鏂?security锛堢櫧鍚嶅崟閿?+ 杩唬娆℃暟涓嬮檺鏍￠獙锛夈€? * @param {object} patch
 * @returns {Promise<object>} 鏇存柊鍚庣殑 security
 */
export async function patchSecurity(patch) {
  if (!isPlainObject(patch)) throw new StorageError('INVALID_ARGUMENT', 'security');
  if (
    Object.prototype.hasOwnProperty.call(patch, 'iterations') &&
    (!Number.isInteger(patch.iterations) || patch.iterations < DEFAULT_ITERATIONS)
  ) {
    throw new StorageError('INVALID_ARGUMENT', 'iterations');
  }

  /** @type {Record<string, any>} */
  const cleaned = {};
  for (const key of SECURITY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) cleaned[key] = deepClone(patch[key]);
  }

  let result = null;
  await withDB((db) => {
    db.security = { ...db.security, ...cleaned };
    result = deepClone(db.security);
  });
  return result;
}

/**
 * 璇诲彇 settings銆? * @returns {Promise<object>}
 */
export async function getSettings() {
  const db = (await readDB()) ?? createEmptyDB();
  return deepClone(db.settings);
}

/**
 * 灞€閮ㄦ洿鏂?settings銆? * @param {object} patch
 * @returns {Promise<object>} 鏇存柊鍚庣殑 settings
 */
export async function patchSettings(patch) {
  if (!isPlainObject(patch)) throw new StorageError('INVALID_ARGUMENT', 'settings');

  /** @type {Record<string, any>} */
  const cleaned = {};
  for (const key of SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) cleaned[key] = deepClone(patch[key]);
  }

  let result = null;
  await withDB((db) => {
    db.settings = { ...db.settings, ...cleaned };
    result = deepClone(db.settings);
  });
  return result;
}

/**
 * 鏁翠綋鏇挎崲锛堝鍏ュ浠界敤锛夈€? * 瀹夊叏鍏滃簳锛氳嫢浼犲叆鏁版嵁鐨?security 涓嶅畬鏁达紙salt 涓虹┖鎴?verifier 涓嶆槸鍚堟硶瀵嗘枃瀵硅薄锛夛紝
 * 鍒欎繚鐣欐湰鍦扮幇鏈?security锛岄伩鍏嶄竴娆″鍏ユ妸鏈満閿佸睆鍑嵁鎶规帀銆? * @param {object} incoming
 * @returns {Promise<object>} 钀藉簱鍚庣殑瀹屾暣搴? */
export async function replaceAll(incoming) {
  if (!isPlainObject(incoming)) throw new StorageError('INVALID_ARGUMENT', 'db');

  const normalized = normalizeDB(incoming);
  const localSecurity = (await readDB())?.security ?? createEmptyDB().security;
  const incomingHasSecurity =
    normalized.security.salt !== '' && isValidVerifier(normalized.security.verifier);

  normalized.security = incomingHasSecurity ? normalized.security : localSecurity;
  normalized.app = 'life-keeper';
  normalized.meta.updatedAt = nowIso();
  if (!normalized.meta.createdAt) normalized.meta.createdAt = nowIso();

  await writeDB(normalized);
  return deepClone(normalized);
}

/**
 * 鍦ㄣ€屾暣搴撳壇鏈€嶄笂鍋氫竴娆″彉鎹㈠悗鏁翠綋鍐欏洖銆? *
 * 鐢ㄩ€旓細闇€瑕佽法闆嗗悎鍘熷瓙淇敼鏃讹紙渚嬪淇敼涓诲瘑鐮佸悗瑕佷竴娆℃€ф浛鎹?credentials 閲岀殑鍏ㄩ儴瀵嗘枃锛夛紝
 * 鐢辨湰鏂囦欢缁熶竴鎸佹湁璇诲啓涓庡厠闅嗭紝鏃笉蹇呮妸搴曞眰搴撳璞℃毚闇茬粰涓氬姟灞傦紝涔熶繚璇侊細
 *   - mutate 鎶涢敊 鈫?涓€琛岄兘涓嶅啓锛堝師搴撲繚鎸佷笉鍙橈級锛? *   - mutate 鎴愬姛 鈫?涓€娆℃€у啓鍥烇紝閬垮厤鍐欎竴鍗婄暀涓嬫贩鍚堢姸鎬併€? *
 * @param {(db: object) => void} mutate 鐩存帴淇敼浼犲叆鐨勫簱鍓湰
 * @returns {Promise<object>} 钀藉簱鍚庣殑瀹屾暣搴? */
export async function mutateDB(mutate) {
  if (typeof mutate !== 'function') throw new StorageError('INVALID_ARGUMENT', 'mutate');

  const current = (await readDB()) ?? createEmptyDB();
  const draft = deepClone(current);
  mutate(draft);
  draft.meta.updatedAt = nowIso();
  await writeDB(draft);
  return deepClone(draft);
}

/**
 * 娓呯┖鎵€鏈夋暟鎹細绉婚櫎瀛樺偍閿苟鍐欏叆鍏ㄦ柊搴擄紙鍥炲埌銆屾湭鍒濆鍖栥€嶏級銆? * @returns {Promise<object>}
 */
export async function clearAll() {
  await driver.removeRaw();
  const fresh = createEmptyDB();
  await writeDB(fresh);
  return fresh;
}

/**
 * 璁㈤槄鍏跺畠鏍囩椤靛鏈敭鐨勫啓鍏ワ紙鐢ㄤ簬娓呯┖ / 鏀瑰瘑鍚庤鏈〉鍥炲埌鐩稿簲鐘舵€侊級銆? * @param {() => void} handler
 * @returns {() => void} 鍙栨秷璁㈤槄鍑芥暟
 */
export function onExternalChange(handler) {
  if (typeof handler !== 'function') throw new StorageError('INVALID_ARGUMENT', 'handler');
  if (typeof globalThis.addEventListener !== 'function') return () => {};

  const listener = (event) => {
    if (event instanceof StorageEvent && event.key === DB_KEY) handler();
  };
  globalThis.addEventListener('storage', listener);
  return () => globalThis.removeEventListener('storage', listener);
}
