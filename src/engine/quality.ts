import { clamp, randomStep } from './random';
import { addEvent, expense, nextId, send } from './internals';
import type { GameState, QualityCase } from './types';

export function investigate(s: GameState, incident: QualityCase, automatic = false) {
  const batches = s.batches.filter((b) => incident.batchIds.includes(b.id));
  incident.evidence = 95;
  incident.status = 'investigating';
  incident.investigatedWeek = s.week;
  incident.findings = [];
  if (batches.some((b) => b.source.validation < 70))
    incident.findings.push('上市时耐久验证不足，缺陷在使用老化后逐步暴露。');
  if (batches.some((b) => b.source.supplier === 'unverified'))
    incident.findings.push('新锐供应商零部件缺少长期验证，关联批次存在一致性风险。');
  if (batches.some((b) => b.source.qualityBudget < 20))
    incident.findings.push('生产质量预算低于基础检测需求，漏检概率上升。');
  if (batches.some((b) => b.source.ramp > 1.25))
    incident.findings.push('产量快速爬坡超出工艺稳定窗口，增加装配异常。');
  if (!incident.findings.length)
    incident.findings.push('关联批次出现零部件耐久偏差，需以批次召回修复。');
  expense(s, 'aftersales', 5, '质量专项检测与批次溯源');
  addEvent(s, {
    kind: automatic ? 'npc' : 'quality',
    title: '质量调查完成',
    detail: `${incident.batchIds.length} 个已关联批次。${incident.findings.join('')}`,
    tone: 'warning',
  });
  send(s, {
    from: '陈嘉宁',
    role: '运营与质量总监',
    title: '检测报告已出：建议报告并召回',
    body: `${incident.findings.join('')}已建立受影响批次清单。暂停交付可以阻止新增暴露；只有维修与召回可以修复实际缺陷。`,
    target: 'production',
    tone: 'danger',
  });
}

export function reportIncident(s: GameState, incident: QualityCase) {
  incident.reported = true;
  expense(s, 'aftersales', 0.8, '发布质量调查进展与报告');
  s.topics.unshift({
    id: nextId(s, 'topic'),
    title: `${s.company.brand}公布质量调查与处置进展`,
    channel: '企业公告',
    actor: `${s.company.name}官方账号`,
    severity: incident.severity,
    credibility: incident.evidence,
    heat: 25,
    sentiment: -0.15,
    bornWeek: s.week,
    caseId: incident.id,
  });
  for (const topic of s.topics.filter((t) => t.caseId === incident.id)) {
    topic.credibility = Math.max(topic.credibility, incident.evidence);
    topic.heat = Math.max(5, topic.heat - 7);
  }
  addEvent(s, {
    kind: 'quality',
    title: '发布调查进展并报告',
    detail: `公开 ${incident.title} 的已知事实和处置进度；潜在缺陷仍需实际整改。`,
    tone: 'info',
  });
}

export function recallQuote(s: GameState, incident: QualityCase): { units: number; cost: number } {
  const affected = s.batches.filter(
    (b) => !b.repaired && (incident.batchIds.includes(b.id) || b.defectRate >= 0.025),
  );
  const units = affected.reduce((sum, b) => sum + b.delivered, 0);
  return {
    units,
    cost: units * 0.006 + affected.reduce((sum, b) => sum + b.units - b.delivered, 0) * 0.002 + 8,
  };
}

export function recall(s: GameState, incident: QualityCase, automatic = false) {
  const quote = recallQuote(s, incident);
  expense(s, 'aftersales', quote.cost, '批次召回、车主维修与补偿');
  for (const batch of s.batches)
    if (!batch.repaired && (incident.batchIds.includes(batch.id) || batch.defectRate >= 0.025))
      batch.repaired = true;
  incident.status = 'closed';
  incident.recalled = quote.units;
  incident.evidence = 100;
  if (!incident.reported) reportIncident(s, incident);
  if (s.manufacturing.supplier === 'unverified') s.manufacturing.supplier = 'established';
  s.product.validation = Math.min(100, s.product.validation + 16);
  // 修复方案需要复验，本周保持暂停；下周由玩家或运营高管恢复交付。
  s.product.halted = true;
  s.product.haltReason = 'recall';
  s.company.reputation = Math.min(100, s.company.reputation + 1.2);
  addEvent(s, {
    kind: automatic ? 'npc' : 'quality',
    title: '完成批次召回与整改',
    detail: `维修 ${quote.units} 辆，支出 ${(quote.cost / 100).toFixed(2)} 亿元；替换风险零件并追加验证。历史缺陷记录保留。`,
    tone: 'positive',
  });
  s.pause = {
    title: '召回整改已完成',
    detail: '关联批次已维修，供应链与验证方案已整改。复核后可以恢复交付。',
    target: 'production',
  };
}

export function updateQuality(s: GameState) {
  let newComplaints = 0;
  const affected = [];
  for (const batch of s.batches) {
    if (batch.repaired || batch.delivered === 0) continue;
    // 耐久暴露从实际交付起算；仓库中的车辆不会累积车主使用年限。
    const expected = Math.floor(
      batch.deliveries.reduce((sum, delivery) => {
        const age = s.week - delivery.week;
        return sum + delivery.units * batch.defectRate * clamp((age - batch.latency) / 32, 0, 1);
      }, 0),
    );
    const increase = Math.max(0, expected - batch.complaints);
    batch.complaints += increase;
    newComplaints += increase;
    if (batch.complaints > 0) affected.push(batch);
  }
  const complaints = affected.reduce((sum, b) => sum + b.complaints, 0);
  let incident = s.cases.find((c) => c.status !== 'closed');
  const riskComplaints = affected
    .filter((b) => b.defectRate >= 0.02)
    .reduce((sum, b) => sum + b.complaints, 0);
  const widespread = complaints >= Math.max(15, s.product.totalDelivered * 0.006);
  if (!incident && affected.length && (riskComplaints >= 8 || widespread)) {
    incident = {
      id: nextId(s, 'case'),
      title: '零部件耐久异常',
      batchIds: affected.map((b) => b.id),
      openedWeek: s.week,
      investigatedWeek: null,
      status: 'warning',
      severity: clamp(Math.max(...affected.map((b) => b.defectRate)) * 1300, 20, 96),
      evidence: 28,
      complaints,
      reported: false,
      recalled: 0,
      findings: [],
    };
    s.cases.push(incident);
    s.topics.unshift({
      id: nextId(s, 'topic'),
      title: `${s.company.brand}车主反馈零部件异常，原因待查`,
      channel: '车主社区',
      actor: '真实车主',
      severity: incident.severity,
      credibility: 28,
      heat: 18,
      sentiment: -0.65,
      bornWeek: s.week,
      caseId: incident.id,
    });
    send(s, {
      from: '陈嘉宁',
      role: '运营与质量总监',
      title: '质量预警：发现关联批次投诉',
      body: `已收到 ${complaints} 例投诉。当前只能确认症状，建议开展专项检测。问题与历史生产批次有关，不能通过营销预算消除。`,
      target: 'production',
      tone: 'danger',
    });
    addEvent(s, {
      kind: 'quality',
      title: '关联批次质量预警',
      detail: `${complaints} 例投诉，初始证据可信度 28%。尚未确认完整影响范围。`,
      tone: 'danger',
    });
    s.pause = {
      title: '收到质量异常预警',
      detail: '高管建议进行批次调查，您也可以授权团队继续处置。',
      target: 'production',
    };
  }
  if (incident) {
    incident.batchIds = [...new Set([...incident.batchIds, ...affected.map((b) => b.id)])];
    incident.complaints = complaints;
    incident.evidence = Math.min(
      incident.status === 'investigating' ? 98 : 65,
      incident.evidence + (newComplaints > 0 ? 2 : 0),
    );
    const elapsed = s.week - incident.openedWeek;
    const sourceTopic = s.topics.find((t) => t.caseId === incident!.id && t.channel === '车主社区');
    if (
      sourceTopic &&
      sourceTopic.heat > 40 &&
      !s.topics.some((t) => t.caseId === incident!.id && t.channel === '短视频')
    ) {
      s.topics.unshift({
        id: nextId(s, 'topic'),
        title: `${s.company.brand}车主公开异常视频，关注度上升`,
        channel: '短视频',
        actor: '车主与汽车博主',
        severity: incident.severity,
        credibility: incident.evidence,
        heat: sourceTopic.heat * 0.75,
        sentiment: -0.7,
        bornWeek: s.week,
        caseId: incident.id,
      });
    }
    const coo = s.executives.find((e) => e.id === 'coo')!;
    if (
      coo.autonomous &&
      s.week >= coo.holdUntil &&
      incident.status === 'warning' &&
      elapsed >= (coo.goal === 'reliability' ? 1 : 3)
    )
      investigate(s, incident, true);
    if (
      coo.autonomous &&
      s.week >= coo.holdUntil &&
      incident.status === 'investigating' &&
      s.week - (incident.investigatedWeek ?? s.week) >= 2 &&
      s.company.cash > recallQuote(s, incident).cost + 15
    )
      recall(s, incident, true);
    if (incident.status !== 'closed' && elapsed === 5) {
      s.product.halted = true;
      s.product.haltReason = 'safety';
      expense(s, 'aftersales', incident.severity >= 60 ? 22 : 8, '延迟安全处置的整改与监管成本');
      s.company.reputation = Math.max(0, s.company.reputation - 5);
      addEvent(s, {
        kind: 'quality',
        title: '安全处置逾期，交付被暂停',
        detail: '游戏监管规则要求调查、报告并修复缺陷，公关无法替代处置。',
        tone: 'danger',
      });
      s.pause = {
        title: '质量风险升级，交付暂停',
        detail: '关联批次尚未完成整改。请调查、报告并启动召回。',
        target: 'production',
      };
    }
  }
  for (const topic of s.topics) {
    const linked = topic.caseId ? s.cases.find((c) => c.id === topic.caseId) : undefined;
    if (linked && linked.status !== 'closed') {
      const draw = randomStep(s.rng);
      s.rng = draw.state;
      topic.heat = clamp(
        topic.heat * 0.98 +
          newComplaints * 0.16 +
          linked.severity * 0.035 +
          draw.value * 2 -
          (linked.reported ? 1.4 : 0),
        0,
        100,
      );
      topic.credibility = linked.evidence;
      if (topic.heat > 65) {
        topic.channel = '微博热搜';
        topic.actor = '汽车媒体与车主';
      }
    } else topic.heat *= linked ? 0.82 : 0.9;
  }
  const activeHeat = s.topics
    .filter((t) => t.caseId && s.cases.some((c) => c.id === t.caseId && c.status !== 'closed'))
    .reduce((sum, t) => sum + t.heat, 0);
  s.company.reputation = clamp(
    s.company.reputation +
      Math.log1p(s.plan.marketing / 13) * 0.025 -
      newComplaints / 180 -
      activeHeat * 0.0018,
    0,
    100,
  );
  return newComplaints;
}
