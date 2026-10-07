/* ==========================================================================
 * js/modules/settings.js — M6 设置
 * --------------------------------------------------------------------------
 * 本阶段实现三块（其余设置项属后续版本）：
 *   1. 修改主密码：验证旧密码 → 新密码规则同初始化（≥8、二次确认、强度条、眼睛）
 *      → 生成新 salt/verifier → reencryptAll 重加密 credentials → Toast；
 *   2. 自动锁定时长：下拉 1/3/5/10/15/30 分钟，保存立即生效；
 *   3. 清空所有数据：Modal（DESIGN.md E.1）内验证主密码 + 二次确认。
 *
 * 分层约定：
 *   - 本模块不 import main.js，也不接触 storage.js / crypto.js；
 *     sessionKey、自动锁定计时、清空流程等能力由 main.js 通过 mountSettings 注入，
 *     因此 API 与 UI 之间没有循环依赖；
 *   - 所有动态文本一律 textContent（经 lib/dom.js 的 setText / createEl），
 *     本文件不出现 innerHTML；
 *   - 密码类输入框的值只在本模块与注入的 auth 接口之间传递，绝不打印、绝不持久化。
 * ========================================================================== */

import { evaluateStrength, messageOf, validatePasswordInput } from '../lib/auth.js';
import { byId, createEl, setStrengthBar, setText } from '../lib/dom.js';

/**
 * @typedef {object} SettingsApi
 * @property {number[]} autoLockOptions
 * @property {() => number} getAutoLockMinutes
 * @property {(minutes: number) => void} setAutoLockMinutes
 * @property {(oldPassword: string, newPassword: string, confirmation: string) => Promise<void>} changePassword
 * @property {() => void} requestClearAll
 * @property {(message: string, options?: {type?: 'success' | 'error' | 'neutral'}) => void} notify
 */

/** 强度条在设置页的 DOM id 前缀 */
const NEW_STRENGTH_ROOT_ID = 'settings-new-strength';
const NEW_STRENGTH_LABEL_ID = 'settings-new-strength-label';

/** @type {boolean} */
let mounted = false;

/**
 * 渲染自动锁定时长下拉选项。
 * @param {HTMLSelectElement} select
 * @param {number[]} options
 */
function renderAutoLockOptions(select, options) {
  select.replaceChildren();
  for (const minutes of options) {
    const option = /** @type {HTMLOptionElement} */ (createEl('option', { text: `${minutes} 分钟` }));
    option.value = String(minutes);
    select.append(option);
  }
}

/**
 * 装配设置页。
 * @param {SettingsApi} api
 */
export function mountSettings(api) {
  if (mounted) return;
  mounted = true;

  const oldInput = /** @type {HTMLInputElement | null} */ (byId('settings-old-password'));
  const newInput = /** @type {HTMLInputElement | null} */ (byId('settings-new-password'));
  const confirmInput = /** @type {HTMLInputElement | null} */ (byId('settings-new-password-confirm'));
  const errorNode = byId('settings-password-error');
  const submitButton = /** @type {HTMLButtonElement | null} */ (byId('settings-password-submit'));
  const strengthRoot = byId(NEW_STRENGTH_ROOT_ID);
  const strengthLabel = byId(NEW_STRENGTH_LABEL_ID);

  // 强度条初始状态：1 段「弱」
  setStrengthBar(strengthRoot, 1);
  setText(strengthLabel, evaluateStrength('').label);

  const renderStrength = () => {
    const { segments, label } = evaluateStrength(newInput?.value ?? '');
    setStrengthBar(strengthRoot, segments);
    setText(strengthLabel, label);
  };
  newInput?.addEventListener('input', () => {
    renderStrength();
    setText(errorNode, '');
  });
  oldInput?.addEventListener('input', () => setText(errorNode, ''));
  confirmInput?.addEventListener('input', () => setText(errorNode, ''));

  const submitChange = async () => {
    const oldPassword = oldInput?.value ?? '';
    const newPassword = newInput?.value ?? '';
    const confirmation = confirmInput?.value ?? '';

    if (oldPassword.length === 0) {
      setText(errorNode, '请输入当前主密码');
      return;
    }
    const validation = validatePasswordInput(newPassword, confirmation);
    if (!validation.ok) {
      setText(errorNode, messageOf(validation.code));
      return;
    }

    if (submitButton) submitButton.disabled = true;
    setText(errorNode, '');

    try {
      await api.changePassword(oldPassword, newPassword, confirmation);
      oldInput && (oldInput.value = '');
      newInput && (newInput.value = '');
      confirmInput && (confirmInput.value = '');
      renderStrength();
      api.notify('主密码已修改', { type: 'success' });
    } catch (error) {
      setText(errorNode, messageOf(error?.code ?? ''));
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  };

  // 提交入口只保留 form 的 submit 事件（按钮为 type="submit"，不注册 click，避免重复触发）
  byId('settings-password-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (submitButton?.disabled) return;
    void submitChange();
  });

  // 自动锁定时长
  const autoLockSelect = /** @type {HTMLSelectElement | null} */ (byId('settings-auto-lock'));
  if (autoLockSelect) {
    renderAutoLockOptions(autoLockSelect, api.autoLockOptions);
    autoLockSelect.value = String(api.getAutoLockMinutes());
    autoLockSelect.addEventListener('change', () => {
      const minutes = Number.parseInt(autoLockSelect.value, 10);
      if (!Number.isFinite(minutes)) return;
      api.setAutoLockMinutes(minutes);
      api.notify(`自动锁定已设为 ${minutes} 分钟`, { type: 'success' });
    });
  }

  // 清空所有数据（走 main.js 注入的流程：Modal 验密 + 二次确认）
  byId('settings-clear-button')?.addEventListener('click', () => api.requestClearAll());
}
