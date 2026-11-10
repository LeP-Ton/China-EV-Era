export const money = (value: number, digits = 2) => `${(value / 100).toFixed(digits)}`;
export const integer = (value: number) => Math.round(value).toLocaleString('zh-CN');
export const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
export const price = (value: number) => (value * 100).toFixed(2);
export function weekLabel(week: number) {
  return week === 0
    ? '创立日'
    : `${2026 + Math.floor((week - 1) / 52)} Q${Math.floor(((week - 1) % 52) / 13) + 1} · W${((week - 1) % 13) + 1}`;
}
