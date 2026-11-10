import {
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  Cpu,
  FlaskConical,
  Gauge,
  Layers,
  ShieldCheck,
  Timer,
  Zap,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  CONFIG,
  MODES,
  rangeOf,
  TECH_NAMES,
  unitCostOf,
  type DevelopmentMode,
  type Product,
  type TechKey,
} from '../engine';
import { Badge, CarRender, Hint, Panel, Progress, type ViewProps } from './shared';
import { money, price } from './format';

export function Research({ state: s, dispatch, openPlan }: ViewProps & { openPlan: () => void }) {
  const p = s.product;
  const [form, setForm] = useState({
    name: p.name,
    type: p.type,
    segment: p.segment,
    price: p.price,
    battery: p.battery,
    batteryCapacity: p.batteryCapacity,
    performance: p.performance,
    driving: p.driving,
    cabin: p.cabin,
    safety: p.safety,
  });
  const [mode, setMode] = useState<DevelopmentMode>(p.mode);
  const frozen = p.status !== 'draft';
  const cost = unitCostOf({ ...s, product: { ...p, ...form } });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    dispatch({ type: 'product', values: frozen ? { name: form.name, price: form.price } : form });
    if ((e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'develop')
      dispatch({ type: 'develop', mode });
  };
  const numeric = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: Number(value) }));
  return (
    <>
      <div className="research-hero">
        <div>
          <Badge tone={p.status === 'selling' ? 'positive' : 'info'}>
            {frozen ? MODES[p.mode].name : '首款产品项目'}
          </Badge>
          <h2>{p.name}</h2>
          <p>让每一项技术选择，都对应一个真实的产品价值。</p>
          <div className="hero-specs">
            <span>
              <BatteryCharging size={16} />
              {rangeOf({ ...p, ...form }, s.tech.battery.level)} km <small>工程估算</small>
            </span>
            <span>
              <Gauge size={16} />
              辅助驾驶 L{(p.driving + s.tech.driving.level * 0.35).toFixed(1)}
            </span>
            <span>
              <ShieldCheck size={16} />
              安全配置 {p.safety}/100
            </span>
          </div>
        </div>
        <CarRender logo={s.setup.logo} />
      </div>
      <div className="two-column research-columns">
        <Panel
          title="车型定义"
          subtitle={
            frozen ? '配置已冻结，可继续调整车型名称与零售价' : '配置越高，成本与研发复杂度越高'
          }
        >
          <form onSubmit={submit}>
            <div className="form-grid">
              <label className="span-2">
                车型名称
                <input
                  value={form.name}
                  maxLength={24}
                  required
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label>
                车型类型
                <select
                  disabled={frozen}
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value as Product['type'] }))
                  }
                >
                  {['轿车', 'SUV', 'MPV'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                市场定位
                <select
                  disabled={frozen}
                  value={form.segment}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, segment: e.target.value as Product['segment'] }))
                  }
                >
                  <option value="economy">经济级</option>
                  <option value="mainstream">主流级</option>
                  <option value="premium">高端级</option>
                </select>
              </label>
              <label>
                目标售价 <span>万元</span>
                <input
                  type="number"
                  min="9"
                  max="70"
                  step="0.01"
                  required
                  value={Number((form.price * 100).toFixed(4))}
                  onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) / 100 }))}
                />
              </label>
              <label>
                电池容量 <span>kWh</span>
                <input
                  disabled={frozen}
                  type="number"
                  min="40"
                  max="120"
                  step="1"
                  value={form.batteryCapacity}
                  required
                  onChange={(e) => numeric('batteryCapacity', e.target.value)}
                />
              </label>
              <label>
                电池方案
                <select
                  disabled={frozen}
                  value={form.battery}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, battery: e.target.value as 'LFP' | 'NMC' }))
                  }
                >
                  <option value="LFP">磷酸铁锂 · 成本更低</option>
                  <option value="NMC">三元锂 · 更高采购成本</option>
                </select>
              </label>
              <label>
                动力配置 <span>40—95</span>
                <input
                  disabled={frozen}
                  type="number"
                  min="40"
                  max="95"
                  value={form.performance}
                  required
                  onChange={(e) => numeric('performance', e.target.value)}
                />
              </label>
              <label>
                辅助驾驶 <span>配置等级 1—5</span>
                <input
                  disabled={frozen}
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  value={form.driving}
                  required
                  onChange={(e) => numeric('driving', e.target.value)}
                />
              </label>
              <label>
                智能座舱 <span>配置等级 1—5</span>
                <input
                  disabled={frozen}
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  value={form.cabin}
                  required
                  onChange={(e) => numeric('cabin', e.target.value)}
                />
              </label>
              <label>
                安全配置 <span>65—95</span>
                <input
                  disabled={frozen}
                  type="number"
                  min="65"
                  max="95"
                  value={form.safety}
                  required
                  onChange={(e) => numeric('safety', e.target.value)}
                />
              </label>
              <div className="cost-preview">
                <span>预计单车制造成本</span>
                <strong>
                  {price(cost)} <small>万元</small>
                </strong>
                <small className={form.price < cost ? 'negative-text' : 'muted'}>
                  预估毛利率 {(((form.price - cost) / form.price) * 100).toFixed(1)}%
                </small>
              </div>
            </div>
            {!frozen && (
              <>
                <div className="section-divider">
                  <span>研发推进方式</span>
                </div>
                <div className="mode-options">
                  {Object.entries(MODES).map(([key, item]) => (
                    <label className={`mode-option ${mode === key ? 'selected' : ''}`} key={key}>
                      <input
                        type="radio"
                        name="development-mode"
                        value={key}
                        checked={mode === key}
                        onChange={() => setMode(key as DevelopmentMode)}
                      />
                      <div>
                        <strong>
                          {item.name}
                          <small>启动 {money(CONFIG.prototypeCost * item.cost)} 亿元</small>
                        </strong>
                        <p>{item.detail}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
            <div className="form-actions">
              <button type="submit" className="button">
                保存车型方案
              </button>
              {!frozen && (
                <button type="submit" value="develop" className="button primary">
                  <FlaskConical size={16} />
                  启动车型研发
                </button>
              )}
            </div>
          </form>
        </Panel>
        <div className="stack">
          <Panel
            title="项目执行状态"
            action={
              <Badge tone={p.status === 'selling' ? 'positive' : 'info'}>
                {
                  { draft: '待立项', developing: '研发中', ready: '待发布', selling: '已上市' }[
                    p.status
                  ]
                }
              </Badge>
            }
          >
            <div className="project-progress">
              <div>
                <span>工程研发完成度</span>
                <strong>{p.progress.toFixed(0)}%</strong>
              </div>
              <Progress value={p.progress} />
              <div>
                <span>测试验证完成度</span>
                <strong className={p.validation < 70 ? 'warning-text' : 'positive-text'}>
                  {p.validation.toFixed(0)}%
                </strong>
              </div>
              <Progress value={p.validation} color={p.validation < 70 ? 'amber' : 'green'} />
            </div>
            <div className="key-value-list">
              <div>
                <span>技术负责人</span>
                <strong>林知远 · CTO</strong>
              </div>
              <div>
                <span>本季度研发额度</span>
                <strong>{money(s.plan.research)} 亿元</strong>
              </div>
              <div>
                <span>累计研发时间</span>
                <strong>
                  {p.startedWeek === null
                    ? '尚未启动'
                    : `${Math.max(0, (p.readyWeek ?? s.week) - p.startedWeek)} 周`}
                </strong>
              </div>
              <div>
                <span>预计剩余工程时间</span>
                <strong>
                  {p.status === 'draft'
                    ? '立项后开始计算'
                    : p.progress >= 100
                      ? '工程研发已完成'
                      : s.plan.research === 0
                        ? '等待恢复研发预算'
                        : `约 ${Math.ceil((100 - p.progress) / (4.8 * Math.sqrt(s.plan.research / 90) * MODES[p.mode].speed))} 周`}
                </strong>
              </div>
              <div>
                <span>上市验证记录</span>
                <strong>
                  {p.launchWeek === null
                    ? '未上市'
                    : `${p.launchValidation.toFixed(0)}% · 第 ${p.launchWeek} 周`}
                </strong>
              </div>
            </div>
            {p.status === 'ready' && (
              <div className="launch-callout">
                <strong>研发完成，等待你的决定</strong>
                <p>
                  {p.validation < 70
                    ? '当前耐久验证不足。继续推进可追加测试；提前上市会带来延迟质量风险。'
                    : '配置与工程验证已达到发布条件。你可以现在上市，也可交由技术高管继续安排。'}
                </p>
                <button className="button primary" onClick={() => dispatch({ type: 'launch' })}>
                  以当前验证度批准上市
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            <button
              className="button full"
              onClick={() => dispatch({ type: 'focus', area: 'research' })}
              disabled={s.focus.research > s.week || s.status !== 'active'}
            >
              <CheckCircle2 size={16} />
              {s.focus.research > s.week ? `专项审查中 · 至 W${s.focus.research}` : 'CEO 专项审查'}
              <span className="attention-cost">2 点注意力</span>
            </button>
            <p className="fine-print">
              专项审查增加 8 点验证度，并在接下来 4 周提高研发效率。日常研发由团队自行执行。
            </p>
          </Panel>
          <Panel title="研发资源分配" subtitle="技术需要持续投入与时间积累">
            <div className="budget-big">
              <span>季度研发预算</span>
              <strong>
                {money(s.plan.research)}
                <small>亿元</small>
              </strong>
            </div>
            <button className="button full" onClick={openPlan}>
              调整预算与优先方向
              <ArrowRight size={15} />
            </button>
            <Hint>
              研发预算同时覆盖整车工程与基础技术积累。三条路线独立推进，高级研究以已有等级为前置。
            </Hint>
          </Panel>
        </div>
      </div>
      <div className="section-title">
        <div>
          <span className="eyebrow">TECHNOLOGY ROADMAP</span>
          <h2>让积累，变成下一次突破。</h2>
        </div>
        <p>基础技术路线 · 每条最高 Lv.3</p>
      </div>
      <div className="tech-grid">
        {(['battery', 'driving', 'safety'] as TechKey[]).map((key, index) => {
          const tech = s.tech[key],
            Icon = [BatteryCharging, Cpu, ShieldCheck][index],
            focused = s.plan.techFocus === key;
          return (
            <Panel
              key={key}
              title={TECH_NAMES[key]}
              action={
                <span className={`tech-icon tech-${index}`}>
                  <Icon size={22} />
                </span>
              }
            >
              <div className="tech-level">
                <strong>Lv.{tech.level}</strong>
                <span>{focused ? '当前优先研究' : '待分配研发资源'}</span>
              </div>
              <div className="tech-steps">
                {[1, 2, 3].map((level) => (
                  <span
                    className={
                      tech.level >= level
                        ? 'done'
                        : tech.level === level - 1 && focused
                          ? 'current'
                          : ''
                    }
                    key={level}
                  >
                    L{level}
                  </span>
                ))}
              </div>
              <Progress value={tech.level === 3 ? 100 : tech.progress} />
              <p className="tech-description">
                {
                  [
                    '提升单位电量续航，并通过技术效率降低电池制造成本。',
                    '通过持续的软件技术积累，提高辅助驾驶的产品吸引力。',
                    '提高整车安全技术水平，增强安全可靠型用户的偏好。',
                  ][index]
                }
              </p>
              <button
                className={`button full ${focused ? 'soft' : ''}`}
                disabled={focused || tech.level === 3 || s.status !== 'active'}
                onClick={() => dispatch({ type: 'plan', values: { techFocus: key } })}
              >
                {tech.level === 3
                  ? '本期路线已完成'
                  : focused
                    ? `研究进度 ${tech.progress.toFixed(1)}%`
                    : '设为优先研究方向'}
                {!focused && tech.level < 3 && <ArrowRight size={14} />}
              </button>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
