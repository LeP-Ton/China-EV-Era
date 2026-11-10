import { round } from './random';
import { emptyPeriod } from './state';
import type { GameState, HistoryEvent, Message, PeriodFinance } from './types';

export const nextId = (s: GameState, prefix: string) => `${prefix}-${s.nextId++}`;
export function addEvent(s: GameState, event: Omit<HistoryEvent, 'id' | 'week'>) {
  s.history.push({ ...event, id: nextId(s, 'event'), week: s.week });
}
export function send(s: GameState, message: Omit<Message, 'id' | 'week' | 'read'>) {
  s.messages.unshift({ ...message, id: nextId(s, 'message'), week: s.week, read: false });
}
export function ensurePeriod(s: GameState) {
  const quarter = Math.min(11, Math.floor(s.week / 13));
  if (s.periodQuarter !== quarter) {
    s.period = emptyPeriod();
    s.periodQuarter = quarter;
  }
}
export function currentPeriod(s: GameState): PeriodFinance {
  return s.week < 156 && s.periodQuarter !== Math.floor(s.week / 13) ? emptyPeriod() : s.period;
}
export function transaction(
  s: GameState,
  category: string,
  label: string,
  cashDelta: number,
  profitDelta: number,
) {
  s.company.cash = round(s.company.cash + cashDelta);
  s.company.totalProfit = round(s.company.totalProfit + profitDelta);
  s.period.profit = round(s.period.profit + profitDelta);
  s.transactions.push({
    id: nextId(s, 'tx'),
    week: s.week,
    category,
    label,
    cashDelta: round(cashDelta),
    profitDelta: round(profitDelta),
    balance: s.company.cash,
  });
}
export function expense(
  s: GameState,
  category: 'research' | 'marketing' | 'quality' | 'payroll' | 'fixed' | 'interest' | 'aftersales',
  amount: number,
  label: string,
) {
  amount = round(amount);
  s.period[category] = round(s.period[category] + amount);
  transaction(s, category, label, -amount, -amount);
}
export function attention(s: GameState, points: number): boolean {
  if (s.attention.available < points) return false;
  s.attention.available -= points;
  s.attention.spent += points;
  return true;
}
export function cashRunway(s: GameState): number {
  const recent = s.weekly.slice(-4);
  const weeklyProfit = recent.length
    ? recent.reduce((sum, w) => sum + w.profit, 0) / recent.length
    : -(s.plan.research + s.plan.marketing + s.plan.quality) / 13 - 5.8;
  return weeklyProfit >= 0 ? Infinity : Math.max(0, s.company.cash / -weeklyProfit);
}
export function addAchievement(s: GameState, key: string, title: string) {
  if (s.achievements.includes(key)) return;
  s.achievements.push(key);
  addEvent(s, { kind: 'milestone', title, detail: '已加入本局企业里程碑。', tone: 'positive' });
}
