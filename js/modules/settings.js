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
import { byId, createEl, downloadTextFile, openModal, setStrengthBar, setText } from '../lib/dom.js';

/**
 * @typedef {object} SettingsApi
 * @property {number[]} autoLockOptions
 * @property {() => number} getAutoLockMinutes
 * @property {(minutes: number) => void} setAutoLockMinutes
 * @property {(oldPassword: string, newPassword: string, confirmation: string) => Promise<void>} changePassword
 * @property {() => void} requestClearAll
 * @property {() => Promise<{filename: string, text: string}>} exportEncryptedBackup
 * @property {() => Promise<{filename: string, text: string}>} exportPlaintextBackup
 * @property {(text: string) => Promise<{ok: boolean, db?: object, summary?: object, hasSecurity?: boolean, schemaVersion?: number, code?: string}>} inspectBackup
 * @property {(db: object, mode: 'merge' | 'overwrite') => Promise<{securityChanged: boolean}>} importBackup
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

/* ==========================================================================
 * 数据备份（F6-3 / F6-4）
 * --------------------------------------------------------------------------
 * 加密边界：本模块**不接触 CryptoKey**。
 *   加密备份 = 直接把整库序列化（credentials.password / note 本来就是密文）；
 *   明文备份 = 由 main.js 注入的 exportPlaintextBackup() 内部解密后返回文本；
 *   所以这里只负责「取文本 → 触发下载 → 提示」，明文不进入任何模块变量。
 * 写盘时机：导入必须等用户选定「合并」或「覆盖」之后才写盘；inspectBackup 只读不写。
 * ========================================================================== */

/** 明文导出需要用户输入的确认文字 */
const PLAINTEXT_CONFIRM_PHRASE = '确认导出';

/** 备份相关错误码 → 文案 */
const BACKUP_MESSAGES = {
  INVALID_JSON: '文件无法解析为 JSON，可能已损坏',
  NOT_LIFEKEEPER: '这不是 LifeKeeper 的备份文件',
  UNSUPPORTED_VERSION: '备份版本不受支持，请用更新版本的 LifeKeeper 打开',
  INVALID_SHAPE: '备份结构不正确：某些数据集合不是数组'
};

/**
 * 装配「数据备份」卡片。
 * @param {SettingsApi} api
 */
function mountBackupCard(api) {
  const errorNode = byId('settings-backup-error');
  const fileInput = /** @type {HTMLInputElement | null} */ (byId('settings-import-input'));

  const showError = (message) => setText(errorNode, message ?? '');
  const clearError = () => setText(errorNode, '');

  /* ---------- 导出加密备份 ---------- */
  byId('settings-export-encrypted')?.addEventListener('click', async () => {
    clearError();
    try {
      const { filename, text } = await api.exportEncryptedBackup();
      if (!downloadTextFile(filename, text)) {
        showError('当前环境不支持本地下载');
        return;
      }
      api.notify('已导出加密备份', { type: 'success' });
    } catch (error) {
      showError(`导出失败：${error?.message ?? '未知错误'}`);
    }
  });

  /* ---------- 导出明文备份（必须先输入确认文字） ---------- */
  byId('settings-export-plaintext')?.addEventListener('click', () => {
    clearError();

    /** @type {ReturnType<typeof openModal> | null} */
    let dialog = null;
    /** @type {HTMLButtonElement | null} */
    let confirmButton = null;

    const warning = createEl('p', {
      className: 'lk-modal-text lk-modal-warning',
      text: '明文备份中的密码与备注不加密：任何拿到该文件的人都能直接读到全部密码。请仅在确有必要时导出，并在导出后妥善保管或及时删除。'
    });

    const field = createEl('div', { className: 'lk-field' });
    field.append(
      createEl('span', {
        className: 'lk-field-label',
        text: `请输入「${PLAINTEXT_CONFIRM_PHRASE}」以确认`
      })
    );
    const confirmInput = /** @type {HTMLInputElement} */ (
      createEl('input', { className: 'lk-input', id: 'plaintext-confirm', type: 'text' })
    );
    confirmInput.setAttribute('autocomplete', 'off');
    confirmInput.setAttribute('aria-label', `请输入确认文字 ${PLAINTEXT_CONFIRM_PHRASE}`);
    field.append(confirmInput);

    const syncState = () => {
      if (confirmButton) {
        confirmButton.disabled = confirmInput.value.trim() !== PLAINTEXT_CONFIRM_PHRASE;
      }
    };
    confirmInput.addEventListener('input', () => {
      syncState();
      dialog?.setError('');
    });

    const handleConfirm = async () => {
      if (confirmInput.value.trim() !== PLAINTEXT_CONFIRM_PHRASE) return;
      if (confirmButton) confirmButton.disabled = true;
      try {
        // 明文只在这一行短暂存在：拿到文本 → 立刻落成文件 → 不再持有引用
        const { filename, text } = await api.exportPlaintextBackup();
        if (!downloadTextFile(filename, text)) {
          dialog?.setError('当前环境不支持本地下载');
          syncState();
          return;
        }
        dialog?.close();
        api.notify('已导出明文备份，请妥善保管', { type: 'error' });
      } catch (error) {
        // 解密失败：整体中止，绝不产出半成品文件
        dialog?.setError(`导出失败：${error?.message ?? '未知错误'}`);
        syncState();
      }
    };

    dialog = openModal({
      title: '导出明文备份',
      subtitle: '此文件不受主密码保护',
      bodyChildren: [warning, field],
      actions: [
        { label: '取消', variant: 'secondary', onClick: () => dialog?.close() },
        {
          label: '确认导出',
          variant: 'danger',
          onClick: () => {
            void handleConfirm();
          }
        }
      ]
    });

    confirmButton = /** @type {HTMLButtonElement | null} */ (dialog.buttons[1] ?? null);
    syncState();
    confirmInput.focus();
  });

  /* ---------- 导入备份 ---------- */
  byId('settings-import-button')?.addEventListener('click', () => {
    clearError();
    // 每次清空，保证「连续选同一个文件」也能再次触发 change
    if (fileInput) fileInput.value = '';
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async () => {
    clearError();
    const file = fileInput?.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const inspected = await api.inspectBackup(text);

      if (!inspected.ok) {
        // 损坏 / 非本应用数据：只报错，绝不写盘
        let dialog = null;
        dialog = openModal({
          title: '无法导入该文件',
          subtitle: file.name,
          bodyChildren: [
            createEl('p', {
              className: 'lk-modal-text',
              text: BACKUP_MESSAGES[inspected.code] ?? '备份文件校验未通过'
            })
          ],
          actions: [{ label: '知道了', variant: 'primary', onClick: () => dialog?.close() }]
        });
        return;
      }

      showImportPreview(api, file.name, inspected);
    } catch (error) {
      showError(`读取文件失败：${error?.message ?? '未知错误'}`);
    } finally {
      if (fileInput) fileInput.value = '';
    }
  });
}

/**
 * 展示导入预览，并让用户在「合并 / 覆盖」之间做选择。
 * @param {SettingsApi} api
 * @param {string} filename
 * @param {{db: object, summary: {transactions: number, diaries: number, items: number, credentials: number}, hasSecurity: boolean, schemaVersion: number}} inspected
 */
function showImportPreview(api, filename, inspected) {
  const { summary } = inspected;
  const body = [];

  body.push(
    createEl('p', {
      className: 'lk-modal-text',
      text: `文件：${filename}（schemaVersion ${inspected.schemaVersion}）`
    })
  );

  const list = createEl('ul', { className: 'lk-import-summary' });
  for (const [label, count] of [
    ['收支流水', summary.transactions],
    ['生活记录', summary.diaries],
    ['物品台账', summary.items],
    ['账号密码', summary.credentials]
  ]) {
    const item = createEl('li', { className: 'lk-import-summary-item' });
    item.append(
      createEl('span', { className: 'lk-import-summary-label', text: label }),
      createEl('span', { className: 'lk-import-summary-value', text: `${count} 条` })
    );
    list.append(item);
  }
  body.push(list);

  body.push(
    createEl('p', {
      className: 'lk-modal-text',
      text: inspected.hasSecurity
        ? '备份包含主密码校验信息。若它与本机不同，导入后需要改用备份对应的主密码解锁。'
        : '备份不包含主密码校验信息，导入后沿用本机当前的主密码。'
    })
  );
  body.push(
    createEl('p', {
      className: 'lk-modal-text',
      text: '合并：同一 id 以备份为准，其余保留本机数据。覆盖：用备份替换全部数据。'
    })
  );

  /** @type {ReturnType<typeof openModal> | null} */
  let dialog = null;
  let busy = false;

  /** @param {'merge' | 'overwrite'} mode */
  const run = async (mode) => {
    if (busy) return;
    busy = true;
    try {
      const result = await api.importBackup(inspected.db, mode);
      dialog?.close();
      if (result?.securityChanged) {
        api.notify('导入完成：请使用备份对应的主密码解锁', { type: 'error' });
      } else {
        api.notify(mode === 'merge' ? '已合并备份数据' : '已覆盖为备份数据', { type: 'success' });
      }
    } catch (error) {
      dialog?.setError(`导入失败：${error?.message ?? '未知错误'}`);
      busy = false;
    }
  };

  dialog = openModal({
    title: '导入备份',
    subtitle: '确认内容后才会写入本机',
    bodyChildren: body,
    actions: [
      { label: '取消', variant: 'secondary', onClick: () => dialog?.close() },
      { label: '合并', variant: 'secondary', onClick: () => void run('merge') },
      { label: '覆盖', variant: 'danger', onClick: () => void run('overwrite') }
    ]
  });
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

  // 数据备份（导出 / 导入）
  mountBackupCard(api);
}
