import { CONFIG, MODES, SUPPLIERS, TECH_NAMES } from './config';
import { borrow, launchModel, startProject } from './commands';
import {
  addAchievement,
  addEvent,
  cashRunway,
  ensurePeriod,
  expense,
  nextId,
  send,
  transaction,
} from './internals';
import { allocateDemand, offersOf, unitCostOf } from './market';
import { clamp, randomStep, round } from './random';
import { updateQuality } from './quality';
import { monthAt } from './state';
import type { GameState, WeeklyRecord } from './types';

function draw(s: GameState): number {
  const result = randomStep(s.rng);
  s.rng = result.state;
  return result.value;
}

function departments(s: GameState) {
  const cto = s.executives.find((e) => e.id === 'cto')!;
  const cfo = s.executives.find((e) => e.id === 'cfo')!;
  const coo = s.executives.find((e) => e.id === 'coo')!;
  if (
    cto.autonomous &&
    s.week >= cto.holdUntil &&
    s.product.status === 'draft' &&
    s.week >= 2 &&
    s.company.cash > 200
  ) {
    startProject(s, cto.goal === 'growth' ? 'investment' : 'standard', true);
    cto.lastAction = '根据产品目标自主启动首款车型研发。';
    send(s, {
      from: cto.name,
      role: cto.title,
      title: '首款车型已由研发团队立项',
      body: '根据既定配置和部门目标，研发团队已开始样车工程；您可继续调整预算，日常工作将按周自主推进。',
      target: 'research',
      tone: 'info',
    });
  }
  const liquidityThreshold =
    6 +
    cfo.management / 35 -
    cfo.risk / 80 +
    (cfo.goal === 'reliability' ? 2 : cfo.goal === 'growth' ? -1 : 0);
  if (
    cfo.autonomous &&
    s.week >= cfo.holdUntil &&
    cashRunway(s) < liquidityThreshold &&
    s.company.debt < CONFIG.creditLimit &&
    s.week % 4 === 1
  ) {
    const amount = Math.min(
      cfo.goal === 'growth' ? 400 : cfo.goal === 'reliability' ? 200 : 300,
      CONFIG.creditLimit - s.company.debt,
    );
    borrow(s, amount, true);
    cfo.lastAction = `现金跑道接近部门安全阈值，使用 ${(amount / 100).toFixed(2)} 亿元有限授信。`;
    send(s, {
      from: cfo.name,
      role: cfo.title,
      title: '现金跑道不足，已启动有限授信',
      body: `${cfo.lastAction}银行授信总额有限，并将产生利息。建议复核研发、营销及产能投资。`,
      target: 'finance',
      tone: 'warning',
    });
  } else if (s.week % 4 === 1)
    cfo.lastAction =
      cashRunway(s) === Infinity
        ? '经营现金流为正，保留资本支出安全余量。'
        : `按周监控资金，可支撑约 ${cashRunway(s).toFixed(0)} 周。`;
  if (
    coo.autonomous &&
    s.product.haltReason === 'recall' &&
    !s.cases.some((c) => c.status !== 'closed') &&
    s.cases.some(
      (c) =>
        c.status === 'closed' && c.investigatedWeek !== null && s.week > c.investigatedWeek + 2,
    )
  ) {
    s.product.halted = false;
    s.product.haltReason = 'none';
    coo.lastAction = '召回整改经复核，恢复生产与交付。';
    addEvent(s, {
      kind: 'npc',
      title: '运营高管恢复交付',
      detail: coo.lastAction,
      tone: 'positive',
    });
  }
}

function research(s: GameState) {
  const p = s.product;
  const cto = s.executives.find((e) => e.id === 'cto')!;
  const capability =
    (0.65 + cto.expertise / 250) *
    (0.88 + cto.motivation / 750) *
    (0.9 + cto.management / 800) *
    (0.94 + cto.trust / 1400);
  const funding = Math.sqrt(s.plan.research / 90);
  if (p.status === 'developing') {
    const complexity =
      1 +
      (p.batteryCapacity - 60) / 180 +
      (p.driving - 1) * 0.06 +
      (p.segment === 'premium' ? 0.13 : 0);
    const speed =
      ((5.8 * funding * capability * MODES[p.mode].speed) / complexity) *
      (s.focus.research >= s.week ? 1.2 : 1) *
      (cto.goal === 'growth' ? 1.08 : cto.goal === 'reliability' ? 0.94 : 1);
    const actual = Math.min(speed, 100 - p.progress);
    p.progress = clamp(p.progress + speed, 0, 100);
    p.validation = clamp(
      p.validation + actual * MODES[p.mode].validation * (cto.goal === 'reliability' ? 1.08 : 1),
      0,
      100,
    );
    cto.lastAction = `推进${p.name}研发；优先保障${TECH_NAMES[s.plan.techFocus]}。`;
    if (p.progress >= 100) {
      p.status = 'ready';
      p.readyWeek = s.week;
      send(s, {
        from: cto.name,
        role: cto.title,
        title: `${p.name}研发完成，等待上市`,
        body: `当前验证度 ${p.validation.toFixed(0)}%。${p.validation < 70 ? '验证尚不充分，可以继续测试，也可以提前上市并承担延迟质量风险。' : '可以进入上市阶段。'}若保留自主授权，我会根据部门目标完成验证并安排上市。`,
        target: 'research',
        tone: p.validation < 70 ? 'warning' : 'positive',
      });
      addEvent(s, {
        kind: 'npc',
        title: '车型研发完成',
        detail: `历时 ${s.week - (p.startedWeek ?? 0)} 周，验证度 ${p.validation.toFixed(0)}%。`,
        tone: 'positive',
      });
      s.pause = {
        title: '首款车型研发完成',
        detail: '确认验证状态和售价后，即可批准上市。也可继续交给技术高管推进。',
        target: 'research',
      };
    }
  } else if (p.status === 'ready') {
    p.validation = clamp(
      p.validation + 3.4 * funding * (cto.goal === 'reliability' ? 1.3 : 1),
      0,
      100,
    );
    const threshold =
      (cto.goal === 'growth' ? 58 : cto.goal === 'reliability' ? 98 : 86) + (60 - cto.risk) * 0.05;
    if (
      cto.autonomous &&
      s.week >= cto.holdUntil &&
      s.week - (p.readyWeek ?? s.week) >= 2 &&
      p.validation >= threshold &&
      s.company.cash >= CONFIG.launchCost + 20
    ) {
      launchModel(s, true);
      cto.lastAction = `完成验证与上市审批，${p.name}进入销售阶段。`;
      send(s, {
        from: cto.name,
        role: cto.title,
        title: '已按授权完成车型上市',
        body: cto.lastAction,
        target: 'research',
        tone: 'positive',
      });
    }
  }
  const tech = s.tech[s.plan.techFocus];
  if (tech.level < CONFIG.maxTechLevel && s.plan.research > 0) {
    tech.progress += (s.plan.research / 13 / (3.5 + tech.level * 2.2)) * capability;
    if (tech.progress >= 100) {
      tech.level++;
      tech.progress = 0;
      addEvent(s, {
        kind: 'npc',
        title: `${TECH_NAMES[s.plan.techFocus]}突破 Lv.${tech.level}`,
        detail:
          '技术持续积累：电池提升续航与成本效率，智驾提升软件能力，安全技术改善整车可靠性吸引力。',
        tone: 'positive',
      });
      send(s, {
        from: cto.name,
        role: cto.title,
        title: `${TECH_NAMES[s.plan.techFocus]}取得阶段突破`,
        body: `已完成前置研究与连续资金投入，当前 Lv.${tech.level}。能力已应用于车型与市场评价；下一等级需要更长研发周期。`,
        target: 'research',
        tone: 'positive',
      });
    }
  }
}

function rivalDecisions(s: GameState) {
  for (const r of s.rivals.filter((r) => r.active)) {
    if (r.constructionWeeks > 0) {
      r.constructionWeeks--;
      if (r.constructionWeeks === 0) {
        r.capacity += r.pendingCapacity;
        r.pendingCapacity = 0;
        addEvent(s, {
          kind: 'market',
          title: `${r.name}新增产线投产`,
          detail: '投资后经过六周施工，新增产能开始使用并承担固定成本。',
          tone: 'info',
        });
      }
    }
    if (s.week % 13 !== 1) continue;
    if (r.cash < 200) {
      r.marketing = Math.max(1, r.marketing * 0.8);
      r.lastAction = '压缩非必要费用，优先保证交付现金。';
    } else if (
      (r.strategy === 'value' && r.price > r.unitCost * 1.12) ||
      (r.backlog < r.capacity && r.share < 0.18 && r.strategy !== 'premium')
    ) {
      r.price = Math.max(r.unitCost * 1.12, r.price * 0.975);
      r.lastAction = `将售价调整至 ${(r.price * 100).toFixed(2)} 万元，争取价格敏感用户。`;
      s.topics.unshift({
        id: nextId(s, 'topic'),
        title: `${r.model}调价至 ${(r.price * 100).toFixed(2)} 万元`,
        channel: '汽车媒体',
        actor: '市场快讯',
        severity: 0,
        credibility: 100,
        heat: 48,
        sentiment: 0,
        bornWeek: s.week,
      });
    } else if (
      r.backlog > r.capacity * 2 &&
      r.cash > CONFIG.expansionCost + 300 &&
      r.constructionWeeks === 0
    ) {
      r.cash -= CONFIG.expansionCost;
      r.pendingCapacity = CONFIG.expansionCapacity;
      r.constructionWeeks = 6;
      r.lastAction = `投资建设 ${CONFIG.expansionCapacity} 辆周产能，六周后投产。`;
    } else {
      const addition = Math.min(0.45, r.cash / 6000);
      r.marketing = Math.min(10, r.marketing + addition);
      r.lastAction = '增加品牌投入，维持细分用户的产品吸引力。';
    }
    addEvent(s, {
      kind: 'market',
      title: `${r.name}调整经营计划`,
      detail: r.lastAction,
      tone: 'info',
    });
  }
}

function settleRivals(s: GameState, orders: Record<string, number>) {
  for (const r of s.rivals) {
    r.weeklyDelivered = 0;
    if (!r.active) continue;
    const cancel = Math.floor(
      r.backlog * clamp(0.015 + (r.backlog / r.capacity) * 0.018, 0.015, 0.2),
    );
    r.backlog = Math.max(0, r.backlog - cancel + (orders[r.id] ?? 0));
    const researchSpend = Math.min(r.strategy === 'technology' ? 8 : 4, Math.max(0, r.cash / 25));
    const overhead =
      researchSpend +
      r.marketing +
      CONFIG.payroll +
      CONFIG.contractFixed +
      Math.max(0, r.capacity - 800) * 0.0016 +
      (r.debt * CONFIG.annualInterest) / 52;
    const units = Math.max(
      0,
      Math.min(r.capacity, r.backlog, Math.floor((r.cash - overhead) / r.unitCost)),
    );
    r.cash = round(r.cash + units * (r.price - r.unitCost) - overhead);
    r.weeklyDelivered = units;
    r.totalDelivered += units;
    r.backlog -= units;
    r.researchProgress += researchSpend / (3.6 + r.generation * 0.8);
    if (r.researchProgress >= 100 && r.cash >= CONFIG.launchCost) {
      r.cash -= CONFIG.launchCost;
      r.generation++;
      r.researchProgress = 0;
      r.range += 30;
      r.driving = Math.min(5, r.driving + 0.35);
      r.unitCost *= 0.98;
      r.model = `${r.brand} ${r.strategy === 'value' ? 'E' : r.strategy === 'premium' ? 'L' : 'S'}${r.generation + 4}`;
      r.lastAction = `发布${r.model}，续航与软件能力升级；研发来自持续费用投入。`;
      addEvent(s, {
        kind: 'market',
        title: `${r.name}发布换代产品`,
        detail: r.lastAction,
        tone: 'warning',
      });
    }
    if (r.cash < 100 && r.debt < CONFIG.creditLimit) {
      const amount = Math.min(300, CONFIG.creditLimit - r.debt);
      r.cash += amount;
      r.debt += amount;
    }
    if (r.cash < 0) {
      r.active = false;
      r.lastAction = '现金枯竭，退出本轮市场竞争。';
      addEvent(s, {
        kind: 'market',
        title: `${r.name}退出市场`,
        detail: '竞争对手同样受成本、授信和现金约束。',
        tone: 'warning',
      });
    }
  }
}

function produceAndDeliver(s: GameState, newOrders: number) {
  const p = s.product;
  const coo = s.executives.find((e) => e.id === 'coo')!;
  if (p.status !== 'selling') return { produced: 0, delivered: 0, canceled: 0 };
  const wait = p.backlog / Math.max(1, s.manufacturing.capacity);
  const canceled = Math.floor(
    p.backlog * clamp(0.012 + Math.max(0, wait - 1) * 0.025 + (p.halted ? 0.07 : 0), 0.012, 0.28),
  );
  p.backlog = Math.max(0, p.backlog - canceled + newOrders);
  p.totalOrders += newOrders;
  p.totalCanceled += canceled;
  s.period.orders += newOrders;
  s.period.canceled += canceled;
  let produced = 0;
  let delivered = 0;
  if (!p.halted) {
    const cost = unitCostOf(s);
    const execution =
      (coo.autonomous
        ? coo.goal === 'growth'
          ? 1.08
          : coo.goal === 'reliability'
            ? 0.94
            : 1
        : 0.97) *
      (0.9 + coo.management / 900);
    const capacity = Math.floor(
      s.manufacturing.capacity * (s.focus.operations >= s.week ? 1.12 : 1),
    );
    const target = Math.round((s.plan.productionTarget / 13) * execution);
    const operatingReserve =
      (s.plan.research + s.plan.marketing + s.plan.quality) / 13 +
      CONFIG.payroll +
      CONFIG.contractFixed +
      5;
    const affordable = Math.max(0, Math.floor((s.company.cash - operatingReserve) / cost));
    produced = Math.max(
      0,
      Math.min(
        capacity,
        target,
        Math.max(0, p.backlog + Math.round(target * 0.35) - p.inventory),
        affordable,
      ),
    );
    if (produced > 0) {
      const ramp = produced / Math.max(250, s.manufacturing.lastProduced || produced);
      const risk = clamp(
        0.0015 +
          ((100 - p.validation) / 100) * 0.075 +
          SUPPLIERS[s.manufacturing.supplier].risk +
          (Math.max(0, 20 - s.plan.quality) / 20) * 0.025 +
          Math.max(0, ramp - 1.25) * 0.012 -
          s.plan.quality * 0.00008 -
          Math.max(0, coo.expertise - 75) * 0.00006 -
          (p.safety - 75) * 0.00008 -
          s.tech.safety.level * 0.0005 -
          (coo.goal === 'reliability' ? 0.003 : 0),
        0.001,
        0.17,
      );
      s.batches.push({
        id: nextId(s, 'batch'),
        week: s.week,
        units: produced,
        delivered: 0,
        unitCost: cost,
        deliveries: [],
        defectRate: risk,
        latency: 8 + Math.floor(draw(s) * 9) + (risk < 0.02 ? 40 : 0),
        complaints: 0,
        repaired: false,
        source: {
          validation: p.validation,
          supplier: s.manufacturing.supplier,
          qualityBudget: s.plan.quality,
          ramp,
          mode: p.mode,
        },
      });
      p.inventory += produced;
      const productionCash = round(produced * cost);
      s.period.productionCash += productionCash;
      transaction(s, 'inventory', '生产采购：计入库存资产', -productionCash, 0);
    }
    delivered = Math.min(p.backlog, p.inventory, capacity);
    let remaining = delivered;
    let cogs = 0;
    for (const batch of s.batches) {
      const units = Math.min(remaining, batch.units - batch.delivered);
      batch.delivered += units;
      remaining -= units;
      cogs += units * batch.unitCost;
      if (units > 0) batch.deliveries.push({ week: s.week, units });
      if (remaining === 0) break;
    }
    const revenue = round(delivered * p.price);
    cogs = round(cogs);
    s.period.revenue += revenue;
    s.period.cogs += cogs;
    s.period.delivered += delivered;
    s.company.totalRevenue += revenue;
    transaction(s, 'revenue', '汽车实际交付收入', revenue, revenue);
    transaction(s, 'cogs', '交付结转库存成本', 0, -cogs);
    p.inventory -= delivered;
    p.backlog -= delivered;
    p.totalDelivered += delivered;
    coo.lastAction = `交付 ${delivered} 辆，${p.backlog > capacity ? '正在协调交付排期与供应链。' : '同步检查生产批次质量。'}`;
  } else coo.lastAction = '交付暂停；优先执行安全调查与整改。';
  s.manufacturing.lastProduced = produced;
  return { produced, delivered, canceled };
}

function settleExpenses(s: GameState) {
  expense(s, 'research', s.plan.research / 13, '每周研发与技术积累');
  expense(s, 'marketing', s.plan.marketing / 13, '每周市场与渠道推广');
  expense(s, 'quality', s.plan.quality / 13, '每周质量检测投入');
  expense(
    s,
    'payroll',
    CONFIG.payroll *
      (s.product.mode === 'investment' && s.product.status === 'developing' ? 1.25 : 1),
    '研发与管理团队薪酬',
  );
  expense(
    s,
    'fixed',
    CONFIG.contractFixed +
      Math.max(0, s.manufacturing.capacity - 800) * 0.0016 +
      (s.manufacturing.owned ? CONFIG.factoryFixed : 0) +
      s.product.inventory * 0.00016,
    '产能固定成本与库存仓储',
  );
  const rate = CONFIG.annualInterest - (s.focus.finance >= s.week ? 0.008 : 0);
  expense(s, 'interest', (s.company.debt * rate) / 52, '银行贷款周利息');
}

function valuation(s: GameState) {
  const recent = s.weekly.slice(-12);
  const sales = recent.reduce((sum, w) => sum + w.revenue, 0) * 4;
  const profit = recent.reduce((sum, w) => sum + w.profit, 0) * 4;
  const tech = Object.values(s.tech).reduce((sum, t) => sum + t.level, 0);
  const risk = s.cases
    .filter((c) => c.status !== 'closed')
    .reduce((sum, c) => sum + c.severity * 5, 0);
  const old = s.weekly.at(-13)?.delivered ?? 0;
  const current = s.weekly.at(-1)?.delivered ?? 0;
  const growth = old > 0 ? clamp((current - old) / old, -0.4, 0.5) : 0;
  s.company.valuation = round(
    Math.max(
      100,
      sales * (0.7 + growth) +
        Math.max(0, profit) * 7 +
        tech * 160 +
        s.company.reputation * 7 +
        s.company.cash -
        s.company.debt -
        risk,
    ),
  );
  s.company.peakValuation = Math.max(s.company.peakValuation, s.company.valuation);
}

function quarterly(s: GameState) {
  const last = s.weekly.at(-1)!;
  const causes = [
    s.product.status !== 'selling'
      ? '车型尚未销售，研发与团队支出持续消耗现金。'
      : `本季交付 ${s.period.delivered} 辆，单车毛利约 ${((s.product.price - unitCostOf(s)) * 100).toFixed(2)} 万元。`,
    `研发、市场与质量费用合计 ${((s.period.research + s.period.marketing + s.period.quality) / 100).toFixed(2)} 亿元。`,
    s.period.productionCash > s.period.cogs + 1
      ? '采购现金支出高于交付成本，部分现金沉淀在库存中。'
      : '生产采购与交付成本基本匹配。',
    s.period.aftersales > 1
      ? `质量、售后与处置支出 ${(s.period.aftersales / 100).toFixed(2)} 亿元。`
      : '本季未出现重大售后处置支出。',
    s.period.financing > 0
      ? `融资净流入 ${(s.period.financing / 100).toFixed(2)} 亿元，改善现金但不增加经营利润。`
      : '本季未依赖新增外部融资。',
  ];
  s.reports.push({
    ...structuredClone(s.period),
    quarter: s.week / 13,
    cash: s.company.cash,
    debt: s.company.debt,
    share: last.share,
    reputation: s.company.reputation,
    valuation: s.company.valuation,
    inventory: s.product.inventory,
    causes,
  });
  send(s, {
    from: '沈予安',
    role: '首席财务官',
    title: `Q${s.week / 13} 季度经营报告已生成`,
    body: `本季营收 ${(s.period.revenue / 100).toFixed(2)} 亿元，净利润 ${(s.period.profit / 100).toFixed(2)} 亿元。${causes[0]}建议结合现金流和库存调整下季度计划。`,
    target: 'finance',
    tone: s.period.profit >= 0 ? 'positive' : 'warning',
  });
  addEvent(s, {
    kind: 'finance',
    title: `第 ${s.week / 13} 季度结算`,
    detail: `营收 ${(s.period.revenue / 100).toFixed(2)} 亿，净利润 ${(s.period.profit / 100).toFixed(2)} 亿，现金 ${(s.company.cash / 100).toFixed(2)} 亿。`,
    tone: s.period.profit >= 0 ? 'positive' : 'warning',
  });
  if (s.period.profit > 0) addAchievement(s, 'profitable', '首次季度盈利');
}

/** 输入状态不变；无真实时间与外部副作用，支持固定种子回放。 */
export function advanceWeek(original: GameState): GameState {
  if (original.status !== 'active') return original;
  const s = structuredClone(original);
  ensurePeriod(s);
  s.week++;
  s.pause = null;
  const month = monthAt(s.week);
  if (month !== s.attention.month) {
    s.attention.month = month;
    s.attention.available = CONFIG.attentionPerMonth;
  }
  const priorProfit = s.period.profit;
  const priorRevenue = s.period.revenue;
  departments(s);
  research(s);
  for (const expansion of s.manufacturing.expansions) {
    expansion.remaining--;
    if (expansion.remaining === 0) {
      s.manufacturing.capacity += expansion.capacity;
      if (expansion.owned) s.manufacturing.owned = true;
      addEvent(s, {
        kind: 'milestone',
        title: '新增产能已投产',
        detail: `周产能增加 ${expansion.capacity} 辆，后续同时承担相应固定费用。`,
        tone: 'positive',
      });
    }
  }
  s.manufacturing.expansions = s.manufacturing.expansions.filter((e) => e.remaining > 0);
  rivalDecisions(s);
  const demand = Math.round(
    CONFIG.baseWeeklyDemand *
      (1 + s.week / 260) *
      (0.93 + draw(s) * 0.14) *
      (1 + Math.sin(s.week / 8) * 0.04),
  );
  const market = allocateDemand(offersOf(s), demand);
  s.market = { demand, shares: market.shares, outsideShare: market.outsideShare };
  const production = produceAndDeliver(s, market.orders.player ?? 0);
  settleRivals(s, market.orders);
  settleExpenses(s);
  const complaints = updateQuality(s);
  const cfo = s.executives.find((e) => e.id === 'cfo')!;
  if (s.company.cash < 0 && cfo.autonomous && s.company.debt < CONFIG.creditLimit)
    borrow(s, Math.min(300, CONFIG.creditLimit - s.company.debt), true);
  const totalDeliveries =
    production.delivered + s.rivals.reduce((sum, r) => sum + r.weeklyDelivered, 0);
  for (const rival of s.rivals)
    rival.share = totalDeliveries > 0 ? rival.weeklyDelivered / totalDeliveries : 0;
  const record: WeeklyRecord = {
    week: s.week,
    cash: s.company.cash,
    revenue: s.period.revenue - priorRevenue,
    profit: s.period.profit - priorProfit,
    delivered: production.delivered,
    produced: production.produced,
    orders: market.orders.player ?? 0,
    canceled: production.canceled,
    backlog: s.product.backlog,
    inventory: s.product.inventory,
    share: totalDeliveries > 0 ? production.delivered / totalDeliveries : 0,
    reputation: s.company.reputation,
    valuation: s.company.valuation,
    complaints,
    potentialDemand: demand,
  };
  s.weekly.push(record);
  valuation(s);
  record.valuation = s.company.valuation;
  if (s.product.totalDelivered >= 1000) addAchievement(s, 'deliveries', '累计交付突破 1,000 辆');
  if (Object.values(s.tech).some((t) => t.level >= 3))
    addAchievement(s, 'technology', '一条技术路线达到 Lv.3');
  if (s.week % 13 === 0) quarterly(s);
  if (s.company.cash < 0) {
    s.status = 'bankrupt';
    s.pause = {
      title: '企业进入破产清算',
      detail: '现金已耗尽，已授权的银行授信也无法覆盖支出。本局保留全部财务和决策记录。',
      target: 'finance',
    };
    addEvent(s, {
      kind: 'finance',
      title: '现金耗尽，企业停止经营',
      detail: `存续 ${s.week} 周，负债 ${(s.company.debt / 100).toFixed(2)} 亿元。`,
      tone: 'danger',
    });
  } else if (s.week >= CONFIG.maxWeeks) {
    s.status = 'completed';
    addAchievement(s, 'survival', '完成十二季度经营');
    if (s.cases.length === 0) addAchievement(s, 'safety', '保持无重大质量事件记录');
    s.pause = {
      title: '三年经营之旅已完成',
      detail: '查看本局多维成绩、季度报告与企业历史，或用相同种子尝试另一种战略。',
      target: 'dashboard',
    };
  } else if (s.company.cash < 80 && !s.pause && s.week % 4 === 0) {
    s.pause = {
      title: '现金安全预警',
      detail: '当前现金低于 0.80 亿元，请检查成本、融资和交付计划。',
      target: 'finance',
    };
  }
  return s;
}

export function advanceWeeks(
  state: GameState,
  weeks: number,
  options: { stopOnEvent?: boolean; stopAtQuarter?: boolean } = {},
): GameState {
  let result = state;
  for (let i = 0; i < weeks && result.status === 'active'; i++) {
    result = advanceWeek(result);
    if (
      (options.stopOnEvent !== false && result.pause) ||
      (options.stopAtQuarter && result.week % 13 === 0)
    )
      break;
  }
  return result;
}
