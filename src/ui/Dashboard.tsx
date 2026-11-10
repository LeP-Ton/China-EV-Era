import {
  Activity,
  ArrowRight,
  Banknote,
  BarChart3,
  Bell,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Cpu,
  FileText,
  MessageSquare,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  cashRunway,
  currentPeriod,
  forecast,
  rangeOf,
  TECH_NAMES,
  type Plan,
  type TechKey,
} from '../engine';
import {
  Badge,
  CarIllustration,
  Hint,
  Jump,
  Metric,
  Panel,
  Progress,
  TrendChart,
  type ViewProps,
} from './shared';
import { integer, money, pct, price, weekLabel } from './format';

export function PlanEditor({
  state,
  dispatch,
  onDone,
}: Pick<ViewProps, 'state' | 'dispatch'> & { onDone?: () => void }) {
  const [plan, setPlan] = useState<Plan>({ ...state.plan });
  const update = (key: keyof Plan, value: number | string) =>
    setPlan((p) => ({ ...p, [key]: value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'plan', values: plan });
    onDone?.();
  };
  return (
    <form className="plan-form" onSubmit={submit}>
      <Hint>
        预算是每季度的执行额度，按 13 周均匀支出。修改后从下周生效；浏览和调整战略不消耗注意力。
      </Hint>
      <div className="form-grid">
        <label>
          研发预算 <span>亿元 / 季度</span>
          <input
            type="number"
            min="0"
            max="3.6"
            step="0.01"
            value={plan.research / 100}
            onChange={(e) => update('research', Number(e.target.value) * 100)}
            required
          />
        </label>
        <label>
          营销预算 <span>亿元 / 季度</span>
          <input
            type="number"
            min="0"
            max="2.6"
            step="0.01"
            value={plan.marketing / 100}
            onChange={(e) => update('marketing', Number(e.target.value) * 100)}
            required
          />
        </label>
        <label>
          质量投入 <span>亿元 / 季度</span>
          <input
            type="number"
            min="0"
            max="1.5"
            step="0.01"
            value={plan.quality / 100}
            onChange={(e) => update('quality', Number(e.target.value) * 100)}
            required
          />
        </label>
        <label>
          季度生产目标 <span>辆</span>
          <input
            type="number"
            min="0"
            max="80000"
            step="100"
            value={plan.productionTarget}
            onChange={(e) => update('productionTarget', Number(e.target.value))}
            required
          />
        </label>
        <label className="span-2">
          优先研发方向
          <select
            value={plan.techFocus}
            onChange={(e) => update('techFocus', e.target.value as TechKey)}
          >
            {Object.entries(TECH_NAMES).map(([key, name]) => (
              <option value={key} key={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="plan-summary">
        <div>
          <span>战略预算合计</span>
          <strong>
            {money(plan.research + plan.marketing + plan.quality)} <small>亿元 / 季度</small>
          </strong>
        </div>
        <div>
          <span>当前基础产能</span>
          <strong>
            {integer(state.manufacturing.capacity * 13)} <small>辆 / 季度</small>
          </strong>
        </div>
      </div>
      {plan.productionTarget > state.manufacturing.capacity * 13 && (
        <p className="warning-note">目标高于现有产能，实际生产将受产能、订单和现金共同约束。</p>
      )}
      <div className="form-actions">
        <button type="submit" className="button primary">
          <CheckCircle2 size={16} />
          应用经营计划
        </button>
      </div>
    </form>
  );
}

export function Dashboard({
  state: s,
  dispatch,
  navigate,
  openPlan,
  openReport,
}: ViewProps & { openPlan: () => void; openReport: () => void }) {
  const [chart, setChart] = useState<'operations' | 'cash'>('operations');
  const period = currentPeriod(s),
    last = s.weekly.at(-1),
    previous = s.reports.at(-1);
  const runway = cashRunway(s);
  const p = s.product;
  const incident = s.cases.find((c) => c.status !== 'closed');
  const tasks: {
    icon: typeof Cpu;
    title: string;
    desc: string;
    target: 'research' | 'finance' | 'production' | 'office';
    danger?: boolean;
  }[] = [];
  if (incident)
    tasks.push({
      icon: ShieldCheck,
      title: '质量异常待处置',
      desc: `${incident.complaints} 例投诉 · ${incident.status === 'warning' ? '建议专项调查' : '建议报告与召回'}`,
      target: 'production',
      danger: true,
    });
  if (p.status === 'draft')
    tasks.push({
      icon: Cpu,
      title: '确认首款车型方案',
      desc: '配置产品，选择研发方式并立项',
      target: 'research',
    });
  if (p.status === 'developing')
    tasks.push({
      icon: Cpu,
      title: '首款车型持续研发中',
      desc: `研发完成度 ${p.progress.toFixed(0)}% · 可审查研发项目`,
      target: 'research',
    });
  if (p.status === 'ready')
    tasks.push({
      icon: CarFront,
      title: '首款车型等待上市',
      desc: `当前验证度 ${p.validation.toFixed(0)}%`,
      target: 'research',
    });
  if (runway < 12)
    tasks.push({
      icon: Banknote,
      title: '复核资金安全',
      desc: `当前现金跑道约 ${runway.toFixed(0)} 周`,
      target: 'finance',
      danger: runway < 6,
    });
  if (p.backlog > s.manufacturing.capacity * 2)
    tasks.push({
      icon: ClipboardList,
      title: '订单交付周期偏长',
      desc: `${integer(p.backlog)} 辆待交付，可能引起退订`,
      target: 'production',
    });
  const unread = s.messages.filter((m) => !m.read).length;
  if (unread)
    tasks.push({
      icon: MessageSquare,
      title: `${unread} 条高管消息未读`,
      desc: '报告、建议与市场竞争情报',
      target: 'office',
    });
  return (
    <>
      <div className="welcome-strip">
        <div>
          <span className="welcome-icon">
            <Sparkles size={20} />
          </span>
          <div>
            <strong>
              {s.status === 'active'
                ? '你好，创始人。掌握全局，决定下一程。'
                : '这一程已记录，下一程由你开启。'}
            </strong>
            <p>
              {p.status === 'draft'
                ? '从首款车型开始，把战略变成真正的产品。'
                : incident
                  ? '关注质量信号，给长期信任一个可靠的答案。'
                  : p.status === 'selling'
                    ? '团队正在自主运营，关注关键指标与长期投入。'
                    : '研发正在推进，保持资金与产品节奏之间的平衡。'}
            </p>
          </div>
        </div>
        <div className="valuation-label">
          <span>企业估值</span>
          <strong>
            ¥ {money(s.company.valuation)} <small>亿元</small>
          </strong>
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          label="现金余额"
          value={money(s.company.cash)}
          unit="亿元"
          detail={runway === Infinity ? '经营现金流为正' : `资金可支撑约 ${runway.toFixed(0)} 周`}
          icon={Wallet}
        />
        <Metric
          label="本季度营收"
          value={money(period.revenue)}
          unit="亿元"
          detail={`累计营收 ${money(s.company.totalRevenue)} 亿元`}
          icon={BarChart3}
        />
        <Metric
          label="本季度净利润"
          value={money(period.profit)}
          unit="亿元"
          detail={period.profit < 0 ? '研发、运营与交付成本持续核算' : '按实际交付结算收入与成本'}
          icon={TrendingUp}
          tone={period.profit < 0 ? 'loss' : ''}
        />
        <Metric
          label="本季度交付"
          value={integer(period.delivered)}
          unit="辆"
          detail={`细分市场份额 ${pct(last?.share ?? 0)}`}
          icon={CarFront}
        />
      </div>
      <div className="dashboard-main-grid">
        <div className="dashboard-left">
          <Panel
            title="经营趋势"
            subtitle="基于实际周度结算 · 金额单位：亿元"
            action={
              <div className="segmented">
                <button
                  onClick={() => setChart('operations')}
                  className={chart === 'operations' ? 'active' : ''}
                >
                  营收与利润
                </button>
                <button
                  onClick={() => setChart('cash')}
                  className={chart === 'cash' ? 'active' : ''}
                >
                  现金余额
                </button>
              </div>
            }
          >
            <div className="chart-legend">
              <span>
                <i className="blue-dot" />
                {chart === 'cash' ? '现金余额' : '营业收入'}
              </span>
              {chart !== 'cash' && (
                <span>
                  <i className="green-dot" />
                  净利润
                </span>
              )}
              <small>最近 26 个经营周</small>
            </div>
            <TrendChart state={s} mode={chart} />
            <div className="chart-bottom">
              <span>
                <Activity size={14} />
                {s.week === 0
                  ? '等待首个经营周结算'
                  : `最近一周新增 ${integer(last?.orders ?? 0)} 份订单，交付 ${integer(last?.delivered ?? 0)} 辆`}
              </span>
              <Jump onClick={() => navigate('finance')}>查看财务明细</Jump>
            </div>
          </Panel>
          <Panel
            title="产品与研发"
            action={<Jump onClick={() => navigate('research')}>进入研发中心</Jump>}
            className="product-overview"
          >
            <div className="product-overview-body">
              <div className="product-overview-info">
                <Badge tone={p.status === 'selling' ? 'positive' : 'info'}>
                  {
                    {
                      draft: '产品定义中',
                      developing: '研发进行中',
                      ready: '等待上市',
                      selling: '正式在售',
                    }[p.status]
                  }
                </Badge>
                <h2>{p.name}</h2>
                <p>
                  {{ economy: '经济级', mainstream: '主流级', premium: '高端级' }[p.segment]}纯电
                  {p.type} <span>·</span> {p.battery === 'LFP' ? '磷酸铁锂' : '三元锂'}电池
                </p>
                <div className="product-specs">
                  <div>
                    <strong>
                      {rangeOf(p, s.tech.battery.level)}
                      <small>km</small>
                    </strong>
                    <span>工程续航估算</span>
                  </div>
                  <div>
                    <strong>
                      {price(p.price)}
                      <small>万元</small>
                    </strong>
                    <span>目标零售价</span>
                  </div>
                </div>
              </div>
              <div className="car-stage">
                <div className="car-orbit" />
                <CarIllustration />
                <span>{s.company.brand.toUpperCase()} · ELECTRIC</span>
              </div>
            </div>
            <div className="product-progress-row">
              <div>
                <span>
                  {p.status === 'selling' ? '产品验证度' : '研发完成度'}{' '}
                  <strong>
                    {(p.status === 'selling' ? p.validation : p.progress).toFixed(0)}%
                  </strong>
                </span>
                <Progress value={p.status === 'selling' ? p.validation : p.progress} />
              </div>
              <button
                className="button small"
                onClick={() =>
                  p.status === 'ready'
                    ? dispatch({ type: 'launch' })
                    : navigate(p.status === 'selling' ? 'production' : 'research')
                }
              >
                {p.status === 'ready'
                  ? '批准上市'
                  : p.status === 'selling'
                    ? '查看生产交付'
                    : '管理车型项目'}
                <ArrowRight size={14} />
              </button>
            </div>
          </Panel>
        </div>
        <aside className="dashboard-right">
          <Panel title="经营待办" action={<span className="count-badge">{tasks.length}</span>}>
            <div className="task-list">
              {tasks.length ? (
                tasks.slice(0, 4).map((task, i) => (
                  <button className="task" key={i} onClick={() => navigate(task.target)}>
                    <span className={`task-icon ${task.danger ? 'danger' : ''}`}>
                      <task.icon size={17} />
                    </span>
                    <span>
                      <strong>{task.title}</strong>
                      <small>{task.desc}</small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                ))
              ) : (
                <div className="all-clear">
                  <CheckCircle2 size={24} />
                  <strong>团队运转正常</strong>
                  <span>当前没有需要 CEO 处理的重大事务</span>
                </div>
              )}
            </div>
            <button className="task-footer" onClick={() => navigate('office')}>
              查看企业办公通信
              <ArrowRight size={14} />
            </button>
          </Panel>
          <Panel
            title="管理团队"
            subtitle="授权，让企业持续自主运转"
            action={<Jump onClick={() => navigate('office')}>管理</Jump>}
          >
            <div className="team-list">
              {s.executives.map((e, i) => (
                <div className="team-member" key={e.id}>
                  <span className={`avatar avatar-${i}`}>{e.name.slice(-2)}</span>
                  <div>
                    <strong>
                      {e.name}
                      <span>{e.id.toUpperCase()}</span>
                    </strong>
                    <small>{e.specialty}</small>
                  </div>
                  <Badge tone={e.autonomous ? 'positive' : 'neutral'}>
                    {e.autonomous ? '自主执行' : '报批模式'}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="team-foot">
              <i className="online-dot" />
              日常工作按预算与部门目标自动执行
            </div>
          </Panel>
          <div className="quarter-note">
            <div className="quarter-note-icon">
              <FileText size={21} />
            </div>
            <strong>
              {previous ? `第 ${previous.quarter} 季度报告已归档` : '你的第一份季度报告'}
            </strong>
            <p>
              {previous
                ? `营收 ${money(previous.revenue)} 亿元 · 利润 ${money(previous.profit)} 亿元`
                : '每 13 周生成经营结算，解释收入、成本与现金变化的原因。'}
            </p>
            <Jump onClick={previous ? openReport : openPlan}>
              {previous ? '阅读经营报告' : '先配置季度计划'}
            </Jump>
          </div>
        </aside>
      </div>
      <div className="dashboard-bottom-grid">
        <Panel
          title="市场情报"
          action={<Jump onClick={() => navigate('market')}>查看市场全景</Jump>}
        >
          <div className="market-briefs">
            {s.topics
              .slice()
              .sort((a, b) => b.heat - a.heat)
              .slice(0, 2)
              .map((t, i) => (
                <button key={t.id} onClick={() => navigate('market')}>
                  <span className="news-index">0{i + 1}</span>
                  <div>
                    <strong>{t.title}</strong>
                    <small>
                      {t.channel} <span>·</span> 证据可信度 {t.credibility.toFixed(0)}%
                    </small>
                  </div>
                  <span className="heat-number">
                    {t.heat.toFixed(0)}
                    <small>热度</small>
                  </span>
                </button>
              ))}
          </div>
        </Panel>
        <Panel
          title="季度战略概览"
          action={
            <button className="icon-button" aria-label="配置季度计划" onClick={openPlan}>
              <Settings2 size={17} />
            </button>
          }
        >
          <div className="budget-rows">
            {[
              { label: '研发', value: s.plan.research, color: 'blue' },
              { label: '营销', value: s.plan.marketing, color: 'violet' },
              { label: '质量', value: s.plan.quality, color: 'green' },
            ].map((b) => (
              <div key={b.label}>
                <span>{b.label}投入</span>
                <Progress value={(b.value / 360) * 100} color={b.color} />
                <strong>
                  {money(b.value)} <small>亿元</small>
                </strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
