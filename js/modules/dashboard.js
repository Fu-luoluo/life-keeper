/* ==========================================================================
 * js/modules/dashboard.js — M1 仪表盘 + 统计图表
 * --------------------------------------------------------------------------
 * 布局：bento 网格（卡片间距 {spacing.xl} = 24px）
 *   第一行：三张统计卡片（DESIGN.md D）
 *   第二行：左 2/3 图表卡（donut + 6 个月分组柱状图）、右 1/3 保修提醒 + 快捷操作
 *   第三行：最近收支（3 条）+ 最近日记（2 条）
 *
 * 图表：原生 SVG，全部 createElementNS 构造，无第三方库、无网络请求。
 *   分类 donut 配色 = DESIGN.md G 在支出分类上的固定映射（来自 lib/categories.js，
 *   与记账模块共用同一份真值）；柱状图网格线 hairline-soft、坐标文字 steel。
 *
 * 分层约定：
 *   - 不 import storage.js / main.js，数据与跳转能力全部由 main.js 注入；
 *   - 无 innerHTML / outerHTML / insertAdjacentHTML：文本一律 textContent；
 *   - id / createdAt / updatedAt 由 storage 层维护。
 * ========================================================================== */

import { byId, createEl, setText } from '../lib/dom.js';
import { categoryOf, expenseChartColor } from '../lib/categories.js';
import {
  EXPIRING_WINDOW_DAYS,
  categoryBreakdown,
  currentMonthKey,
  formatCurrency,
  formatDayGroupTitle,
  localDayKeyFromIso,
  localMonthKeyFromIso,
  latestByDate,
  monthlyTrendBuckets,
  periodOverPeriod,
  shiftMonthKey,
  summarizeTransactions,
  transactionsOfMonth,
  warrantyStatus
} from '../lib/utils.js';

/**
 * @typedef {object} DashboardApi
 * @property {() => Promise<object[]>} getTransactions
 * @property {() => Promise<object[]>} getDiaries
 * @property {() => Promise<object[]>} getItems
 * @property {() => Promise<object[]>} getCredentials
 * @property {() => void} quickAddTransaction
 * @property {() => void} quickWriteDiary
 * @property {() => void} quickAddItem
 * @property {() => void} quickAddCredential
 * @property {(pageId: string) => void} navigateTo
 * @property {(message: string, options?: {type?: 'success' | 'error' | 'neutral'}) => void} notify
 */

/** 趋势图月数 */
const TREND_MONTHS = 6;

/** 最近动态条数 */
const RECENT_TRANSACTIONS = 3;
const RECENT_DIARIES = 2;

/** 图表内边距（SVG 用户单位） */
const CHART = {
  donut: { size: 180, radius: 62, thickness: 20 },
  bars: {
    width: 520,
    height: 200,
    padLeft: 44,
    padRight: 12,
    padTop: 16,
    padBottom: 28,
    groupGap: 10,
    barGap: 4,
    barMaxWidth: 26
  }
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 图标形状表（24 网格、1.6 描边）。
 * @type {Record<string, Array<[string, Record<string, string>]>>}
 */
const ICON_SHAPES = {
  arrowUp: [['path', { d: 'M12 19V5' }], ['path', { d: 'M6 11l6-6 6 6' }]],
  arrowDown: [['path', { d: 'M12 5v14' }], ['path', { d: 'M6 13l6 6 6-6' }]],
  minus: [['path', { d: 'M5.5 12h13' }]],
  wallet: [
    ['rect', { x: '2.75', y: '5.75', width: '18.5', height: '12.5', rx: '3' }],
    ['path', { d: 'M2.75 10.25h18.5' }],
    ['path', { d: 'M6.75 14.5h3.5' }]
  ],
  plus: [['path', { d: 'M12 5.25v13.5M5.25 12h13.5' }]],
  note: [
    ['path', { d: 'M5.75 4.25h9.5a3 3 0 0 1 3 3v12.5H8.75a3 3 0 0 1-3-3z' }],
    ['path', { d: 'M5.75 16.75h12.5' }],
    ['path', { d: 'M9.25 9.25h5.75' }]
  ],
  box: [
    ['path', { d: 'M3.25 7.75 12 3.5l8.75 4.25L12 12z' }],
    ['path', { d: 'M3.25 7.75V16L12 20.5l8.75-4.5V7.75' }],
    ['path', { d: 'M12 12v8.5' }]
  ],
  key: [
    ['circle', { cx: '8.25', cy: '12', r: '4.25' }],
    ['path', { d: 'M12.5 12h7.25' }],
    ['path', { d: 'M17.25 12v3' }]
  ],
  alert: [
    ['path', { d: 'M10.6 4.1 2.9 17.4A1.6 1.6 0 0 0 4.3 19.9h15.4a1.6 1.6 0 0 0 1.4-2.5L13.4 4.1a1.6 1.6 0 0 0-2.8 0z' }],
    ['path', { d: 'M12 9.5v4M12 16.75h.01' }]
  ],
  chart: [
    ['path', { d: 'M4.25 19.75V4.25' }],
    ['path', { d: 'M4.25 19.75h15.5' }],
    ['path', { d: 'M8.5 19.75v-6M12.5 19.75v-10M16.5 19.75v-4' }]
  ]
};

/**
 * 用 createElementNS 构造图标。
 * @param {string} name
 * @param {number} [size]
 * @returns {SVGElement}
 */
function createIcon(name, size = 16) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [tag, attributes] of ICON_SHAPES[name] ?? ICON_SHAPES.chart) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}

/* --------------------------------------------------------------------------
 * 模块状态（仅内存）
 * -------------------------------------------------------------------------- */

/** @type {DashboardApi | null} */
let api = null;
let mounted = false;
/** 图表是否已经播放过入场动画（只在首次渲染时生长） */
let chartsAnimated = false;

/* --------------------------------------------------------------------------
 * SVG 小工具
 * -------------------------------------------------------------------------- */

/**
 * 创建 SVG 元素并设置属性。
 * @param {string} tag
 * @param {Record<string, string | number>} [attributes]
 * @returns {SVGElement}
 */
function svgEl(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

/**
 * 为图表补上可访问性三件套：role="img" + aria-label + <title>/<desc>。
 * @param {SVGElement} svg
 * @param {{label: string, title: string, desc: string}} config
 */
function describeChart(svg, config) {
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', config.label);
  const title = svgEl('title');
  title.textContent = config.title;
  const desc = svgEl('desc');
  desc.textContent = config.desc;
  svg.prepend(desc);
  svg.prepend(title);
}

/** @returns {string} 形如 "var(--lk-brand-purple)" */
function token(name) {
  return `var(--lk-${name})`;
}

/* --------------------------------------------------------------------------
 * 图表 1：分类支出 donut
 * -------------------------------------------------------------------------- */

/**
 * 渲染分类支出 donut。
 * @param {HTMLElement} host
 * @param {Array<{category: string, amount: number, percent: number}>} breakdown
 * @param {number} total
 */
function renderDonut(host, breakdown, total) {
  host.replaceChildren();

  if (breakdown.length === 0) {
    const empty = createEl('p', {
      className: 'lk-chart-empty',
      text: '记一笔后显示分类占比'
    });
    host.append(empty);
    return;
  }

  const { size, radius, thickness } = CHART.donut;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${size} ${size}`,
    width: String(size),
    height: String(size),
    class: 'lk-donut'
  });
  describeChart(svg, {
    label: `本月分类支出环形图，共 ${breakdown.length} 个分类，合计 ${formatCurrency(total)}`,
    title: `本月分类支出：${formatCurrency(total)}`,
    desc: breakdown
      .map((slice) => `${slice.category} ${slice.percent}% ${formatCurrency(slice.amount)}`)
      .join('；')
  });

  // 底圈：让空隙处有底色，视觉上更完整
  svg.append(
    svgEl('circle', {
      cx: center,
      cy: center,
      r: radius,
      fill: 'none',
      stroke: token('hairline-soft'),
      'stroke-width': thickness
    })
  );

  // 每段用 stroke-dasharray 画弧：起始位置靠 stroke-dashoffset 顺时针推进
  let consumed = 0;
  for (const slice of breakdown) {
    const length = (slice.percent / 100) * circumference;
    // 段与段之间留 1.5 个单位空隙，但不超过段长的一半，避免短段被吃掉
    const visible = Math.max(length - 1.5, Math.min(length, 0.5));
    const arc = svgEl('circle', {
      cx: center,
      cy: center,
      r: radius,
      fill: 'none',
      stroke: token(expenseChartColor(slice.category)),
      'stroke-width': thickness,
      'stroke-dasharray': `${visible} ${circumference - visible}`,
      'stroke-dashoffset': -consumed,
      'stroke-linecap': 'butt',
      transform: `rotate(-90 ${center} ${center})`
    });
    const arcTitle = svgEl('title');
    arcTitle.textContent = `${slice.category}：${slice.percent}%（${formatCurrency(slice.amount)}）`;
    arc.append(arcTitle);
    svg.append(arc);
    consumed += length;
  }

  // 圆心汇总
  const valueText = svgEl('text', {
    x: center,
    y: center - 2,
    'text-anchor': 'middle',
    class: 'lk-donut-total'
  });
  valueText.textContent = formatCurrency(total);
  const labelText = svgEl('text', {
    x: center,
    y: center + 16,
    'text-anchor': 'middle',
    class: 'lk-donut-caption'
  });
  labelText.textContent = '本月支出';
  svg.append(valueText, labelText);

  /* 图例：分类名、百分比、金额；色块与 donut 同源 */
  const legend = createEl('ul', { className: 'lk-legend' });
  for (const slice of breakdown) {
    const item = createEl('li', { className: 'lk-legend-item' });
    const dot = createEl('span', { className: 'lk-legend-dot' });
    dot.dataset.chartColor = expenseChartColor(slice.category);
    const name = createEl('span', { className: 'lk-legend-name', text: slice.category });
    const percent = createEl('span', { className: 'lk-legend-percent', text: `${slice.percent}%` });
    const amount = createEl('span', { className: 'lk-legend-amount', text: formatCurrency(slice.amount) });
    item.append(dot, name, percent, amount);
    legend.append(item);
  }

  const wrap = createEl('div', { className: 'lk-donut-wrap' });
  wrap.append(svg, legend);
  host.append(wrap);
}

/* --------------------------------------------------------------------------
 * 图表 2：近 6 个月收支分组柱状图
 * -------------------------------------------------------------------------- */

/**
 * 渲染近 6 个月收支分组柱状图。
 * @param {HTMLElement} host
 * @param {Array<{monthKey: string, label: string, income: number, expense: number}>} buckets
 * @param {string} currentMonth
 */
function renderBars(host, buckets, currentMonth) {
  host.replaceChildren();

  const { width, height, padLeft, padRight, padTop, padBottom, groupGap, barGap } = CHART.bars;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  const maxValue = Math.max(
    1,
    ...buckets.map((bucket) => Math.max(bucket.income, bucket.expense))
  );
  // 取整到「好看」的量级，让刻度可读：先把 max 向上取整到 3 的整数倍再除以 3
  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  const rawStep = maxValue / 3;
  const step = Math.max(magnitude, Math.ceil(rawStep / magnitude) * magnitude);
  const axisMax = step * 3;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    height: String(height),
    class: 'lk-bars',
    preserveAspectRatio: 'none'
  });
  const totalIncome = buckets.reduce((sum, bucket) => sum + bucket.income, 0);
  const totalExpense = buckets.reduce((sum, bucket) => sum + bucket.expense, 0);
  describeChart(svg, {
    label: `近 ${buckets.length} 个月收支柱状图，合计收入 ${formatCurrency(totalIncome)}，合计支出 ${formatCurrency(totalExpense)}`,
    title: `近 ${buckets.length} 个月收支`,
    desc: buckets
      .map(
        (bucket) =>
          `${bucket.label} 支出 ${formatCurrency(bucket.expense)}、收入 ${formatCurrency(bucket.income)}`
      )
      .join('；')
  });

  /* 网格线 + Y 轴刻度（坐标轴文字 steel + caption-bold） */
  for (let i = 0; i <= 3; i += 1) {
    const y = padTop + innerHeight - (innerHeight * i) / 3;
    svg.append(
      svgEl('line', {
        x1: padLeft,
        y1: y,
        x2: width - padRight,
        y2: y,
        stroke: token('hairline-soft'),
        'stroke-width': 1
      })
    );
    const tick = svgEl('text', {
      x: padLeft - 8,
      y: y + 4,
      'text-anchor': 'end',
      class: 'lk-axis-text'
    });
    tick.textContent = formatCurrency(step * i).replace('¥', '');
    svg.append(tick);
  }

  /* 每月一组双柱：左支出、右收入 */
  const groupWidth = innerWidth / Math.max(1, buckets.length);
  const barWidth = Math.min(
    CHART.bars.barMaxWidth,
    (groupWidth - groupGap - barGap) / 2
  );

  buckets.forEach((bucket, index) => {
    const groupCenter = padLeft + groupWidth * index + groupWidth / 2;
    const isCurrent = bucket.monthKey === currentMonth;

    const bars = [
      { key: 'expense', value: bucket.expense, offset: -(barWidth + barGap) / 2 },
      { key: 'income', value: bucket.income, offset: (barWidth + barGap) / 2 }
    ];

    for (const bar of bars) {
      const barHeight = (bar.value / axisMax) * innerHeight;
      const x = groupCenter + bar.offset - barWidth / 2;
      const y = padTop + innerHeight - barHeight;

      // 无数据月份也画一个 2px 的空柱位，保持基线的连续感
      // 支出柱用 {colors.hairline-strong}，收入柱用 {colors.brand-green}（DESIGN.md G）；
      // 当前月份的柱子在各自基色上做 G 色板高亮（见下方 highlight 覆盖）
      const rect = svgEl('rect', {
        x,
        y: barHeight > 0 ? y : padTop + innerHeight - 2,
        width: barWidth,
        height: barHeight > 0 ? barHeight : 2,
        rx: 3,
        fill: isCurrent
          ? token(bar.key === 'expense' ? 'brand-purple' : 'brand-teal')
          : token(bar.key === 'expense' ? 'hairline-strong' : 'brand-green'),
        class: 'lk-bar',
        'data-highlight': isCurrent ? 'true' : 'false',
        'data-series': bar.key
      });
      const barTitle = svgEl('title');
      barTitle.textContent = `${bucket.label} ${bar.key === 'expense' ? '支出' : '收入'} ${formatCurrency(bar.value)}`;
      rect.append(barTitle);
      svg.append(rect);
    }

    /* 月份标签（当前月份加粗高亮） */
    const label = svgEl('text', {
      x: groupCenter,
      y: height - 8,
      'text-anchor': 'middle',
      class: 'lk-axis-text',
      'data-current': isCurrent ? 'true' : 'false'
    });
    label.textContent = bucket.label;
    svg.append(label);
  });

  /* 图例 */
  const legend = createEl('div', { className: 'lk-chart-legend' });
  for (const [colorToken, text] of [
    ['hairline-strong', '支出'],
    ['brand-green', '收入']
  ]) {
    const item = createEl('span', { className: 'lk-chart-legend-item' });
    const dot = createEl('span', { className: 'lk-legend-dot' });
    dot.dataset.chartColor = colorToken;
    item.append(dot, createEl('span', { text }));
    legend.append(item);
  }

  const wrap = createEl('div', { className: 'lk-bars-wrap' });
  wrap.append(svg, legend);
  host.append(wrap);
}

/* --------------------------------------------------------------------------
 * 卡片构件
 * -------------------------------------------------------------------------- */

/**
 * 一张统计卡片（DESIGN.md D）。
 * @param {{variant: 'income' | 'expense' | 'balance', title: string, value: number, icon: string, iconInk: string, change?: {percent: number | null, direction: string}}} config
 * @returns {HTMLElement}
 */
function createStatCard(config) {
  const card = createEl('div', { className: 'lk-stat-card' });
  card.dataset.variant = config.variant;

  const head = createEl('div', { className: 'lk-stat-card-head' });
  const badge = createEl('span', { className: 'lk-stat-card-badge' });
  badge.dataset.ink = config.iconInk;
  badge.append(createIcon(config.icon, 18));
  head.append(createEl('span', { className: 'lk-stat-card-title', text: config.title }), badge);

  const value = createEl('span', { className: 'lk-stat-card-value', text: formatCurrency(config.value) });

  card.append(head, value);

  // 环比：上月无数据（percent 为 null）时完全不渲染，不留空白
  const change = config.change;
  if (change && change.percent !== null) {
    const row = createEl('span', { className: 'lk-stat-card-change' });
    row.dataset.direction = change.direction;
    const iconName =
      change.direction === 'up' ? 'arrowUp' : change.direction === 'down' ? 'arrowDown' : 'minus';
    row.append(
      createIcon(iconName, 14),
      createEl('span', { text: `较上月 ${change.percent > 0 ? '+' : ''}${change.percent}%` })
    );
    card.append(row);
  } else if (change) {
    const row = createEl('span', { className: 'lk-stat-card-change is-muted', text: '上月无数据' });
    card.append(row);
  }

  return card;
}

/**
 * 卡片外壳（标题 + 右上角附加内容 + 内容区）。
 * @param {{title: string, extra?: HTMLElement | null, body?: HTMLElement | null, className?: string}} config
 * @returns {HTMLElement}
 */
function createPanel(config) {
  const panel = createEl('section', { className: `lk-panel ${config.className ?? ''}`.trim() });
  const head = createEl('div', { className: 'lk-panel-head' });
  head.append(createEl('h2', { className: 'lk-panel-title', text: config.title }));
  if (config.extra) head.append(config.extra);
  panel.append(head);
  if (config.body) panel.append(config.body);
  return panel;
}

/** muted 占位文案 */
function createPlaceholder(text) {
  return createEl('p', { className: 'lk-placeholder', text });
}

/* --------------------------------------------------------------------------
 * 渲染
 * -------------------------------------------------------------------------- */

/**
 * 渲染整页。
 */
async function render() {
  if (!api) return;

  const [transactions, diaries, items, credentials] = await Promise.all([
    api.getTransactions(),
    api.getDiaries(),
    api.getItems(),
    api.getCredentials()
  ]);

  const thisMonth = currentMonthKey();
  const lastMonth = shiftMonthKey(thisMonth, -1);
  const todayKey = localDayKeyFromIso(new Date().toISOString());

  const thisSummary = summarizeTransactions(transactionsOfMonth(transactions, thisMonth));
  const lastSummary = summarizeTransactions(
    transactionsOfMonth(transactions, lastMonth ?? thisMonth)
  );

  /* ---------- 第一行：三张统计卡片 ---------- */
  const statRow = byId('dashboard-stats');
  if (statRow) {
    statRow.replaceChildren(
      createStatCard({
        variant: 'income',
        title: '本月收入',
        value: thisSummary.income,
        icon: 'arrowUp',
        iconInk: 'brand-green',
        change: periodOverPeriod(thisSummary.income, lastSummary.income)
      }),
      createStatCard({
        variant: 'expense',
        title: '本月支出',
        value: thisSummary.expense,
        icon: 'arrowDown',
        iconInk: 'semantic-error',
        change: periodOverPeriod(thisSummary.expense, lastSummary.expense)
      }),
      createStatCard({
        variant: 'balance',
        title: '本月结余',
        value: thisSummary.balance,
        icon: 'wallet',
        iconInk: 'primary'
      })
    );
  }

  /* ---------- 图表卡：donut + 柱状图 ---------- */
  const donutHost = byId('dashboard-donut');
  if (donutHost) {
    const breakdown = categoryBreakdown(transactionsOfMonth(transactions, thisMonth));
    const totalExpense = breakdown.reduce((sum, slice) => sum + slice.amount, 0);
    renderDonut(donutHost, breakdown, totalExpense);
  }

  const barsHost = byId('dashboard-bars');
  if (barsHost) {
    renderBars(barsHost, monthlyTrendBuckets(transactions, thisMonth, TREND_MONTHS), thisMonth);
  }

  /* ---------- 保修提醒 ---------- */
  const warrantyBody = byId('dashboard-warranty');
  if (warrantyBody) {
    const alerts = items
      .map((item) => ({ item, warranty: warrantyStatus(item?.warrantyUntil ?? null, todayKey) }))
      .filter((entry) => entry.warranty.status !== null)
      // 过期在前（越久越靠前），其次按剩余天数升序
      .sort((a, b) => {
        if (a.warranty.status !== b.warranty.status) {
          return a.warranty.status === 'EXPIRED' ? -1 : 1;
        }
        return a.warranty.status === 'EXPIRED'
          ? b.warranty.days - a.warranty.days
          : a.warranty.days - b.warranty.days;
      });

    if (alerts.length === 0) {
      warrantyBody.replaceChildren(createPlaceholder('暂无临期或过期的保修'));
    } else {
      const list = createEl('div', { className: 'lk-mini-list' });
      for (const { item, warranty } of alerts.slice(0, 5)) {
        const row = createEl('button', { className: 'lk-mini-row', type: 'button' });
        row.dataset.action = 'goto-items';
        const main = createEl('span', { className: 'lk-mini-main' });
        main.append(
          createEl('span', { className: 'lk-mini-title', text: String(item?.name ?? '') }),
          createEl('span', {
            className: 'lk-mini-sub',
            text: typeof item?.location === 'string' && item.location ? item.location : '未填写位置'
          })
        );
        const status = createEl('span', { className: 'lk-mini-value', text: '' });
        status.dataset.variant = warranty.status === 'EXPIRED' ? 'expired' : 'expiring';
        status.textContent =
          warranty.status === 'EXPIRED'
            ? `已过期 ${warranty.days} 天`
            : `还剩 ${warranty.days} 天`;
        row.append(main, status);
        list.append(row);
      }
      if (alerts.length > 5) {
        list.append(createPlaceholder(`另有 ${alerts.length - 5} 件临期/过期物品`));
      }
      warrantyBody.replaceChildren(list);
    }
  }

  /* ---------- 计数行 ---------- */
  const counts = byId('dashboard-counts');
  if (counts) {
    counts.replaceChildren();
    const expiringCount = items.filter((item) => {
      const { status } = warrantyStatus(item?.warrantyUntil ?? null, todayKey);
      return status === 'EXPIRING';
    }).length;
    const expiredCount = items.filter((item) => {
      const { status } = warrantyStatus(item?.warrantyUntil ?? null, todayKey);
      return status === 'EXPIRED';
    }).length;

    for (const [label, value] of [
      ['物品', `${items.length} 件`],
      ['日记', `${diaries.length} 篇`],
      ['密码', `${credentials.length} 条`],
      ['临期', `${expiringCount} 件`],
      ['过期', `${expiredCount} 件`]
    ]) {
      const chip = createEl('span', { className: 'lk-count-chip' });
      chip.append(
        createEl('span', { className: 'lk-count-label', text: label }),
        createEl('span', { className: 'lk-count-value', text: value })
      );
      counts.append(chip);
    }
  }

  /* ---------- 最近收支 ---------- */
  const recentTransactions = byId('dashboard-recent-transactions');
  if (recentTransactions) {
    const recent = latestByDate(transactions, RECENT_TRANSACTIONS);
    if (recent.length === 0) {
      recentTransactions.replaceChildren(createPlaceholder('还没有收支记录'));
    } else {
      const list = createEl('div', { className: 'lk-mini-list' });
      for (const entry of recent) {
        const isIncome = entry.type === 'income';
        const style = categoryOf(isIncome ? 'income' : 'expense', entry.category);
        const row = createEl('button', { className: 'lk-mini-row', type: 'button' });
        row.dataset.action = 'goto-account';
        const tile = createEl('span', { className: 'lk-vault-tile lk-vault-tile-sm' });
        tile.dataset.tint = style.tint;
        tile.dataset.ink = style.ink;
        const main = createEl('span', { className: 'lk-mini-main' });
        main.append(
          createEl('span', {
            className: 'lk-mini-title',
            text:
              typeof entry.note === 'string' && entry.note
                ? `${entry.category} · ${entry.note}`
                : String(entry.category ?? '')
          }),
          createEl('span', {
            className: 'lk-mini-sub',
            text: [entry.account, localDayKeyFromIso(entry.date)].filter(Boolean).join(' · ')
          })
        );
        const amount = createEl('span', { className: 'lk-mini-value' });
        amount.dataset.variant = isIncome ? 'income' : 'expense';
        amount.textContent = `${isIncome ? '+' : '-'}${formatCurrency(entry.amountCents)}`;
        row.append(tile, main, amount);
        list.append(row);
      }
      recentTransactions.replaceChildren(list);
    }
  }

  /* ---------- 最近日记 ---------- */
  const recentDiaries = byId('dashboard-recent-diaries');
  if (recentDiaries) {
    const recent = latestByDate(diaries, RECENT_DIARIES);
    if (recent.length === 0) {
      recentDiaries.replaceChildren(createPlaceholder('还没有生活记录'));
    } else {
      const list = createEl('div', { className: 'lk-mini-list' });
      for (const entry of recent) {
        const dayKey = localDayKeyFromIso(entry.date);
        const row = createEl('button', { className: 'lk-mini-row', type: 'button' });
        row.dataset.action = 'goto-diary';
        const main = createEl('span', { className: 'lk-mini-main' });
        const title =
          typeof entry.title === 'string' && entry.title.trim()
            ? entry.title.trim()
            : dayKey
              ? formatDayGroupTitle(dayKey)
              : '无标题';
        main.append(
          createEl('span', { className: 'lk-mini-title', text: title }),
          createEl('span', {
            className: 'lk-mini-sub',
            text: dayKey ? formatDayGroupTitle(dayKey) : ''
          })
        );
        row.append(main);
        list.append(row);
      }
      recentDiaries.replaceChildren(list);
    }
  }

  /* 首次渲染触发一次图表生长动画 */
  if (!chartsAnimated) {
    chartsAnimated = true;
    document.documentElement.dataset.charts = 'grow';
  }
}

/* --------------------------------------------------------------------------
 * 事件
 * -------------------------------------------------------------------------- */

/** 绑定快捷操作与卡片跳转（事件委托，整页只需一次） */
function bindDashboard() {
  const root = byId('view-dashboard');
  if (!root) return;

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !api) return;

    const actionNode = target.closest('[data-quick]');
    if (actionNode instanceof HTMLElement && actionNode.dataset.quick) {
      switch (actionNode.dataset.quick) {
        case 'transaction':
          api.quickAddTransaction();
          return;
        case 'diary':
          api.quickWriteDiary();
          return;
        case 'item':
          api.quickAddItem();
          return;
        case 'credential':
          api.quickAddCredential();
          return;
        default:
          return;
      }
    }

    const gotoNode = target.closest('[data-action]');
    if (!(gotoNode instanceof HTMLElement)) return;
    switch (gotoNode.dataset.action) {
      case 'goto-account':
        api.navigateTo('account');
        return;
      case 'goto-diary':
        api.navigateTo('diary');
        return;
      case 'goto-items':
        api.navigateTo('items');
        return;
      default:
    }
  });
}

/* --------------------------------------------------------------------------
 * 对外入口
 * -------------------------------------------------------------------------- */

/**
 * 装配仪表盘（由 main.js 注入数据与跳转能力）。
 * @param {DashboardApi} injectedApi
 */
export function mountDashboard(injectedApi) {
  if (mounted) return;
  mounted = true;
  api = injectedApi;
  bindDashboard();
  void render();
}

/**
 * 锁定 / 清空数据后重置内存状态。
 */
export function resetDashboard() {
  chartsAnimated = false;
  delete document.documentElement.dataset.charts;
}

export { render as renderDashboard };
