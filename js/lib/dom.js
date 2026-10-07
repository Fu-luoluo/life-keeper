/* ==========================================================================
 * js/lib/dom.js — DOM 基础件（Toast / Modal / 表单反馈）
 * --------------------------------------------------------------------------
 * 安全约定（AGENTS.md 4.4）：
 *   本文件内不出现 innerHTML / outerHTML / insertAdjacentHTML / document.write；
 *   所有动态文本一律走 textContent 或 createTextNode，杜绝 XSS。
 *
 * 视觉依据：DESIGN.md E.1（Modal）、E.2（Toast）、H.1（按钮状态）、H.3（动效 150–200ms）。
 * ========================================================================== */

import { formatRemainingSeconds } from './utils.js';

/** Toast 自动消失时长（DESIGN.md E.2：2.5 秒） */
export const TOAST_DURATION_MS = 2500;

/** 清空数据需要输入的确认文字（PRD F0-4 恢复路径） */
export const CLEAR_CONFIRM_PHRASE = '确认清空';

/* --------------------------------------------------------------------------
 * 基础工具
 * -------------------------------------------------------------------------- */

/**
 * 用 textContent 写入文本（本文件唯一的文本写入方式）。
 * @param {Element | null} element
 * @param {unknown} text
 */
export function setText(element, text) {
  if (element) element.textContent = text === null || text === undefined ? '' : String(text);
}

/**
 * 创建元素。
 * @param {string} tag
 * @param {{className?: string, text?: string, type?: string, id?: string}} [options]
 * @returns {HTMLElement}
 */
export function createEl(tag, options = {}) {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.id) element.id = options.id;
  if (options.type) element.setAttribute('type', options.type);
  if (options.text !== undefined) element.textContent = String(options.text);
  return element;
}

/**
 * 显示 / 隐藏元素（用原生 hidden 属性）。
 * @param {Element | null} element
 * @param {boolean} hidden
 */
export function setHidden(element, hidden) {
  if (!element) return;
  if (hidden) element.setAttribute('hidden', '');
  else element.removeAttribute('hidden');
}

/**
 * @param {string} id
 * @returns {HTMLElement | null}
 */
export function byId(id) {
  return document.getElementById(id);
}

/**
 * 清空密码类输入框的值（锁定 / 切换门禁视图时必须调用）。
 * @param {Iterable<HTMLInputElement | null>} inputs
 */
export function clearInputs(inputs) {
  for (const input of inputs) {
    if (input) input.value = '';
  }
}

/* --------------------------------------------------------------------------
 * Toast（DESIGN.md E.2）
 * -------------------------------------------------------------------------- */

let toastTimerId = 0;

/**
 * 显示轻提示：2.5 秒后自动消失。
 * @param {string} message
 * @param {{type?: 'success' | 'error' | 'neutral', durationMs?: number}} [options]
 */
export function showToast(message, options = {}) {
  const type = options.type ?? 'success';
  const durationMs = options.durationMs ?? TOAST_DURATION_MS;

  const container = byId('toast-container');
  if (!container) return;

  container.replaceChildren();

  const toast = createEl('div', { className: 'lk-toast' });
  if (type !== 'neutral') toast.append(createEl('span', { className: `lk-toast-dot is-${type}` }));
  toast.append(createEl('span', { text: message }));
  container.append(toast);

  setHidden(container, false);

  window.clearTimeout(toastTimerId);
  toastTimerId = window.setTimeout(() => {
    setHidden(container, true);
    container.replaceChildren();
  }, durationMs);
}

/* --------------------------------------------------------------------------
 * Modal / 确认对话框（DESIGN.md E.1）
 * -------------------------------------------------------------------------- */

/**
 * @typedef {object} ModalAction
 * @property {string} label
 * @property {'primary' | 'secondary' | 'ghost' | 'danger'} [variant]
 * @property {boolean} [autofocus]
 * @property {() => void} onClick
 */

/**
 * 打开 Modal。
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   widthPx?: number,
 *   bodyChildren?: Node[],
 *   actions: ModalAction[],
 *   onClose?: () => void
 * }} config widthPx：面板宽度（DESIGN.md E.1 表单类默认 480px；宽表单可传 720px）
 * @returns {{panel: HTMLElement, close: () => void, setError: (message: string) => void}}
 */
export function openModal(config) {
  const overlay = byId('modal-root');
  if (!overlay) throw new Error('modal-root missing');

  const titleNode = byId('modal-title');
  const subtitleNode = byId('modal-subtitle');
  const bodyNode = byId('modal-body');
  const footerNode = byId('modal-footer');
  if (!titleNode || !bodyNode || !footerNode) throw new Error('modal skeleton missing');

  // 面板宽度：只通过 CSS 变量的最大宽度表达，宽度仍受视口限制（窄窗口自动收窄）
  const panel = /** @type {HTMLElement | null} */ (overlay.querySelector('.lk-modal'));
  if (panel) {
    if (Number.isFinite(config.widthPx) && config.widthPx > 0) {
      panel.style.setProperty('--lk-modal-width', `${Math.trunc(config.widthPx)}px`);
    } else {
      panel.style.removeProperty('--lk-modal-width');
    }
  }

  setText(titleNode, config.title);
  setText(subtitleNode, config.subtitle ?? '');
  setHidden(subtitleNode, !config.subtitle);

  const errorNode = createEl('p', { className: 'lk-modal-error', id: 'modal-error' });
  setHidden(errorNode, true);

  bodyNode.replaceChildren(errorNode, ...(config.bodyChildren ?? []));
  footerNode.replaceChildren();

  /** @type {HTMLButtonElement[]} */
  const buttons = [];
  for (const action of config.actions) {
    // 显式 type="button"：Modal 由 JS 直接创建按钮，
    // 万一将来 Modal 被放进 <form>，也不会意外触发原生表单提交
    const button = /** @type {HTMLButtonElement} */ (
      createEl('button', {
        className: `lk-btn lk-btn-${action.variant ?? 'secondary'}`,
        text: action.label,
        type: 'button'
      })
    );
    button.addEventListener('click', action.onClick);
    footerNode.append(button);
    buttons.push(button);
  }

  const applyFocusTrap = (event) => {
    if (event.key !== 'Tab' || buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  /** @param {KeyboardEvent} event */
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    applyFocusTrap(event);
  };

  function close() {
    overlay.removeEventListener('mousedown', onOverlayMouseDown);
    document.removeEventListener('keydown', onKeyDown);
    setHidden(overlay, true);
    bodyNode.replaceChildren();
    footerNode.replaceChildren();
    config.onClose?.();
  }

  /** @param {MouseEvent} event */
  const onOverlayMouseDown = (event) => {
    if (event.target === overlay) close();
  };

  const closeButton = byId('modal-close');
  if (closeButton) closeButton.onclick = () => close();

  overlay.addEventListener('mousedown', onOverlayMouseDown);
  document.addEventListener('keydown', onKeyDown);
  setHidden(overlay, false);

  const autofocusTarget = buttons.find(
    (_button, index) => config.actions[index]?.autofocus === true
  );
  window.setTimeout(() => {
    const field = bodyNode.querySelector('input, select, textarea');
    if (field instanceof HTMLElement) field.focus();
    else (autofocusTarget ?? buttons[buttons.length - 1])?.focus();
  }, 0);

  return {
    panel: overlay,
    close,
    buttons,
    /** @param {string} message */
    setError(message) {
      setText(errorNode, message);
      setHidden(errorNode, message.length === 0);
    }
  };
}

/**
 * 通用确认对话框。
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   variant?: 'primary' | 'danger',
 *   onConfirm: () => void | Promise<void>
 * }} config
 */
export function openConfirmDialog(config) {
  let dialog = null;
  dialog = openModal({
    title: config.title,
    subtitle: config.subtitle,
    bodyChildren: [createEl('p', { className: 'lk-modal-text', text: config.message })],
    actions: [
      {
        label: config.cancelLabel ?? '取消',
        variant: 'secondary',
        onClick: () => dialog?.close()
      },
      {
        label: config.confirmLabel ?? '确认',
        variant: config.variant ?? 'primary',
        autofocus: true,
        onClick: () => {
          dialog?.close();
          void config.onConfirm();
        }
      }
    ]
  });
}

/* --------------------------------------------------------------------------
 * 「清空所有数据」对话框（两条路径共用）
 *   路径 1：设置页（已解锁）→ requirePassword: true，Modal 内验证主密码
 *   路径 2：解锁页 / 数据损坏门禁 → requirePassword: false，
 *           这是忘记主密码的恢复路径，禁止要求验证主密码，只要求输入确认文字
 * -------------------------------------------------------------------------- */

/**
 * 构建并打开「清空所有数据」对话框。
 * @param {{
 *   requirePassword: boolean,
 *   subtitle?: string,
 *   warning: string,
 *   verifyPassword?: (password: string) => Promise<boolean>,
 *   onConfirm: () => void | Promise<void>
 * }} config
 */
export function openClearDataModal(config) {
  /** @type {HTMLInputElement | null} */
  let passwordInput = null;
  let confirmInput = null;
  /** @type {HTMLButtonElement | null} */
  let confirmButton = null;
  /** @type {ReturnType<typeof openModal> | null} */
  let dialog = null;

  const bodyChildren = [createEl('p', { className: 'lk-modal-text', text: config.warning })];

  if (config.requirePassword) {
    const wrap = createEl('div', { className: 'lk-field' });
    const label = createEl('label', { className: 'lk-field-label', id: 'clear-password-label', text: '主密码' });
    passwordInput = /** @type {HTMLInputElement} */ (
      createEl('input', { className: 'lk-input', id: 'clear-password', type: 'password' })
    );
    label.setAttribute('for', 'clear-password');
    passwordInput.autocomplete = 'current-password';
    passwordInput.setAttribute('aria-labelledby', 'clear-password-label');
    wrap.append(label, passwordInput);
    bodyChildren.push(wrap);
  }

  const confirmRow = createEl('div', { className: 'lk-modal-confirm' });
  confirmInput = /** @type {HTMLInputElement} */ (
    createEl('input', { className: 'lk-input', id: 'clear-confirm', type: 'text' })
  );
  confirmInput.autocomplete = 'off';
  confirmInput.spellcheck = false;
  confirmInput.setAttribute('aria-label', `请输入确认文字 ${CLEAR_CONFIRM_PHRASE}`);
  confirmRow.append(
    createEl('span', {
      className: 'lk-modal-confirm-hint',
      text: `请输入「${CLEAR_CONFIRM_PHRASE}」以确认`
    }),
    confirmInput
  );
  bodyChildren.push(confirmRow);

  /** 确认按钮是否可用：必须输入正确的确认文字 */
  const syncConfirmState = () => {
    if (confirmButton) confirmButton.disabled = confirmInput?.value.trim() !== CLEAR_CONFIRM_PHRASE;
  };
  confirmInput.addEventListener('input', syncConfirmState);

  /** 执行清空流程 */
  const handleConfirm = async () => {
    if (confirmInput?.value.trim() !== CLEAR_CONFIRM_PHRASE) return;
    if (confirmButton) confirmButton.disabled = true;

    try {
      if (config.requirePassword && passwordInput) {
        const passed = await config.verifyPassword?.(passwordInput.value);
        if (!passed) {
          dialog?.setError('主密码不正确');
          passwordInput.value = '';
          passwordInput.focus();
          syncConfirmState();
          return;
        }
      }
      await config.onConfirm();
      dialog?.close();
    } catch {
      dialog?.setError('操作失败，请重试');
      syncConfirmState();
    }
  };

  dialog = openModal({
    title: '清空所有数据',
    subtitle: config.subtitle,
    bodyChildren,
    actions: [
      { label: '取消', variant: 'secondary', onClick: () => dialog?.close() },
      {
        label: '确认清空',
        variant: 'danger',
        onClick: () => {
          void handleConfirm();
        }
      }
    ]
  });

  confirmButton = /** @type {HTMLButtonElement | null} */ (dialog.buttons[1] ?? null);
  syncConfirmState();
  return dialog;
}

/* --------------------------------------------------------------------------
 * 密码输入框（显隐眼睛 + 强度条，DESIGN.md F）
 * -------------------------------------------------------------------------- */

/** 强度条段位对应的颜色变量（DESIGN.md F 指定色序） */
const STRENGTH_SEGMENT_TOKENS = [
  '--lk-semantic-error',
  '--lk-semantic-warning',
  '--lk-brand-yellow',
  '--lk-brand-green'
];

/**
 * 按分数点亮强度条（1–4 段）。
 * @param {HTMLElement | null} root 含 4 个 [data-segment] 的容器
 * @param {number} segments 1–4
 */
export function setStrengthBar(root, segments) {
  if (!root) return;
  const safeSegments = Math.min(4, Math.max(1, Number(segments) || 1));
  const nodes = root.querySelectorAll('[data-segment]');
  nodes.forEach((node, index) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.backgroundColor =
      index < safeSegments ? `var(${STRENGTH_SEGMENT_TOKENS[safeSegments - 1]})` : '';
  });
}

/**
 * 切换密码输入框的显隐。
 * @param {HTMLInputElement | null} input
 * @param {HTMLElement | null} eyeButton
 * @param {boolean} visible
 */
export function setPasswordVisible(input, eyeButton, visible) {
  if (input) input.type = visible ? 'text' : 'password';
  if (eyeButton) {
    eyeButton.setAttribute('aria-pressed', visible ? 'true' : 'false');
    const label = visible ? '隐藏密码' : '显示密码';
    const srText = eyeButton.querySelector('.lk-sr-only');
    setText(srText, label);
    eyeButton.setAttribute('aria-label', label);
  }
}

/**
 * 绑定一组「密码输入 + 眼睛按钮」。
 * @param {{input: HTMLInputElement | null, button: HTMLElement | null}} pair
 * @returns {{reset: () => void}}
 */
export function bindPasswordToggle(pair) {
  const { input, button } = pair;
  let visible = false;

  button?.addEventListener('click', () => {
    visible = !visible;
    setPasswordVisible(input, button, visible);
    input?.focus();
  });

  return {
    reset() {
      visible = false;
      setPasswordVisible(input, button, false);
      if (input) input.value = '';
    }
  };
}

/**
 * 生成冷却提示文本，如「剩余 28 秒」。
 * @param {number} remainingMs
 * @returns {string}
 */
export function cooldownText(remainingMs) {
  return formatRemainingSeconds(remainingMs);
}

/* --------------------------------------------------------------------------
 * 本地文件下载（导出备份用）
 * --------------------------------------------------------------------------
 * 纯本地操作：Blob + 临时 object URL + 隐藏 <a download>，
 * 不发起任何网络请求；用完立即 revokeObjectURL，避免 URL 泄漏。
 * -------------------------------------------------------------------------- */

/**
 * 把文本保存为本地文件。
 * @param {string} filename
 * @param {string} text
 * @returns {boolean} 是否成功触发下载
 */
export function downloadTextFile(filename, text) {
  if (typeof filename !== 'string' || filename.length === 0) return false;
  if (typeof text !== 'string') return false;
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;

  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = /** @type {HTMLAnchorElement} */ (createEl('a'));
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';

  document.body.append(link);
  link.click();
  link.remove();

  // 立即回收，避免 object URL 常驻内存
  URL.revokeObjectURL(url);
  return true;
}
