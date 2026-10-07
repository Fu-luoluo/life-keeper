/**
 * LifeKeeper — 应用入口（v0.2 安全地基）
 * ---------------------------------------------------------------------------
 * 职责：
 *   1. 启动分流：initDB → 设置主密码 / 解锁 / 数据损坏 三个门禁视图；
 *   2. 门禁：未通过验证前不渲染应用外壳、不进入任何业务路由；
 *   3. 会话密钥：**只允许存在于本文件的单一模块变量 sessionKey**；
 *   4. 锁定：顶栏挂锁手动锁定 + 无操作自动锁定（默认 5 分钟，设置可调）；
 *   5. 路由：基于 location.hash 的视图切换（仅 UNLOCKED 状态下生效）；
 *   6. 顶栏：用本机日期动态渲染「2026年10月7日 星期三」。
 *
 * 安全不变式：
 *   - sessionKey 不挂 window、不进 storage、不进 URL；
 *   - 进入 LOCKED 必须清密钥、清定时器、清所有密码输入框；
 *   - 刷新 / 关闭即丢失密钥，天然回到锁定态。
 */

import {
  changeMasterPassword,
  clearAllData,
  createAttemptLimiter,
  evaluateStrength,
  messageOf,
  setupMasterPassword,
  unlock,
  validatePasswordInput,
  verifyMasterPassword
} from './lib/auth.js';
import { isCryptoAvailable } from './lib/crypto.js';
import {
  bindPasswordToggle,
  byId,
  clearInputs,
  cooldownText,
  openClearDataModal,
  setHidden,
  setStrengthBar,
  setText,
  showToast
} from './lib/dom.js';
import {
  StorageError,
  add,
  getCollection,
  getSecurity,
  getSettings,
  initDB,
  isInitialized,
  onExternalChange,
  patchSecurity,
  remove,
  update
} from './lib/storage.js';import { formatLocalDateText, throttle } from './lib/utils.js';

import * as dashboardModule from './modules/dashboard.js';
import * as accountModule from './modules/account.js';
import * as diaryModule from './modules/diary.js';
import * as itemsModule from './modules/items.js';
import * as vaultModule from './modules/vault.js';
import * as settingsModule from './modules/settings.js';
/* --------------------------------------------------------------------------
 * 全局状态
 * -------------------------------------------------------------------------- */

/** 锁定状态机的四个状态 */
const LOCK_STATE = {
  INIT: 'INIT', // 未初始化：本机还没有主密码
  LOCKED: 'LOCKED', // 已锁定：有主密码，但当前没有会话密钥
  UNLOCKED: 'UNLOCKED', // 已解锁
  CORRUPTED: 'CORRUPTED' // 存储内容损坏，只能清空重来
};

/**
 * 会话密钥：全项目仅此一处持有 CryptoKey。
 * 不导出、不挂 window、不写入任何存储。
 * @type {CryptoKey | null}
 */
let sessionKey = null;

/** 全局状态（仅内存） */
const state = {
  lock: LOCK_STATE.INIT,
  currentPage: null,
  autoLock: { lastActivityAt: Date.now(), minutes: 5, timerId: 0 },
  auth: { cancelCooldownUi: null }
};

/** 失败计数与冷却（仅内存，刷新即重置） */
const limiter = createAttemptLimiter();

/** 可用页面：id 与 index.html 中 [data-page] / #view-<id> 一一对应 */
const PAGES = {
  dashboard: { module: dashboardModule, label: '仪表盘' },
  account: { module: accountModule, label: '日常收支' },
  diary: { module: diaryModule, label: '生活记录' },
  items: { module: itemsModule, label: '物品台账' },
  vault: { module: vaultModule, label: '密码保管' },
  settings: { module: settingsModule, label: '设置' }
};

const DEFAULT_PAGE = 'dashboard';

/** 自动锁定时长可选值（分钟，PRD F0-5 与 M6 F6-2） */
const AUTO_LOCK_OPTIONS = [1, 3, 5, 10, 15, 30];

/** 锁定时需要清空的全部密码类输入框 id */
const PASSWORD_INPUT_IDS = [
  'setup-password',
  'setup-password-confirm',
  'unlock-password',
  'settings-old-password',
  'settings-new-password',
  'settings-new-password-confirm'
];

/* --------------------------------------------------------------------------
 * 密码输入框显隐控制器的持有者
 * -------------------------------------------------------------------------- */

/** @type {ReturnType<typeof bindPasswordToggle> | null} */
let setupPasswordToggle = null;
/** @type {ReturnType<typeof bindPasswordToggle> | null} */
let setupConfirmToggle = null;
/** @type {ReturnType<typeof bindPasswordToggle> | null} */
let unlockPasswordToggle = null;
/** @type {ReturnType<typeof bindPasswordToggle> | null} */
let settingsOldToggle = null;
/** @type {ReturnType<typeof bindPasswordToggle> | null} */
let settingsNewToggle = null;
/** @type {ReturnType<typeof bindPasswordToggle> | null} */
let settingsConfirmToggle = null;

/* --------------------------------------------------------------------------
 * 门禁视图控制
 * -------------------------------------------------------------------------- */

/**
 * 切换门禁视图（设置主密码 / 解锁 / 数据损坏 / 不安全上下文）并同步应用外壳可见性。
 * @param {'INIT' | 'LOCKED' | 'CORRUPTED' | 'INSECURE' | 'UNLOCKED'} view
 */
function showGate(view) {
  const unlocked = view === 'UNLOCKED';

  setHidden(byId('app-shell'), !unlocked);
  setHidden(byId('gate-views'), unlocked);
  setHidden(byId('setup-view'), view !== 'INIT');
  setHidden(byId('unlock-view'), view !== 'LOCKED');
  setHidden(byId('corrupted-view'), view !== 'CORRUPTED');
  setHidden(byId('insecure-view'), view !== 'INSECURE');

  document.documentElement.dataset.lockState = view;
}

/** 清空所有密码输入框与错误提示（进入锁定态时调用） */
function resetAuthForms() {
  clearInputs(PASSWORD_INPUT_IDS.map((id) => /** @type {HTMLInputElement | null} */ (byId(id))));

  for (const id of [
    'setup-error',
    'setup-strength-label',
    'unlock-error',
    'unlock-cooldown',
    'settings-password-error'
  ]) {
    setText(byId(id), '');
  }

  setStrengthBar(byId('setup-strength'), 1);
  setStrengthBar(byId('settings-new-strength'), 1);

  setupPasswordToggle?.reset();
  setupConfirmToggle?.reset();
  unlockPasswordToggle?.reset();
  settingsOldToggle?.reset();
  settingsNewToggle?.reset();
  settingsConfirmToggle?.reset();
}

/**
 * 重置业务模块的内存状态（锁定 / 清空数据 / 换标签页后调用），
 * 避免上一个解锁会话的筛选条件、月份、进行中的编辑残留到下一次。
 */
function resetDataModules() {
  const reset = /** @type {any} */ (accountModule).resetAccount;
  if (typeof reset === 'function') reset();
}

/* --------------------------------------------------------------------------
 * 会话密钥管理（唯一入口）
 * -------------------------------------------------------------------------- */

/**
 * 写入会话密钥。
 * @param {CryptoKey} key
 */
function setSessionKey(key) {
  sessionKey = key;
}

/** 清除会话密钥（锁定 / 清空数据时立即调用） */
function clearSessionKey() {
  sessionKey = null;
}

/** @returns {CryptoKey | null} */
function getSessionKey() {
  return sessionKey;
}

/* --------------------------------------------------------------------------
 * 自动锁定
 * -------------------------------------------------------------------------- */

/** 当前自动锁定时长（分钟） */
function getAutoLockMinutes() {
  return state.autoLock.minutes;
}

/** 设置自动锁定时长（分钟）并立即生效（重设计时窗口，避免改短后仍按旧时长等待） */
function setAutoLockMinutes(minutes) {
  const safe = AUTO_LOCK_OPTIONS.includes(minutes) ? minutes : 5;
  state.autoLock.minutes = safe;
  state.autoLock.lastActivityAt = Date.now();

  if (state.lock === LOCK_STATE.UNLOCKED) startAutoLockTimer();
}

/**
 * 写入自动锁定时长（分钟）并让计时立即生效。
 * 注意：只改内存会让刷新后回退，因此这里必须落盘到 security.autoLockMinutes。
 * @param {number} minutes
 * @returns {Promise<number>} 实际生效的分钟数
 */
async function applyAutoLockMinutes(minutes) {
  const safe = AUTO_LOCK_OPTIONS.includes(minutes) ? minutes : 5;
  setAutoLockMinutes(safe);
  await patchSecurity({ autoLockMinutes: safe });
  return safe;
}

/**
 * 记录一次用户活动。
 * 注意：节流包在「无条件写入」外层，不能在节流回调里再判锁定状态——
 * 否则刚解锁后的第一次 pointermove 可能被节流吞掉，导致活动时间停留在解锁前。
 */
const recordActivity = throttle(() => {
  state.autoLock.lastActivityAt = Date.now();
}, 1000);

/** 每秒检查一次是否达到自动锁定时长 */
function startAutoLockTimer() {
  stopAutoLockTimer();
  state.autoLock.lastActivityAt = Date.now();
  state.autoLock.timerId = window.setInterval(() => {
    if (state.lock !== LOCK_STATE.UNLOCKED) return;
    const idleMs = Date.now() - state.autoLock.lastActivityAt;
    if (idleMs >= state.autoLock.minutes * 60_000) lockNow('auto');
  }, 1000);
}

/** 停止自动锁定计时 */
function stopAutoLockTimer() {
  if (state.autoLock.timerId) {
    window.clearInterval(state.autoLock.timerId);
    state.autoLock.timerId = 0;
  }
}

/* --------------------------------------------------------------------------
 * 锁定 / 解锁切换
 * -------------------------------------------------------------------------- */

/**
 * 锁定：清密钥、清定时器、清表单，回到解锁视图。
 * @param {'manual' | 'auto'} [reason]
 */
function lockNow(reason = 'manual') {
  if (state.lock !== LOCK_STATE.UNLOCKED) return;

  stopAutoLockTimer();
  clearSessionKey();
  resetAuthForms();
  resetDataModules();

  state.lock = LOCK_STATE.LOCKED;
  showGate('LOCKED');
  limiter.reset();
  startCooldownUi();

  document.title = 'LifeKeeper — 解锁';
  byId('unlock-password')?.focus();

  if (reason === 'auto') showToast('因长时间无操作已自动锁定', { type: 'neutral' });
}

/**
 * 进入应用外壳（解锁成功 / 设置主密码成功 / 修改主密码成功）。
 */
function enterApp() {
  state.lock = LOCK_STATE.UNLOCKED;
  showGate('UNLOCKED');
  startAutoLockTimer();
  navigateTo(resolvePageFromHash(), { replaceHash: true });
}

/**
 * 清空数据后回到「未初始化」门禁（忘记主密码的恢复终点）。
 */
async function resetToUninitialized() {
  stopAutoLockTimer();
  clearSessionKey();
  limiter.reset();
  resetAuthForms();
  resetDataModules();
  state.lock = LOCK_STATE.INIT;
  showGate('INIT');
  document.title = 'LifeKeeper — 设置主密码';
  byId('setup-password')?.focus();
}

/* --------------------------------------------------------------------------
 * 路由
 * -------------------------------------------------------------------------- */

/**
 * 解析当前 hash，返回合法页面 id。
 * @returns {string}
 */
function resolvePageFromHash() {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return Object.prototype.hasOwnProperty.call(PAGES, raw) ? raw : DEFAULT_PAGE;
}

/**
 * 切换到指定页面。**未解锁时直接返回**，这是门禁的核心闸门。
 * @param {string} pageId
 * @param {{ replaceHash?: boolean, moveFocus?: boolean }} [options]
 */
function navigateTo(pageId, options = {}) {
  if (state.lock !== LOCK_STATE.UNLOCKED) return;
  const { replaceHash = false, moveFocus = false } = options;
  if (!Object.prototype.hasOwnProperty.call(PAGES, pageId)) return;

  for (const section of document.querySelectorAll('.lk-view')) {
    if (section instanceof HTMLElement) section.hidden = section.dataset.page !== pageId;
  }

  for (const link of document.querySelectorAll('.lk-nav-item[data-page]')) {
    const isActive = link instanceof HTMLElement && link.dataset.page === pageId;
    link.classList.toggle('is-active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  state.currentPage = pageId;
  document.title = `LifeKeeper — ${PAGES[pageId].label}`;

  const hash = `#/${pageId}`;
  if (window.location.hash !== hash) {
    if (replaceHash) window.history.replaceState(null, '', hash);
    else window.location.hash = hash;
  }

  if (moveFocus) byId('app-main')?.focus({ preventScroll: true });

  document.documentElement.dataset.page = pageId;

  // 每次真正落到某个页面时让该模块按最新数据刷新一次
  // （业务写操作发生在别处时，回到页面能看到最新结果）
  PAGE_ENTER[pageId]?.();
}

/**
 * 页面进入钩子：模块首次渲染在 mount 时完成，这里负责「再次进入时刷新」。
 * @type {Record<string, () => void>}
 */
const PAGE_ENTER = {
  account: () => {
    const refresh = /** @type {any} */ (accountModule).renderAccount;
    if (typeof refresh === 'function') void refresh();
  }
};

/* --------------------------------------------------------------------------
 * 门禁表单：设置主密码
 * -------------------------------------------------------------------------- */

/** 绑定设置主密码表单 */
function bindSetupForm() {
  const input = /** @type {HTMLInputElement | null} */ (byId('setup-password'));
  const confirmInput = /** @type {HTMLInputElement | null} */ (byId('setup-password-confirm'));
  const strengthRoot = byId('setup-strength');
  const strengthLabel = byId('setup-strength-label');
  const errorNode = byId('setup-error');
  const submitButton = /** @type {HTMLButtonElement | null} */ (byId('setup-submit'));

  setupPasswordToggle = bindPasswordToggle({ input, button: byId('setup-password-eye') });
  setupConfirmToggle = bindPasswordToggle({ input: confirmInput, button: byId('setup-password-confirm-eye') });

  const renderStrength = () => {
    const { segments, label } = evaluateStrength(input?.value ?? '');
    setStrengthBar(strengthRoot, segments);
    setText(strengthLabel, label);
  };
  input?.addEventListener('input', () => {
    renderStrength();
    setText(errorNode, '');
  });
  confirmInput?.addEventListener('input', () => setText(errorNode, ''));
  renderStrength();

  // 提交入口只保留 form 的 submit 事件。
  // 按钮是 type="submit"：若再额外挂一个 click 监听，一次点击会触发两遍
  // （并发派生密钥 / 并发校验），因此本文件不再为这两个按钮注册 click。
  const submitSetup = async () => {
    const password = input?.value ?? '';
    const confirmation = confirmInput?.value ?? '';

    const validation = validatePasswordInput(password, confirmation);
    if (!validation.ok) {
      setText(errorNode, messageOf(validation.code));
      return;
    }

    if (submitButton) submitButton.disabled = true;
    try {
      const { key } = await setupMasterPassword(password);
      setSessionKey(key);
      resetAuthForms();
      enterApp();
      showToast('主密码已设置', { type: 'success' });
    } catch (error) {
      setText(errorNode, messageOf(error?.code ?? ''));
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  };

  byId('setup-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (submitButton?.disabled) return; // 防止按键重复触发导致并发提交
    void submitSetup();
  });
}

/* --------------------------------------------------------------------------
 * 门禁表单：解锁（含 5 次失败 → 30 秒冷却）
 * -------------------------------------------------------------------------- */

/**
 * 根据冷却剩余时间刷新解锁表单的可用状态与倒计时文本。
 */
function refreshUnlockAvailability() {
  const input = /** @type {HTMLInputElement | null} */ (byId('unlock-password'));
  const submitButton = /** @type {HTMLButtonElement | null} */ (byId('unlock-submit'));
  const cooldownNode = byId('unlock-cooldown');
  const remaining = limiter.getCooldownRemainingMs();

  if (remaining > 0) {
    setText(cooldownNode, `尝试次数过多，请稍后重试（${cooldownText(remaining)}）`);
    if (input) input.disabled = true;
    if (submitButton) submitButton.disabled = true;
    return;
  }

  setText(cooldownNode, '');
  if (input) input.disabled = false;
  if (submitButton) submitButton.disabled = false;
}

/** 冷却倒计时每秒刷新；冷却结束后自动恢复表单 */
function startCooldownUi() {
  state.auth.cancelCooldownUi?.();
  refreshUnlockAvailability();

  if (!limiter.isCoolingDown()) return;

  const timerId = window.setInterval(() => {
    if (!limiter.isCoolingDown()) {
      window.clearInterval(timerId);
      state.auth.cancelCooldownUi = null;
      refreshUnlockAvailability();
      byId('unlock-password')?.focus();
      return;
    }
    refreshUnlockAvailability();
  }, 1000);

  state.auth.cancelCooldownUi = () => window.clearInterval(timerId);
}

/** 绑定解锁表单 */
function bindUnlockForm() {
  const input = /** @type {HTMLInputElement | null} */ (byId('unlock-password'));
  const errorNode = byId('unlock-error');
  const submitButton = /** @type {HTMLButtonElement | null} */ (byId('unlock-submit'));

  unlockPasswordToggle = bindPasswordToggle({ input, button: byId('unlock-password-eye') });
  input?.addEventListener('input', () => setText(errorNode, ''));

  const submit = async () => {
    if (limiter.isCoolingDown()) {
      refreshUnlockAvailability();
      return;
    }

    const password = input?.value ?? '';
    if (password.length === 0) {
      setText(errorNode, messageOf('PASSWORD_REQUIRED'));
      return;
    }

    if (submitButton) submitButton.disabled = true;
    setText(errorNode, '');

    try {
      const result = await unlock(password);
      if (result.ok) {
        limiter.reset();
        setSessionKey(result.key);
        resetAuthForms();
        enterApp();
        return;
      }

      setText(errorNode, messageOf(result.code));
      if (input) input.value = '';

      if (result.code === 'WRONG_PASSWORD') {
        const { cooldownMs } = limiter.registerFailure();
        if (cooldownMs > 0) startCooldownUi();
      }
    } catch {
      setText(errorNode, messageOf(''));
    } finally {
      if (!limiter.isCoolingDown() && submitButton) submitButton.disabled = false;
      refreshUnlockAvailability();
    }
  };

  // 提交入口只保留 form 的 submit 事件（按钮为 type="submit"，不注册 click，避免重复触发）
  byId('unlock-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (submitButton?.disabled) return;
    void submit();
  });
}

/* --------------------------------------------------------------------------
 * 清空数据（两条路径）
 * -------------------------------------------------------------------------- */

/**
 * 清空数据的共同收尾：清密钥 → 回到未初始化门禁。
 */
async function performClearAll() {
  await clearAllData();
  await resetToUninitialized();
}

/**
 * 路径 1：设置页（已解锁）→ Modal 内验证主密码 + 二次确认。
 */
function requestClearAllFromSettings() {
  openClearDataModal({
    requirePassword: true,
    subtitle: '此操作不可撤销',
    warning:
      '将删除本机保存的全部数据（收支、生活记录、物品台账、密码保管），并清除主密码。删除后无法恢复，也无法找回。',
    verifyPassword: (password) => verifyMasterPassword(password, { key: getSessionKey() ?? undefined }),
    onConfirm: async () => {
      await performClearAll();
      showToast('数据已清空', { type: 'success' });
    }
  });
}

/**
 * 路径 2：解锁页 / 数据损坏门禁 → 忘记主密码的恢复路径。
 * 明确禁止要求验证主密码，只要求输入确认文字。
 */
function requestClearAllFromGate() {
  openClearDataModal({
    requirePassword: false,
    subtitle: '忘记主密码的恢复方式',
    warning:
      '主密码无法找回，唯一办法是清空全部数据后重新开始。此操作会删除本机所有数据，且无法撤销。',
    onConfirm: async () => {
      await performClearAll();
      showToast('数据已清空，请重新设置主密码', { type: 'success' });
    }
  });
}

/* --------------------------------------------------------------------------
 * 顶栏与导航
 * -------------------------------------------------------------------------- */

/** 绑定左侧导航点击 */
function bindNavigation() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('.lk-nav-item[data-page]');
    if (!link || !(link instanceof HTMLElement)) return;
    event.preventDefault();
    if (state.lock !== LOCK_STATE.UNLOCKED) return;
    navigateTo(link.dataset.page ?? DEFAULT_PAGE, { moveFocus: true });
  });
}

/** 顶栏挂锁按钮：立即锁定 */
function bindTopbarActions() {
  byId('lock-button')?.addEventListener('click', () => lockNow('manual'));
}

/* --------------------------------------------------------------------------
 * 设置页装配
 * -------------------------------------------------------------------------- */

/** 装配设置页（把 main 的能力以参数注入，避免 settings.js 反向 import main.js） */
function mountSettingsModule() {
  const mount = /** @type {any} */ (settingsModule).mountSettings;
  if (typeof mount !== 'function') return;

  settingsOldToggle = bindPasswordToggle({
    input: /** @type {HTMLInputElement | null} */ (byId('settings-old-password')),
    button: byId('settings-old-password-eye')
  });
  settingsNewToggle = bindPasswordToggle({
    input: /** @type {HTMLInputElement | null} */ (byId('settings-new-password')),
    button: byId('settings-new-password-eye')
  });
  settingsConfirmToggle = bindPasswordToggle({
    input: /** @type {HTMLInputElement | null} */ (byId('settings-new-password-confirm')),
    button: byId('settings-new-password-confirm-eye')
  });

  mount({
    autoLockOptions: AUTO_LOCK_OPTIONS,
    getAutoLockMinutes,
    setAutoLockMinutes: applyAutoLockMinutes,
    changePassword: async (oldPassword, newPassword, confirmation) => {
      const { key } = await changeMasterPassword(oldPassword, newPassword, confirmation);
      setSessionKey(key); // 保持解锁状态，但换用新密钥
    },
    requestClearAll: requestClearAllFromSettings,
    notify: showToast
  });
}

/* --------------------------------------------------------------------------
 * 日常收支模块装配
 * -------------------------------------------------------------------------- */

/**
 * 装配日常收支模块。
 * 沿用 settings 的注入模式：account.js 不 import storage.js / main.js，
 * 所有数据与提示能力都在这里注入，因此模块与外壳之间没有循环依赖。
 */
function mountAccountModule() {
  const mount = /** @type {any} */ (accountModule).mountAccount;
  if (typeof mount !== 'function') return;

  mount({
    getTransactions: () => getCollection('transactions'),
    addTransaction: (data) => add('transactions', data),
    updateTransaction: (id, patch) => update('transactions', id, patch),
    removeTransaction: (id) => remove('transactions', id),
    notify: showToast
  });
}

/* --------------------------------------------------------------------------
 * 启动
 * -------------------------------------------------------------------------- */

/** 渲染顶栏日期文字 */
function renderCurrentDate() {
  setText(byId('current-date'), formatLocalDateText());
}

/**
 * 启动分流。
 */
async function bootstrap() {
  // 立即解除首屏隐藏：门禁视图本身用 hidden 属性控制，
  // 不依赖 Tailwind 编译完成，避免等待存储读取时出现白屏。
  document.documentElement.classList.add('lk-ready');

  bindNavigation();
  bindTopbarActions();
  renderCurrentDate();
  bindSetupForm();
  bindUnlockForm();
  mountSettingsModule();
  mountAccountModule();

  // 清空数据入口：仅出现在「已锁定」与「数据损坏」两个门禁视图
  // （未初始化视图不显示该按钮；设置页入口由 settings 模块自己绑定）
  byId('unlock-clear-button')?.addEventListener('click', requestClearAllFromGate);
  byId('corrupted-clear-button')?.addEventListener('click', requestClearAllFromGate);

  window.addEventListener('hashchange', () => {
    if (state.lock !== LOCK_STATE.UNLOCKED) return;
    navigateTo(resolvePageFromHash());
  });

  window.addEventListener('pointermove', recordActivity, { passive: true });
  window.addEventListener('keydown', recordActivity);
  window.addEventListener('pointerdown', recordActivity, { passive: true });

  // 关页面 / 切走时立即清理内存中的密钥与定时器（AGENTS.md 4.3）
  window.addEventListener('pagehide', () => {
    clearSessionKey();
    stopAutoLockTimer();
    state.auth.cancelCooldownUi?.();
  });

  // 其它标签页清空 / 改密后，本页立即回到锁定态，避免用旧密钥继续操作
  onExternalChange(() => {
    clearSessionKey();
    stopAutoLockTimer();
    state.lock = LOCK_STATE.LOCKED;
    showGate('LOCKED');
    document.title = 'LifeKeeper — 解锁';
  });

  // 安全上下文检查：file:// 下 Web Crypto 不可用，必须先给出明确阻断提示
  if (!isCryptoAvailable()) {
    state.lock = LOCK_STATE.CORRUPTED;
    showGate('INSECURE');
    document.title = 'LifeKeeper — 需要安全上下文';
    return;
  }

  try {
    // initDB 会顺带补全缺失字段；它抛错即代表内容损坏，由下面的 catch 转成损坏门禁
    await initDB();
    const initialized = await isInitialized();
    const security = await getSecurity();
    const settings = await getSettings();
    // 本阶段只实现浅色模式：仅把 theme 记到 data-theme 供后续深色模式使用，不做任何色值推导
    document.documentElement.dataset.theme = settings.theme === 'dark' ? 'dark' : 'light';
    // setAutoLockMinutes 只在 UNLOCKED 时重设计时器；此处状态仍为 INIT，只写入时长
    setAutoLockMinutes(security.autoLockMinutes ?? 5);

    if (initialized) {
      state.lock = LOCK_STATE.LOCKED;
      showGate('LOCKED');
      document.title = 'LifeKeeper — 解锁';
      refreshUnlockAvailability();
      byId('unlock-password')?.focus();
    } else {
      state.lock = LOCK_STATE.INIT;
      showGate('INIT');
      document.title = 'LifeKeeper — 设置主密码';
    }
  } catch (error) {
    // 数据损坏：不抛错、不留白屏，给出可恢复的门禁视图（清空重来不需要验证主密码）
    state.lock = LOCK_STATE.CORRUPTED;
    showGate('CORRUPTED');
    document.title =
      error instanceof StorageError && error.code === 'DB_CORRUPTED'
        ? 'LifeKeeper — 数据损坏'
        : 'LifeKeeper — 数据读取失败';
  }
}

/** 启动失败兜底：任何未捕获异常都转成可恢复的门禁视图，绝不留白屏 */
function bootstrapSafely() {
  bootstrap().catch(() => {
    document.documentElement.classList.add('lk-ready');
    state.lock = LOCK_STATE.CORRUPTED;
    showGate('CORRUPTED');
    document.title = 'LifeKeeper — 启动失败';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapSafely, { once: true });
} else {
  bootstrapSafely();
}
