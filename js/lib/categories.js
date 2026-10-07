/* ==========================================================================
 * js/lib/categories.js — 分类的单一真值（记账模块与仪表盘共用）
 * --------------------------------------------------------------------------
 * 为什么单独成文件：分类名与配色同时被 M2 记账（chip 网格、列表行）与
 * M1 仪表盘（donut 固定映射、图例）使用，分散定义必然漂移。
 *
 * 只使用 DESIGN.md 已定义的 Token：
 *   tint / ink   → {colors.card-tint-*} 与既有深色 Token（参照 badge-tag-* 配色思路）
 *   chartColor   → {colors.*}，用于图表的分类色（donut 与图例必须完全一致）
 * ========================================================================== */

/** 账户选项（PRD M2 默认账户；自定义管理属后续版本） */
export const ACCOUNTS = ['现金', '储蓄卡', '支付宝', '微信'];

/**
 * 支出分类：9 项（PRD M2 默认分类顺序）。
 * chartColor 为 DESIGN.md G 的分类色板在支出分类上的固定映射。
 */
export const EXPENSE_CATEGORIES = [
  { name: '餐饮', tint: 'peach', ink: 'brand-orange-deep', icon: 'meal', chartColor: 'brand-purple' },
  { name: '交通', tint: 'sky', ink: 'link-blue', icon: 'transport', chartColor: 'brand-orange' },
  { name: '购物', tint: 'rose', ink: 'brand-pink-deep', icon: 'shopping', chartColor: 'brand-teal' },
  { name: '学习', tint: 'lavender', ink: 'brand-purple-800', icon: 'study', chartColor: 'brand-pink' },
  { name: '娱乐', tint: 'yellow', ink: 'brand-brown', icon: 'fun', chartColor: 'brand-yellow' },
  { name: '医疗', tint: 'mint', ink: 'brand-green', icon: 'medical', chartColor: 'link-blue' },
  { name: '居家', tint: 'cream', ink: 'charcoal', icon: 'home', chartColor: 'brand-green' },
  { name: '人情', tint: 'yellow-bold', ink: 'brand-brown', icon: 'gift', chartColor: 'brand-brown' },
  { name: '其他', tint: 'gray', ink: 'slate', icon: 'more', chartColor: 'hairline-strong' }
];

/** 收入分类：6 项 */
export const INCOME_CATEGORIES = [
  { name: '工资补助', tint: 'mint', ink: 'brand-green', icon: 'salary', chartColor: 'brand-green' },
  { name: '兼职', tint: 'sky', ink: 'link-blue', icon: 'parttime', chartColor: 'link-blue' },
  { name: '奖学金', tint: 'lavender', ink: 'brand-purple-800', icon: 'award', chartColor: 'brand-purple' },
  { name: '红包', tint: 'rose', ink: 'brand-pink-deep', icon: 'redpacket', chartColor: 'brand-pink' },
  { name: '投资', tint: 'yellow', ink: 'brand-brown', icon: 'invest', chartColor: 'brand-yellow' },
  { name: '其他', tint: 'gray', ink: 'slate', icon: 'more', chartColor: 'hairline-strong' }
];

/** 按类型索引，保持与既有 CATEGORIES[type] 的调用方式一致 */
export const CATEGORIES = {
  expense: EXPENSE_CATEGORIES,
  income: INCOME_CATEGORIES
};

/** 各类型的默认分类（PRD M2：支出 = 餐饮、收入 = 工资补助） */
export const DEFAULT_CATEGORY = { expense: '餐饮', income: '工资补助' };

/** 找不到分类定义时的兜底 */
export const FALLBACK_CATEGORY = EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

const EXPENSE_BY_NAME = new Map(EXPENSE_CATEGORIES.map((entry) => [entry.name, entry]));

/**
 * 取支出分类的图表配色（DESIGN.md G 的固定映射）。
 * 未知分类（例如历史数据里的旧分类名）统一落到「其他」的 hairline-strong。
 * @param {string} name
 * @returns {string} Token 名（不含 --lk- 前缀）
 */
export function expenseChartColor(name) {
  return EXPENSE_BY_NAME.get(name)?.chartColor ?? 'hairline-strong';
}

/**
 * 取分类定义。
 * @param {'expense' | 'income'} type
 * @param {string} name
 * @returns {{name: string, tint: string, ink: string, icon: string, chartColor: string}}
 */
export function categoryOf(type, name) {
  const list = CATEGORIES[type] ?? EXPENSE_CATEGORIES;
  return list.find((entry) => entry.name === name) ?? FALLBACK_CATEGORY;
}
