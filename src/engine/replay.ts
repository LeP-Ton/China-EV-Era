import { applyCommand } from './commands';
import { currentPeriod } from './internals';
import { hashSeed } from './random';
import { advanceWeeks } from './simulation';
import { createGame } from './state';
import type { GameState } from './types';

export function businessFingerprint(s: GameState): string {
  // 阅读状态和暂停提示属于交互信息，不影响经营复盘的事实校验。
  return hashSeed(
    JSON.stringify({
      week: s.week,
      status: s.status,
      rng: s.rng,
      company: s.company,
      plan: s.plan,
      product: s.product,
      tech: s.tech,
      executives: s.executives,
      rivals: s.rivals,
      manufacturing: s.manufacturing,
      attention: s.attention,
      focus: s.focus,
      batches: s.batches,
      cases: s.cases,
      topics: s.topics,
      reports: s.reports,
      weekly: s.weekly,
      period: currentPeriod(s),
      transactions: s.transactions,
    }),
  )
    .toString(16)
    .padStart(8, '0');
}

export function replayGame(s: GameState): {
  verified: boolean;
  fingerprint: string;
  state: GameState;
} {
  let replay = createGame(s.setup);
  for (const decision of s.decisions) {
    replay = advanceWeeks(replay, decision.week - replay.week, { stopOnEvent: false });
    const result = applyCommand(replay, decision.action);
    if (!result.ok) throw new Error(`第 ${decision.week} 周决策无法复盘：${result.message}`);
    replay = result.state;
  }
  replay = advanceWeeks(replay, s.week - replay.week, { stopOnEvent: false });
  const fingerprint = businessFingerprint(replay);
  return { verified: fingerprint === businessFingerprint(s), fingerprint, state: replay };
}
