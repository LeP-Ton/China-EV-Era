import { describe, expect, it } from 'vitest';
import {
  advanceWeek,
  advanceWeeks,
  allocateDemand,
  applyCommand,
  CONFIG,
  createGame,
  DEFAULT_SEED,
  BRAND_LOGOS,
  DEFAULT_BRAND_LOGO,
  businessFingerprint,
  forecast,
  MODES,
  playerOffer,
  replayGame,
  STRATEGIES,
  unitCostOf,
  type Command,
  type GameState,
  type Strategy,
} from './index';
import { parseGame, serializeGame } from '../persistence';
import { updateQuality } from './quality';

const options = {
  name: '测试汽车',
  brand: '测试',
  model: '测试 ONE',
  strategy: 'technology' as Strategy,
  seed: 'TEST-2026',
};
const fresh = (strategy: Strategy = 'technology', seed = 'TEST-2026') =>
  createGame({ ...options, strategy, seed });
function act(s: GameState, action: Command): GameState {
  const result = applyCommand(s, action);
  expect(result.ok, result.message).toBe(true);
  return result.state;
}
function until(s: GameState, condition: (state: GameState) => boolean, limit = 156): GameState {
  while (!condition(s) && s.status === 'active' && s.week < limit) s = advanceWeek(s);
  return s;
}
function riskyLaunch(): GameState {
  let s = fresh('value', 'RISK-2026');
  s = act(s, { type: 'executive', id: 'cto', autonomous: false });
  s = act(s, { type: 'executive', id: 'coo', autonomous: false, goal: 'growth' });
  s = act(s, { type: 'plan', values: { research: 180, quality: 0, productionTarget: 16900 } });
  s = act(s, { type: 'supplier', supplier: 'unverified' });
  s = act(s, { type: 'develop', mode: 'rushed' });
  s = until(s, (state) => state.product.status === 'ready', 40);
  expect(s.product.status).toBe('ready');
  return act(s, { type: 'launch' });
}
const incidentState = () => until(riskyLaunch(), (s) => s.cases.length > 0, 100);

describe('确定性、纯函数与存档', () => {
  it('相同种子与决策生成完全相同的结果，并且不修改输入', () => {
    const original = fresh();
    const before = serializeGame(original);
    const route = (s: GameState) =>
      advanceWeeks(
        act(act(s, { type: 'develop', mode: 'investment' }), {
          type: 'plan',
          values: { research: 150, marketing: 60 },
        }),
        100,
        { stopOnEvent: false },
      );
    expect(route(original)).toEqual(route(fresh()));
    expect(serializeGame(original)).toBe(before);
    expect(route(fresh('technology', 'ANOTHER-SEED')).weekly).not.toEqual(route(original).weekly);
  });
  it('存档保留随机数内部状态，读档后后续 90 周完全一致', () => {
    const s = advanceWeeks(riskyLaunch(), 25, { stopOnEvent: false });
    const restored = parseGame(serializeGame(s));
    expect(restored).toEqual(s);
    expect(advanceWeeks(restored, 90, { stopOnEvent: false })).toEqual(
      advanceWeeks(s, 90, { stopOnEvent: false }),
    );
  });
  it('更名后的默认种子生效，两版旧默认种子存档仍可确定性复盘', () => {
    expect(createGame({ ...options, seed: '  ' }).seed).toBe(DEFAULT_SEED);
    for (const seed of ['GAMEX-2026', 'EV-ERA-2026']) {
      const legacy = advanceWeeks(fresh('technology', seed), 26, {
        stopOnEvent: false,
      });
      legacy.setup.seed = '  ';
      const restored = parseGame(serializeGame(legacy));
      expect(restored.seed).toBe(seed);
      expect(replayGame(restored).verified).toBe(true);
    }
  });
  it('车标随存档保存且不改变经营模拟或复盘', () => {
    const baseline = businessFingerprint(advanceWeeks(fresh(), 26, { stopOnEvent: false }));
    for (const logo of BRAND_LOGOS) {
      const saved = parseGame(serializeGame(createGame({ ...options, logo: logo.id })));
      expect(saved.setup.logo).toBe(logo.id);
      const progressed = advanceWeeks(saved, 26, { stopOnEvent: false });
      expect(businessFingerprint(progressed)).toBe(baseline);
      expect(replayGame(progressed).verified).toBe(true);
    }
  });
  it('旧存档补默认车标，非法车标不能导入', () => {
    const legacy = advanceWeeks(fresh(), 13, { stopOnEvent: false });
    delete legacy.setup.logo;
    const restored = parseGame(serializeGame(legacy));
    expect(restored.setup.logo).toBe(DEFAULT_BRAND_LOGO);
    expect(businessFingerprint(restored)).toBe(businessFingerprint(legacy));
    expect(replayGame(restored).verified).toBe(true);
    for (const logo of ['unknown', null, { id: 'spark' }]) {
      const invalid = fresh();
      (invalid.setup as unknown as Record<string, unknown>).logo = logo;
      expect(() => parseGame(serializeGame(invalid))).toThrow(/无效状态/);
    }
  });
  it('拒绝损坏、缺失嵌套字段与版本不兼容存档', async () => {
    expect(() => parseGame('oops')).toThrow();
    const envelope = JSON.parse(serializeGame(fresh()));
    envelope.version = 2;
    expect(() => parseGame(JSON.stringify(envelope))).toThrow(/版本/);
    const data = JSON.parse(serializeGame(fresh()));
    data.data = data.data.replace('测试汽车', '修改汽车');
    expect(() => parseGame(JSON.stringify(data))).toThrow(/完整性/);
    const malformed = fresh();
    (malformed.tech as unknown as Record<string, unknown>).battery = {};
    expect(() => parseGame(serializeGame(malformed))).toThrow(/必要数据/);
    const invalidTarget = fresh();
    (invalidTarget.messages[0] as unknown as { target: string }).target = 'unknown';
    expect(() => parseGame(serializeGame(invalidTarget))).toThrow(/无效状态/);
  });
  it('从完整决策记录重新演算，经营事实与财务流水一致', () => {
    let s = riskyLaunch();
    s = advanceWeeks(s, 18, { stopOnEvent: false });
    s = act(s, { type: 'loan', amount: 200 });
    s = act(s, { type: 'plan', values: { quality: 45, marketing: 52 } });
    s = advanceWeeks(s, 40, { stopOnEvent: false });
    expect(replayGame(s).verified).toBe(true);
  });
});

describe('研发、策略与自主高管', () => {
  it('持续增加研发投入会加速工程并增加技术积累，同时实际增加费用', () => {
    const route = (budget: number) => {
      let s = act(fresh(), { type: 'executive', id: 'cto', autonomous: false });
      s = act(s, { type: 'plan', values: { research: budget } });
      return advanceWeeks(act(s, { type: 'develop', mode: 'standard' }), 10, {
        stopOnEvent: false,
      });
    };
    const low = route(60),
      high = route(240);
    expect(high.product.progress).toBeGreaterThan(low.product.progress);
    expect(high.tech.battery.progress).toBeGreaterThan(low.tech.battery.progress);
    expect(high.period.research).toBeGreaterThan(low.period.research);
    expect(high.company.cash).toBeLessThan(low.company.cash);
  });
  it('成熟平台、增配团队与压缩验证产生不同的速度和可靠性代价', () => {
    const route = (mode: keyof typeof MODES) => {
      let s = act(fresh(), { type: 'executive', id: 'cto', autonomous: false });
      s = act(s, { type: 'develop', mode });
      return until(s, (state) => state.product.status === 'ready', 60);
    };
    const normal = route('standard'),
      platform = route('supplier'),
      funded = route('investment'),
      rushed = route('rushed');
    expect(platform.week).toBeLessThan(normal.week);
    expect(funded.week).toBeLessThan(normal.week);
    expect(platform.product.validation).toBeGreaterThan(90);
    expect(rushed.product.validation).toBeLessThan(60);
    expect(rushed.week).toBeLessThan(funded.week);
    expect(funded.period.research).toBeGreaterThan(rushed.period.research);
  });
  it('长期不亲自介入，团队也能完成研发、上市、生产与盈利', () => {
    const s = advanceWeeks(fresh('quality'), 156, { stopOnEvent: false });
    expect(s.status).toBe('completed');
    expect(s.reports).toHaveLength(12);
    expect(s.product.status).toBe('selling');
    expect(s.product.totalDelivered).toBeGreaterThan(20000);
    expect(s.company.totalRevenue).toBeGreaterThan(1000);
    expect(s.company.totalProfit).toBeGreaterThan(0);
    expect(s.decisions).toHaveLength(0);
    expect(s.history.some((e) => e.kind === 'npc' && e.title.includes('立项'))).toBe(true);
  });
  it('调整授权与部门目标会改变真实执行，拒绝建议有短期后果', () => {
    const original = fresh();
    const held = act(original, { type: 'defer', messageId: 'welcome' });
    expect(advanceWeeks(held, 3, { stopOnEvent: false }).product.status).toBe('draft');
    expect(advanceWeeks(original, 3, { stopOnEvent: false }).product.status).toBe('developing');
    const off = act(original, { type: 'executive', id: 'cto', autonomous: false });
    expect(advanceWeeks(off, 5, { stopOnEvent: false }).product.status).toBe('draft');
  });
  it('低价路线获得更高销量，高端路线有更高单车价值', () => {
    const low = advanceWeeks(fresh('value'), 156, { stopOnEvent: false });
    const premium = advanceWeeks(fresh('premium'), 156, { stopOnEvent: false });
    expect(low.product.totalDelivered).toBeGreaterThan(premium.product.totalDelivered);
    expect(premium.company.totalRevenue / premium.product.totalDelivered).toBeGreaterThan(
      low.company.totalRevenue / low.product.totalDelivered,
    );
    expect(low.status).toBe('completed');
    expect(premium.status).toBe('completed');
  });
  it.each(Object.keys(STRATEGIES) as Strategy[])(
    '%s 路线可在不同种子下完成 12 季度，数值保持有限',
    (strategy) => {
      for (const seed of ['BALANCE-A', 'BALANCE-B', 'BALANCE-C']) {
        const s = advanceWeeks(fresh(strategy, seed), 156, { stopOnEvent: false });
        expect(s.status).toBe('completed');
        expect(s.company.cash).toBeGreaterThan(0);
        expect(s.product.totalDelivered).toBeGreaterThan(0);
        expect(s.company.totalProfit).toBeGreaterThan(0);
        expect(s.company.reputation).toBeGreaterThanOrEqual(0);
        expect(s.company.reputation).toBeLessThanOrEqual(100);
        expect(s.weekly.every((w) => Object.values(w).every(Number.isFinite))).toBe(true);
      }
    },
  );
});

describe('消费者选择、竞争和交付', () => {
  it('市场需求守恒，降价增加需求，营销边际收益递减', () => {
    const s = fresh();
    const offer = playerOffer(s);
    const compute = (changes: Partial<typeof offer>) =>
      allocateDemand(
        [{ ...offer, ...changes }, ...s.rivals.map((r) => ({ ...r, id: r.id, wait: 0 }))],
        10000,
      );
    const regular = compute({}),
      cheap = compute({ price: offer.price * 0.85 });
    expect(cheap.orders.player).toBeGreaterThan(regular.orders.player);
    expect(Object.values(regular.orders).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(10000);
    expect(Object.values(regular.shares).reduce((a, b) => a + b, regular.outsideShare)).toBeCloseTo(
      1,
      10,
    );
    const a = compute({ marketing: 3 }),
      b = compute({ marketing: 6 }),
      c = compute({ marketing: 9 });
    expect(b.orders.player - a.orders.player).toBeGreaterThan(c.orders.player - b.orders.player);
  });
  it('价格战降低玩家订单预测，对手调价会影响实际市场', () => {
    const s = advanceWeeks(fresh('marketing'), 52, { stopOnEvent: false });
    const war = structuredClone(s);
    war.rivals.forEach((r) => {
      r.price = Math.max(r.unitCost * 1.01, r.price * 0.65);
    });
    expect(forecast(war).orders.player).toBeLessThan(forecast(s).orders.player);
    expect(advanceWeek(war).weekly.at(-1)!.orders).toBeLessThan(
      advanceWeek(s).weekly.at(-1)!.orders,
    );
    const competitor = advanceWeeks(fresh(), 100, { stopOnEvent: false }).rivals[0];
    expect(competitor.price).toBeLessThan(fresh().rivals[0].price);
    expect(competitor.totalDelivered).toBeGreaterThan(0);
    expect(competitor.cash).not.toBe(fresh().rivals[0].cash);
  });
  it('订单、退订、交付、库存和批次数量保持守恒', () => {
    const s = advanceWeeks(fresh('marketing'), 100, { stopOnEvent: false });
    expect(s.product.totalOrders).toBe(
      s.product.totalCanceled + s.product.backlog + s.product.totalDelivered,
    );
    expect(s.batches.reduce((sum, b) => sum + b.units - b.delivered, 0)).toBe(s.product.inventory);
    expect(s.batches.reduce((sum, b) => sum + b.delivered, 0)).toBe(s.product.totalDelivered);
    expect(s.weekly.every((w) => w.produced <= s.manufacturing.capacity)).toBe(true);
    expect(s.product.backlog).toBeGreaterThan(0);
  });
  it('产能投资需要资金和施工时间，效率改善不会降低质量投入', () => {
    const initial = fresh('premium');
    const expanded = act(initial, { type: 'expand', owned: true });
    expect(expanded.company.cash).toBe(initial.company.cash - CONFIG.factoryCost);
    expect(expanded.company.totalProfit).toBe(0);
    expect(advanceWeeks(expanded, 12, { stopOnEvent: false }).manufacturing.owned).toBe(false);
    const built = advanceWeeks(expanded, 13, { stopOnEvent: false });
    expect(built.manufacturing.capacity).toBe(
      initial.manufacturing.capacity + CONFIG.factoryCapacity,
    );
    expect(unitCostOf(built)).toBeLessThan(unitCostOf(initial));
    expect(built.plan.quality).toBe(initial.plan.quality);
  });
});

describe('注意力、质量债、舆论与召回', () => {
  it('普通战略与浏览不消耗注意力，专项消耗有限资源并按月刷新', () => {
    let s = act(fresh(), { type: 'plan', values: { research: 150 } });
    s = act(s, { type: 'read', messageId: 'welcome' });
    expect(s.attention.available).toBe(10);
    s = act(s, { type: 'focus', area: 'research' });
    expect(s.attention.available).toBe(8);
    expect(applyCommand(s, { type: 'focus', area: 'research' }).ok).toBe(false);
    for (let i = 0; i < 8; i++) s = act(s, { type: 'requestReport', messageId: 'welcome' });
    expect(s.attention.available).toBe(0);
    expect(applyCommand(s, { type: 'press' }).ok).toBe(false);
    s = advanceWeeks(s, 4, { stopOnEvent: false });
    expect(s.attention.available).toBe(10);
    expect(s.attention.spent).toBe(10);
  });
  it('频繁但合理的 CEO 专项能改变工程效率，存在注意力代价', () => {
    const baseline = act(fresh(), { type: 'develop', mode: 'standard' });
    const focused = act(baseline, { type: 'focus', area: 'research' });
    const normal = advanceWeeks(baseline, 3, { stopOnEvent: false }),
      improved = advanceWeeks(focused, 3, { stopOnEvent: false });
    expect(improved.product.progress).toBeGreaterThan(normal.product.progress);
    expect(improved.product.validation).toBeGreaterThan(normal.product.validation);
    expect(improved.attention.available).toBe(8);
    expect(improved.attention.spent).toBe(2);
  });
  it('速成车型在使用一段时间后产生可追溯质量问题，稳健方案风险更低', () => {
    const launched = riskyLaunch();
    expect(launched.cases).toHaveLength(0);
    const s = until(launched, (state) => state.cases.length > 0, 100);
    expect(s.cases).toHaveLength(1);
    expect(s.week).toBeGreaterThan((s.product.launchWeek ?? 0) + 7);
    expect(s.cases[0].batchIds.length).toBeGreaterThan(0);
    expect(s.cases[0].complaints).toBeGreaterThanOrEqual(8);
    expect(s.batches[0].source.validation).toBeLessThan(60);
    expect(s.batches[0].source.supplier).toBe('unverified');
    const safe = advanceWeeks(fresh('quality'), 100, { stopOnEvent: false });
    expect(safe.batches[0].defectRate).toBeLessThan(s.batches[0].defectRate);
    expect(safe.cases.length).toBeLessThan(s.cases.length);
  });
  it('耐久风险按实际交付车龄暴露，不能把库存时间当作车主使用时间', () => {
    const s = riskyLaunch();
    s.week = 70;
    s.product.totalDelivered = 1000;
    s.batches = [
      {
        id: 'age-test',
        week: 1,
        units: 1000,
        delivered: 1000,
        unitCost: 0.1,
        deliveries: [{ week: 70, units: 1000 }],
        defectRate: 0.1,
        latency: 8,
        complaints: 0,
        repaired: false,
        source: {
          validation: 44,
          supplier: 'unverified',
          qualityBudget: 0,
          ramp: 1,
          mode: 'rushed',
        },
      },
    ];
    updateQuality(s);
    expect(s.batches[0].complaints).toBe(0);
    expect(s.cases).toHaveLength(0);
    s.week = 85;
    updateQuality(s);
    expect(s.batches[0].complaints).toBeGreaterThan(0);
    expect(s.cases).toHaveLength(1);
  });
  it('忽略预警会损害声誉并暂停交付；公关不改变事实与缺陷', () => {
    const start = incidentState();
    expect(start.cases).toHaveLength(1);
    const published = act(start, { type: 'press' });
    expect(published.batches).toEqual(start.batches);
    expect(published.cases[0].severity).toBe(start.cases[0].severity);
    const ignored = advanceWeeks(start, 8, { stopOnEvent: false });
    expect(ignored.product.halted).toBe(true);
    expect(ignored.cases[0].status).not.toBe('closed');
    expect(ignored.company.reputation).toBeLessThan(start.company.reputation);
    expect(ignored.weekly.at(-1)!.delivered).toBe(0);
    expect(ignored.period.aftersales).toBeGreaterThan(0);
    expect(ignored.topics.find((t) => t.caseId === start.cases[0].id)!.heat).toBeGreaterThan(
      start.topics[0].heat,
    );
  });
  it('调查、报告和召回真实消耗资金，修复关联批次并改变未来质量与订单', () => {
    const start = incidentState();
    const id = start.cases[0].id;
    let s = act(start, { type: 'investigate', caseId: id });
    expect(s.cases[0].evidence).toBe(95);
    expect(s.cases[0].findings.some((f) => f.includes('验证'))).toBe(true);
    s = act(s, { type: 'report', caseId: id });
    const cash = s.company.cash;
    s = act(s, { type: 'recall', caseId: id });
    expect(s.company.cash).toBeLessThan(cash);
    expect(s.cases[0].status).toBe('closed');
    expect(s.cases[0].reported).toBe(true);
    expect(s.cases[0].recalled).toBeGreaterThan(0);
    expect(s.batches.filter((b) => b.delivered > 0).every((b) => b.repaired)).toBe(true);
    expect(s.manufacturing.supplier).toBe('established');
    s = act(s, { type: 'halt', value: false });
    const future = advanceWeeks(s, 6, { stopOnEvent: false }),
      ignored = advanceWeeks(start, 6, { stopOnEvent: false });
    expect(future.product.totalDelivered).toBeGreaterThan(ignored.product.totalDelivered);
    expect(future.company.reputation).toBeGreaterThan(ignored.company.reputation);
  });
  it('运营高管可在无人干预时调查和召回，不占用 CEO 注意力', () => {
    let s = incidentState();
    s = act(s, { type: 'executive', id: 'coo', autonomous: true, goal: 'reliability' });
    const spent = s.attention.spent;
    const result = advanceWeeks(s, 8, { stopOnEvent: false });
    expect(result.cases[0].status).toBe('closed');
    expect(result.attention.spent).toBe(spent);
    expect(result.history.some((e) => e.kind === 'npc' && e.title.includes('召回'))).toBe(true);
    const paused = act(result, { type: 'halt', value: true });
    expect(advanceWeek(paused).product.halted).toBe(true);
  });
});

describe('财务、资本与时间边界', () => {
  it('现金、利润、库存与季度报表可以逐笔对账', () => {
    let s = act(fresh('premium'), { type: 'equity', amount: 300 });
    s = act(s, { type: 'loan', amount: 300 });
    s = act(s, { type: 'expand', owned: false });
    s = advanceWeeks(s, 13, { stopOnEvent: false });
    s = act(s, { type: 'repay', amount: 100 });
    s = advanceWeeks(s, 143, { stopOnEvent: false });
    expect(s.company.cash).toBeCloseTo(
      s.company.initialCash + s.transactions.reduce((sum, t) => sum + t.cashDelta, 0),
      4,
    );
    expect(s.company.totalProfit).toBeCloseTo(
      s.transactions.reduce((sum, t) => sum + t.profitDelta, 0),
      4,
    );
    expect(s.reports.reduce((sum, r) => sum + r.profit, 0)).toBeCloseTo(s.company.totalProfit, 4);
    const inventory = s.batches.reduce((sum, b) => sum + (b.units - b.delivered) * b.unitCost, 0);
    expect(s.reports.reduce((sum, r) => sum + r.productionCash - r.cogs, 0)).toBeCloseTo(
      inventory,
      3,
    );
    expect(s.reports[0].financing).toBe(600);
    expect(s.reports[1].financing).toBe(-100);
  });
  it('融资不增加营业收入或利润，股权融资会稀释股份且有间隔', () => {
    let s = fresh();
    const equity = act(s, { type: 'equity', amount: 300 });
    expect(equity.company.cash).toBe(s.company.cash + 300);
    expect(equity.company.ownership).toBeLessThan(1);
    expect(equity.company.totalProfit).toBe(0);
    expect(equity.period.revenue).toBe(0);
    expect(applyCommand(equity, { type: 'equity', amount: 300 }).ok).toBe(false);
    s = act(equity, { type: 'loan', amount: 500 });
    s = act(s, { type: 'loan', amount: 500 });
    expect(applyCommand(s, { type: 'loan', amount: 100 }).ok).toBe(false);
  });
  it('忽略现金风险且无交付会真实破产，结束后不能继续支出或时间', () => {
    let s = act(fresh(), { type: 'executive', id: 'cfo', autonomous: false });
    s = act(s, {
      type: 'plan',
      values: { research: 360, marketing: 260, quality: 150, productionTarget: 0 },
    });
    s = advanceWeeks(s, 156, { stopOnEvent: false });
    expect(s.status).toBe('bankrupt');
    expect(s.company.cash).toBeLessThan(0);
    expect(s.week).toBeLessThan(52);
    expect(advanceWeek(s)).toBe(s);
    expect(applyCommand(s, { type: 'loan', amount: 100 }).ok).toBe(false);
  });
  it('重大事件和季度边界暂停，156 周后完整结算且不再推进', () => {
    const quarter = advanceWeeks(fresh('quality'), 156, {
      stopOnEvent: false,
      stopAtQuarter: true,
    });
    expect(quarter.week).toBe(13);
    expect(quarter.reports).toHaveLength(1);
    const ready = advanceWeeks(fresh(), 100);
    expect(ready.pause).not.toBeNull();
    expect(ready.product.status).toBe('ready');
    const end = advanceWeeks(quarter, 200, { stopOnEvent: false });
    expect(end.week).toBe(156);
    expect(end.reports).toHaveLength(12);
    expect(advanceWeek(end)).toBe(end);
  });
});
