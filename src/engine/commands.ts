import { CONFIG, GOAL_NAMES, MODES, SUPPLIERS, TECH_NAMES } from './config';
import {
  addAchievement,
  addEvent,
  attention,
  cashRunway,
  ensurePeriod,
  expense,
  nextId,
  send,
  transaction,
} from './internals';
import { clamp } from './random';
import { investigate, recall, recallQuote, reportIncident } from './quality';
import type { Command, CommandResult, DevelopmentMode, GameState } from './types';

export function startProject(s: GameState, mode: DevelopmentMode, automatic = false) {
  const cost = CONFIG.prototypeCost * MODES[mode].cost;
  expense(s, 'research', cost, `${s.product.name}样车与工程立项`);
  s.product.status = 'developing';
  s.product.mode = mode;
  s.product.startedWeek = s.week;
  if (mode === 'lean') s.product.cabin = Math.max(1, s.product.cabin - 1);
  addEvent(s, {
    kind: automatic ? 'npc' : 'player',
    title: `${s.product.name}正式立项`,
    detail: `${MODES[mode].name}；样车与工程支出 ${(cost / 100).toFixed(2)} 亿元。${MODES[mode].detail}`,
    tone: 'info',
  });
}

export function launchModel(s: GameState, automatic = false) {
  expense(s, 'marketing', CONFIG.launchCost, '车型上市、渠道与发布准备');
  s.product.status = 'selling';
  s.product.launchWeek = s.week;
  s.product.launchValidation = s.product.validation;
  addEvent(s, {
    kind: automatic ? 'npc' : 'player',
    title: `${s.product.name}上市`,
    detail: `售价 ${(s.product.price * 100).toFixed(2)} 万元，上市验证度 ${s.product.validation.toFixed(0)}%。${s.product.validation < 70 ? '耐久验证不足，潜在风险将在车辆老化后显现。' : '开始接受订单，按生产与交付确认收入。'}`,
    tone: s.product.validation < 70 ? 'warning' : 'positive',
  });
  s.topics.unshift({
    id: nextId(s, 'topic'),
    title: `${s.product.name}上市，起售价 ${(s.product.price * 100).toFixed(2)} 万元`,
    channel: '汽车媒体',
    actor: '新能源观察',
    severity: 0,
    credibility: 100,
    heat: 40 + Math.min(30, s.plan.marketing / 4),
    sentiment: 0.7,
    bornWeek: s.week,
  });
  addAchievement(s, 'launch', '首款车型上市');
}

export function borrow(s: GameState, amount: number, automatic = false) {
  s.company.debt += amount;
  s.period.financing += amount;
  transaction(s, 'financing', automatic ? 'CFO 自动使用银行授信' : '银行贷款到账', amount, 0);
  addEvent(s, {
    kind: automatic ? 'npc' : 'finance',
    title: automatic ? '财务高管获得应急贷款' : '银行贷款到账',
    detail: `${(amount / 100).toFixed(2)} 亿元；总负债 ${(s.company.debt / 100).toFixed(2)} 亿元，基础年利率 6.5%。`,
    tone: 'info',
  });
}

export function applyCommand(original: GameState, action: Command): CommandResult {
  const fail = (message: string): CommandResult => ({ state: original, ok: false, message });
  if (!['read', 'acknowledge'].includes(action.type) && original.status !== 'active')
    return fail('本局已结算，可查看报告或重新创立企业。');
  const s = structuredClone(original);
  ensurePeriod(s);
  let message = '';
  switch (action.type) {
    case 'plan': {
      const bounds: Record<string, [number, number]> = {
        research: [0, 360],
        marketing: [0, 260],
        quality: [0, 150],
        productionTarget: [0, 80000],
      };
      for (const [key, value] of Object.entries(action.values)) {
        if (key === 'techFocus') {
          if (!['battery', 'driving', 'safety'].includes(String(value)))
            return fail('请选择有效的技术方向。');
        } else if (
          !bounds[key] ||
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < bounds[key][0] ||
          value > bounds[key][1]
        )
          return fail('预算或生产目标超出允许范围。');
      }
      s.plan = {
        ...s.plan,
        ...action.values,
        productionTarget: Math.round(action.values.productionTarget ?? s.plan.productionTarget),
      };
      message = '经营计划已更新，将从下一个模拟周执行。';
      addEvent(s, {
        kind: 'player',
        title: '调整季度经营计划',
        detail: `研发 ${(s.plan.research / 100).toFixed(2)} 亿，营销 ${(s.plan.marketing / 100).toFixed(2)} 亿，质量 ${(s.plan.quality / 100).toFixed(2)} 亿；季度产量目标 ${s.plan.productionTarget} 辆；主攻${TECH_NAMES[s.plan.techFocus]}。`,
        tone: 'info',
      });
      break;
    }
    case 'product': {
      const values = action.values;
      if (
        s.product.status !== 'draft' &&
        Object.keys(values).some((k) => k !== 'price' && k !== 'name')
      )
        return fail('车型立项后配置已冻结；售价和名称仍可调整。');
      const bounds: Record<string, [number, number]> = {
        price: [0.09, 0.7],
        batteryCapacity: [40, 120],
        performance: [40, 95],
        driving: [1, 5],
        cabin: [1, 5],
        safety: [65, 95],
      };
      for (const [key, value] of Object.entries(values)) {
        if (
          bounds[key] &&
          (typeof value !== 'number' ||
            !Number.isFinite(value) ||
            value < bounds[key][0] ||
            value > bounds[key][1])
        )
          return fail('车型参数超出允许范围。');
      }
      if (values.name !== undefined && (!values.name.trim() || values.name.length > 24))
        return fail('车型名称需为 1—24 个字符。');
      if (values.type && !['轿车', 'SUV', 'MPV'].includes(values.type))
        return fail('无效车型类型。');
      if (values.battery && !['LFP', 'NMC'].includes(values.battery)) return fail('无效电池类型。');
      if (values.segment && !['economy', 'mainstream', 'premium'].includes(values.segment))
        return fail('无效车型定位。');
      s.product = { ...s.product, ...values, name: values.name?.trim() ?? s.product.name };
      message = '车型方案已保存。';
      addEvent(s, {
        kind: 'player',
        title: '调整车型方案与定价',
        detail: `${s.product.name}，${(s.product.price * 100).toFixed(2)} 万元，${s.product.batteryCapacity} kWh，辅助驾驶配置 L${s.product.driving}。`,
        tone: 'info',
      });
      break;
    }
    case 'develop': {
      if (s.product.status !== 'draft') return fail('当前车型已立项。');
      if (!MODES[action.mode]) return fail('无效研发方式。');
      if (s.company.cash < CONFIG.prototypeCost * MODES[action.mode].cost)
        return fail('现金不足以完成样车与工程立项。');
      startProject(s, action.mode);
      message = '研发已启动，推进模拟周即可开始执行。';
      break;
    }
    case 'launch': {
      if (s.product.status !== 'ready') return fail('车型研发尚未完成。');
      if (s.company.cash < CONFIG.launchCost) return fail('现金不足以进行上市准备。');
      launchModel(s);
      message = '车型正式上市，下一周起消费者将产生订单。';
      break;
    }
    case 'supplier': {
      if (!SUPPLIERS[action.supplier]) return fail('请选择有效供应商。');
      s.manufacturing.supplier = action.supplier;
      message = '供应商已调整，仅影响之后生产的批次。';
      addEvent(s, {
        kind: 'player',
        title: '更换供应商方案',
        detail: `${SUPPLIERS[action.supplier].name}。历史批次保留原零部件与验证记录。`,
        tone: action.supplier === 'unverified' ? 'warning' : 'info',
      });
      break;
    }
    case 'expand': {
      if (s.manufacturing.expansions.length > 0) return fail('已有产能项目施工中，请等待完成。');
      if (action.owned && s.manufacturing.owned)
        return fail('首版支持一座自有工厂，可以继续扩建产线。');
      if (s.manufacturing.capacity >= 7000) return fail('当前产能已达到首版管理上限。');
      const cost = action.owned ? CONFIG.factoryCost : CONFIG.expansionCost;
      if (s.company.cash < cost + 30) return fail('投资后需至少保留 0.30 亿元运营现金。');
      s.period.capex += cost;
      transaction(s, 'capex', action.owned ? '投资自有工厂' : '扩建生产线', -cost, 0);
      s.manufacturing.expansions.push({
        id: nextId(s, 'plant'),
        remaining: action.owned ? 13 : 6,
        capacity: action.owned ? CONFIG.factoryCapacity : CONFIG.expansionCapacity,
        owned: action.owned,
      });
      message = action.owned ? '工厂建设启动，13 周后投产。' : '产线扩建启动，6 周后投产。';
      addEvent(s, {
        kind: 'player',
        title: action.owned ? '投资自有工厂' : '扩建生产线',
        detail: `${message}资本支出 ${(cost / 100).toFixed(2)} 亿元，不计入当期营业费用。`,
        tone: 'info',
      });
      break;
    }
    case 'loan': {
      if (
        !Number.isFinite(action.amount) ||
        action.amount < 50 ||
        action.amount > 500 ||
        s.company.debt + action.amount > CONFIG.creditLimit
      )
        return fail('单笔贷款 0.50—5.00 亿元，总授信上限 10.00 亿元。');
      borrow(s, action.amount);
      message = '银行贷款已到账。';
      break;
    }
    case 'repay': {
      if (!Number.isFinite(action.amount) || action.amount <= 0 || action.amount > s.company.debt)
        return fail('还款金额需大于零且不超过总负债。');
      if (s.company.cash < action.amount) return fail('现金不足以还款。');
      s.company.debt -= action.amount;
      s.period.financing -= action.amount;
      transaction(s, 'financing', '偿还银行贷款', -action.amount, 0);
      message = '已偿还贷款，后续周利息同步下降。';
      addEvent(s, {
        kind: 'finance',
        title: '偿还银行贷款',
        detail: `还款 ${(action.amount / 100).toFixed(2)} 亿元，余额 ${(s.company.debt / 100).toFixed(2)} 亿元。`,
        tone: 'positive',
      });
      break;
    }
    case 'equity': {
      if (s.week - s.company.lastEquityWeek < 13)
        return fail('股权融资每季度最多进行一轮，需间隔 13 周。');
      if (
        !Number.isFinite(action.amount) ||
        action.amount < 100 ||
        action.amount > Math.min(600, s.company.valuation * 0.45)
      )
        return fail('融资需为 1—6 亿元，且不超过当前估值的 45%。');
      const ownership =
        (s.company.ownership * s.company.valuation) / (s.company.valuation + action.amount);
      if (ownership < 0.1) return fail('创始人持股不能低于本版约定的 10%。');
      s.company.ownership = ownership;
      s.company.lastEquityWeek = s.week;
      s.period.financing += action.amount;
      transaction(s, 'financing', '股权融资到账', action.amount, 0);
      message = `融资到账，创始人持股 ${(ownership * 100).toFixed(1)}%。`;
      addEvent(s, {
        kind: 'finance',
        title: '完成股权融资',
        detail: `融入 ${(action.amount / 100).toFixed(2)} 亿元，投前估值 ${(s.company.valuation / 100).toFixed(2)} 亿元；${message}`,
        tone: 'positive',
      });
      break;
    }
    case 'focus': {
      if (s.focus[action.area] > s.week) return fail('该专项正在执行，无需重复投入注意力。');
      if (!attention(s, 2)) return fail('本月注意力不足，需要 2 点。');
      s.focus[action.area] = s.week + (action.area === 'finance' ? 13 : 4);
      if (action.area === 'research')
        s.product.validation = Math.min(100, s.product.validation + 8);
      const names = {
        research: '研发专项审查',
        operations: '生产专项协调',
        finance: '财务风险审计',
      };
      message = `${names[action.area]}已启动。`;
      addEvent(s, {
        kind: 'player',
        title: names[action.area],
        detail:
          action.area === 'research'
            ? '消耗 2 点注意力，增加 8 点验证度，4 周内研发效率提高。'
            : action.area === 'operations'
              ? '消耗 2 点注意力，4 周内协调提升可用产能 12%。'
              : '消耗 2 点注意力，13 周内融资风险审计使年利率下降 0.8 个百分点。',
        tone: 'positive',
      });
      break;
    }
    case 'investigate': {
      const incident = s.cases.find((c) => c.id === action.caseId && c.status === 'warning');
      if (!incident) return fail('没有待调查的质量事件。');
      if (s.company.cash < 5) return fail('专项检测需要 0.05 亿元。');
      if (!attention(s, 3)) return fail('专项调查需要 3 点注意力，也可授权运营高管自主调查。');
      investigate(s, incident);
      message = '调查完成，已确认影响因素和关联批次。';
      break;
    }
    case 'report': {
      const incident = s.cases.find((c) => c.id === action.caseId);
      if (!incident || incident.reported) return fail('该事件已报告，或不存在。');
      if (s.company.cash < 0.8) return fail('发布调查进展需要 0.008 亿元。');
      reportIncident(s, incident);
      message = '已发布事实与处置进展，并履行游戏报告义务。';
      break;
    }
    case 'recall': {
      const incident = s.cases.find((c) => c.id === action.caseId && c.status !== 'closed');
      if (!incident || incident.evidence < 70) return fail('请先调查并确认受影响批次。');
      if (s.company.cash < recallQuote(s, incident).cost + (incident.reported ? 0 : 0.8))
        return fail('现金不足以完成召回，请先融资；暂停交付可避免新增暴露。');
      if (!attention(s, 2)) return fail('亲自协调召回需要 2 点注意力，可授权运营高管自主执行。');
      recall(s, incident);
      message = '召回维修与供应链整改已完成，交付保持暂停待复核。';
      break;
    }
    case 'halt': {
      if (s.product.status !== 'selling') return fail('车型尚未上市。');
      if (!action.value && s.cases.some((c) => c.status !== 'closed' && s.week - c.openedWeek >= 5))
        return fail('安全处置逾期，完成召回前不能恢复交付。');
      s.product.halted = action.value;
      s.product.haltReason = action.value ? 'manual' : 'none';
      message = action.value
        ? '已暂停生产与交付，已交付车辆的风险仍需调查。'
        : '已恢复生产与交付。';
      addEvent(s, {
        kind: 'player',
        title: action.value ? '主动暂停交付' : '恢复生产交付',
        detail: message,
        tone: action.value ? 'warning' : 'positive',
      });
      break;
    }
    case 'press': {
      if (s.company.cash < 3) return fail('沟通与车主服务需要 0.03 亿元。');
      if (!attention(s, 2)) return fail('亲自主持沟通需要 2 点注意力。');
      expense(s, 'marketing', 3, '媒体沟通与车主说明会');
      for (const topic of s.topics)
        topic.heat = Math.max(0, topic.heat - (topic.credibility >= 70 ? 5 : 2));
      s.company.reputation = clamp(s.company.reputation + 0.25, 0, 100);
      message = '已解释已知事实；真实缺陷、批次风险与事故严重性不会改变。';
      addEvent(s, { kind: 'player', title: '主持公开沟通', detail: message, tone: 'info' });
      break;
    }
    case 'requestReport': {
      const entry = s.messages.find((m) => m.id === action.messageId);
      if (!entry) return fail('消息不存在。');
      if (!attention(s, 1)) return fail('要求专项补充报告需要 1 点注意力。');
      entry.read = true;
      const body =
        entry.target === 'research'
          ? `研发 ${s.product.progress.toFixed(1)}%，验证 ${s.product.validation.toFixed(1)}%，季度研发预算 ${(s.plan.research / 100).toFixed(2)} 亿元。当前阶段 ${s.product.status === 'draft' ? '尚未立项' : s.product.status === 'selling' ? '已上市' : '研发或验证进行中'}；压缩验证会将部分风险延后到车辆使用阶段。`
          : entry.target === 'production'
            ? `累计交付 ${s.product.totalDelivered} 辆，库存 ${s.product.inventory} 辆，积压订单 ${s.product.backlog} 辆。${
                s.cases
                  .filter((c) => c.status !== 'closed')
                  .map(
                    (c) =>
                      `质量事件：${c.complaints} 例投诉，可信度 ${c.evidence}%，${c.reported ? '已报告' : '待报告'}。`,
                  )
                  .join('') || '尚无待处理的批次级异常；样本较少不等于风险为零。'
              }`
            : `当前现金 ${(s.company.cash / 100).toFixed(2)} 亿元，债务 ${(s.company.debt / 100).toFixed(2)} 亿元，累计净利润 ${(s.company.totalProfit / 100).toFixed(2)} 亿元。${cashRunway(s) === Infinity ? '近期经营现金流为正。' : `按近期经营结果，资金约可支撑 ${cashRunway(s).toFixed(0)} 周。`}融资影响现金和股权，不计入营业收入。`;
      send(s, {
        from: entry.from,
        role: entry.role,
        title: `补充报告：${entry.title}`,
        body,
        target: entry.target,
        tone: 'info',
      });
      message = '高管已补充基于当前经营事实的专项报告。';
      addEvent(s, {
        kind: 'player',
        title: '要求高管补充报告',
        detail: `向${entry.from}提出专项数据请求，消耗 1 点注意力。`,
        tone: 'info',
      });
      break;
    }
    case 'defer': {
      const entry = s.messages.find((m) => m.id === action.messageId);
      if (!entry) return fail('消息不存在。');
      const executive = s.executives.find((e) => e.name === entry.from);
      if (!executive) return fail('该消息不包含可暂缓的部门建议。');
      executive.holdUntil = s.week + 4;
      executive.trust = Math.max(0, executive.trust - 1);
      entry.read = true;
      message = '该部门自主发起重大决策暂缓 4 周，日常工作继续执行；安全义务与监管措施仍然有效。';
      addEvent(s, {
        kind: 'player',
        title: `暂缓${executive.name}的部门建议`,
        detail: message,
        tone: 'warning',
      });
      break;
    }
    case 'executive': {
      const executive = s.executives.find((e) => e.id === action.id);
      if (!executive || (action.goal && !GOAL_NAMES[action.goal]))
        return fail('高管或部门目标无效。');
      if (action.autonomous !== undefined) executive.autonomous = action.autonomous;
      if (action.goal) executive.goal = action.goal;
      message = '高管授权与部门目标已更新。';
      addEvent(s, {
        kind: 'player',
        title: `调整${executive.name}的授权`,
        detail: `${executive.autonomous ? '自主决策' : '重大事项报批'}，${GOAL_NAMES[executive.goal]}。日常部门工作仍持续执行。`,
        tone: 'info',
      });
      break;
    }
    case 'read': {
      const entry = s.messages.find((m) => m.id === action.messageId);
      if (entry) entry.read = true;
      return { state: s, ok: true, message: '' };
    }
    case 'acknowledge':
      s.pause = null;
      return { state: s, ok: true, message: '' };
  }
  s.decisions.push({ week: s.week, action: structuredClone(action) });
  return { state: s, ok: true, message };
}
