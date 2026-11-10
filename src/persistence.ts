import { createGame, type GameState, type Strategy } from './engine';
import { hashSeed } from './engine/random';

// 存档键与文件格式属于持久化协议，保留旧标识以兼容改名前的进度、快照与排行。
export const SAVE_KEYS = {
  auto: 'gamex-nev-v1-auto',
  manual: 'gamex-nev-v1-manual',
  rankings: 'gamex-nev-v1-rankings',
};
const template = createGame({
  name: '校验',
  brand: '校验',
  model: '校验',
  strategy: 'quality',
  seed: 'validation',
});
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function matches(value: unknown, example: unknown): boolean {
  if (example === null)
    return value === null || (typeof value === 'number' && Number.isFinite(value));
  if (typeof example === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (typeof example === 'string' || typeof example === 'boolean')
    return typeof value === typeof example;
  if (Array.isArray(example))
    return (
      Array.isArray(value) &&
      value.length < 50000 &&
      (example.length === 0 || value.every((item) => matches(item, example[0])))
    );
  if (object(example))
    return (
      object(value) &&
      Object.entries(example).every(([key, entry]) => key in value && matches(value[key], entry))
    );
  return false;
}

function validState(value: unknown): value is GameState {
  if (!object(value)) return false;
  const pause = value.pause;
  const base = { ...value, pause: null };
  if (!matches(base, template)) return false;
  const s = value as unknown as GameState;
  const strategies = ['technology', 'value', 'premium', 'marketing', 'quality'];
  const modules = ['dashboard', 'research', 'production', 'finance', 'market', 'office'];
  const suppliers = ['established', 'premium', 'unverified'];
  const modes = ['standard', 'investment', 'supplier', 'lean', 'rushed'];
  if (
    s.version !== 1 ||
    !Number.isInteger(s.week) ||
    s.week < 0 ||
    s.week > 156 ||
    !Number.isInteger(s.rng) ||
    s.rng < 0 ||
    s.rng > 0xffffffff ||
    !Number.isInteger(s.nextId) ||
    s.nextId < 1
  )
    return false;
  if (
    !['active', 'completed', 'bankrupt'].includes(s.status) ||
    !['draft', 'developing', 'ready', 'selling'].includes(s.product.status)
  )
    return false;
  if (
    !['technology', 'value', 'premium', 'marketing', 'quality'].includes(s.company.strategy) ||
    !['battery', 'driving', 'safety'].includes(s.plan.techFocus)
  )
    return false;
  if (
    !['established', 'premium', 'unverified'].includes(s.manufacturing.supplier) ||
    !['standard', 'investment', 'supplier', 'lean', 'rushed'].includes(s.product.mode)
  )
    return false;
  if (
    s.executives.length !== 3 ||
    new Set(s.executives.map((e) => e.id)).size !== 3 ||
    s.executives.some(
      (e) =>
        !['cto', 'cfo', 'coo'].includes(e.id) ||
        !['balanced', 'growth', 'reliability'].includes(e.goal),
    )
  )
    return false;
  if (
    s.product.inventory < 0 ||
    s.product.backlog < 0 ||
    s.company.debt < 0 ||
    s.company.ownership <= 0 ||
    s.company.ownership > 1 ||
    s.attention.available < 0 ||
    s.attention.available > 10
  )
    return false;
  if (pause !== null && !matches(pause, { title: '', detail: '', target: '' })) return false;
  if (
    (s.pause && !modules.includes(s.pause.target)) ||
    s.messages.some((m) => !modules.includes(m.target))
  )
    return false;
  if (
    !strategies.includes(s.setup.strategy) ||
    s.rivals.some((r) => !strategies.includes(r.strategy) || r.capacity <= 0)
  )
    return false;
  if (
    !['none', 'manual', 'safety', 'recall'].includes(s.product.haltReason) ||
    !['轿车', 'SUV', 'MPV'].includes(s.product.type) ||
    !['economy', 'mainstream', 'premium'].includes(s.product.segment) ||
    !['LFP', 'NMC'].includes(s.product.battery)
  )
    return false;
  if (
    s.manufacturing.capacity <= 0 ||
    s.product.price < 0.09 ||
    s.product.price > 0.7 ||
    s.plan.research < 0 ||
    s.plan.research > 360 ||
    s.plan.quality < 0 ||
    s.plan.quality > 150 ||
    s.plan.marketing < 0 ||
    s.plan.marketing > 260 ||
    s.plan.productionTarget < 0 ||
    s.plan.productionTarget > 80000
  )
    return false;
  if (
    Object.values(s.tech).some(
      (t) =>
        !Number.isInteger(t.level) ||
        t.level < 0 ||
        t.level > 3 ||
        t.progress < 0 ||
        t.progress > 100,
    )
  )
    return false;
  if (
    s.weekly.length !== s.week ||
    s.reports.length !== Math.floor(s.week / 13) ||
    (s.status === 'completed' && s.week !== 156) ||
    (s.status === 'active' && s.week >= 156)
  )
    return false;
  const shapes: Record<string, unknown> = {
    batches: {
      id: '',
      week: 0,
      units: 0,
      delivered: 0,
      unitCost: 0,
      deliveries: [{ week: 0, units: 0 }],
      defectRate: 0,
      latency: 0,
      complaints: 0,
      repaired: false,
      source: { validation: 0, supplier: '', qualityBudget: 0, ramp: 0, mode: '' },
    },
    cases: {
      id: '',
      title: '',
      batchIds: [''],
      openedWeek: 0,
      investigatedWeek: null,
      status: '',
      severity: 0,
      evidence: 0,
      complaints: 0,
      reported: false,
      recalled: 0,
      findings: [''],
    },
    transactions: {
      id: '',
      week: 0,
      category: '',
      label: '',
      cashDelta: 0,
      profitDelta: 0,
      balance: 0,
    },
    decisions: { week: 0, action: { type: '' } },
    weekly: {
      week: 0,
      cash: 0,
      revenue: 0,
      profit: 0,
      delivered: 0,
      produced: 0,
      orders: 0,
      canceled: 0,
      backlog: 0,
      inventory: 0,
      share: 0,
      reputation: 0,
      valuation: 0,
      complaints: 0,
      potentialDemand: 0,
    },
    reports: {
      ...template.period,
      quarter: 0,
      cash: 0,
      debt: 0,
      share: 0,
      reputation: 0,
      valuation: 0,
      inventory: 0,
      causes: [''],
    },
  };
  for (const [key, shape] of Object.entries(shapes))
    if (!(s[key as keyof GameState] as unknown[]).every((item) => matches(item, shape)))
      return false;
  if (
    s.batches.some(
      (b) =>
        !suppliers.includes(b.source.supplier) ||
        !modes.includes(b.source.mode) ||
        b.units < b.delivered ||
        b.delivered < 0 ||
        b.defectRate < 0 ||
        b.defectRate > 1 ||
        b.deliveries.reduce((sum, d) => sum + d.units, 0) !== b.delivered ||
        b.deliveries.some((d) => d.week < b.week || d.week > s.week || d.units < 0),
    )
  )
    return false;
  if (s.cases.some((c) => !['warning', 'investigating', 'closed'].includes(c.status))) return false;
  if (
    !s.manufacturing.expansions.every((e) =>
      matches(e, { id: '', remaining: 0, capacity: 0, owned: false }),
    )
  )
    return false;
  return Object.values(s.market.shares).every((v) => typeof v === 'number' && Number.isFinite(v));
}

export function serializeGame(state: GameState): string {
  const data = JSON.stringify(state);
  return JSON.stringify({ format: 'gamex-nev', version: 1, checksum: hashSeed(data), data });
}

export function parseGame(text: string): GameState {
  if (text.length > 12_000_000) throw new Error('存档过大，请选择本游戏导出的存档。');
  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error('存档不是有效的 JSON 文件。');
  }
  if (
    !object(envelope) ||
    envelope.format !== 'gamex-nev' ||
    envelope.version !== 1 ||
    typeof envelope.data !== 'string' ||
    hashSeed(envelope.data) !== envelope.checksum
  )
    throw new Error('存档版本不兼容或完整性校验失败，原进度未被覆盖。');
  let state: unknown;
  try {
    state = JSON.parse(envelope.data);
  } catch {
    throw new Error('存档内容损坏。');
  }
  if (!validState(state)) throw new Error('存档缺少必要数据或包含无效状态，原进度未被覆盖。');
  return state;
}

export function saveLocal(state: GameState, slot: 'auto' | 'manual') {
  localStorage.setItem(SAVE_KEYS[slot], serializeGame(state));
}
export function loadLocal(slot: 'auto' | 'manual'): GameState | null {
  const text = localStorage.getItem(SAVE_KEYS[slot]);
  return text ? parseGame(text) : null;
}

export interface Ranking {
  id: string;
  name: string;
  seed: string;
  strategy: Strategy;
  weeks: number;
  valuation: number;
  profit: number;
  delivered: number;
  share: number;
  tech: number;
  reputation: number;
  incidents: number;
  completed: boolean;
}
export function rankingOf(s: GameState): Ranking {
  return {
    id: `${s.seed}-${s.company.name}-${s.company.strategy}-${hashSeed(JSON.stringify(s.decisions))}`,
    name: s.company.name,
    seed: s.seed,
    strategy: s.company.strategy,
    weeks: s.week,
    valuation: s.company.peakValuation,
    profit: s.company.totalProfit,
    delivered: s.product.totalDelivered,
    share: s.weekly.at(-1)?.share ?? 0,
    tech: Object.values(s.tech).reduce((sum, t) => sum + t.level, 0),
    reputation: s.company.reputation,
    incidents: s.cases.length,
    completed: s.status === 'completed',
  };
}
export function loadRankings(): Ranking[] {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(SAVE_KEYS.rankings) ?? '[]');
    return Array.isArray(entries)
      ? entries
          .filter(
            (v) =>
              matches(v, rankingOf(template)) &&
              ['technology', 'value', 'premium', 'marketing', 'quality'].includes(v.strategy),
          )
          .slice(0, 30)
      : [];
  } catch {
    return [];
  }
}
export function recordRanking(s: GameState) {
  const rank = rankingOf(s);
  const entries = loadRankings().filter((r) => r.id !== rank.id);
  localStorage.setItem(SAVE_KEYS.rankings, JSON.stringify([rank, ...entries].slice(0, 30)));
}
