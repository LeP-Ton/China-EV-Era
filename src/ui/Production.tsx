import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  PackageCheck,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Truck,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { CONFIG, recallQuote, SUPPLIERS, unitCostOf, type Supplier } from '../engine';
import { Badge, Empty, Hint, Metric, Panel, Progress, type ViewProps } from './shared';
import { integer, money, price, weekLabel } from './format';

export function Production({ state: s, dispatch, openPlan }: ViewProps & { openPlan: () => void }) {
  const [allBatches, setAllBatches] = useState(false);
  const latest = s.weekly.at(-1);
  const cases = s.cases.slice().reverse();
  const batches = s.batches
    .slice()
    .reverse()
    .slice(0, allBatches ? 156 : 8);
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="可用周产能"
          value={integer(s.manufacturing.capacity)}
          unit="辆"
          detail={s.manufacturing.owned ? '自有工厂 + 合作产线' : '合作代工产能'}
          icon={Factory}
        />
        <Metric
          label="本周实际生产"
          value={integer(latest?.produced ?? 0)}
          unit="辆"
          detail={`目标 ${integer(s.plan.productionTarget / 13)} 辆 / 周`}
          icon={Boxes}
        />
        <Metric
          label="待交付订单"
          value={integer(s.product.backlog)}
          unit="辆"
          detail={`预计等待 ${(s.product.backlog / s.manufacturing.capacity).toFixed(1)} 周`}
          icon={Truck}
        />
        <Metric
          label="当前库存"
          value={integer(s.product.inventory)}
          unit="辆"
          detail={`制造成本约 ${price(unitCostOf(s))} 万元 / 辆`}
          icon={PackageCheck}
        />
      </div>
      <div className="two-column">
        <Panel
          title="生产执行"
          subtitle="订单、产能、库存和现金共同约束生产"
          action={
            <Badge tone={s.product.halted ? 'warning' : 'positive'}>
              {s.product.halted ? '交付已暂停' : '执行正常'}
            </Badge>
          }
        >
          <div className="production-flow">
            {[
              { label: '累计订单', value: s.product.totalOrders },
              { label: '累计退订', value: s.product.totalCanceled },
              { label: '待交付', value: s.product.backlog },
              { label: '累计交付', value: s.product.totalDelivered },
            ].map((v, i) => (
              <div key={v.label}>
                <span>{v.label}</span>
                <strong>{integer(v.value)}</strong>
                {i < 3 && <ArrowRight size={16} />}
              </div>
            ))}
          </div>
          <div className="capacity-row">
            <span>本周产能利用率</span>
            <strong>
              {(((latest?.produced ?? 0) / s.manufacturing.capacity) * 100).toFixed(0)}%
            </strong>
          </div>
          <Progress value={((latest?.produced ?? 0) / s.manufacturing.capacity) * 100} />
          <div className="form-actions">
            <button className="button" onClick={openPlan}>
              调整生产与检测预算
            </button>
            <button
              className={`button ${s.product.halted ? 'primary' : ''}`}
              disabled={s.product.status !== 'selling' || s.status !== 'active'}
              onClick={() => dispatch({ type: 'halt', value: !s.product.halted })}
            >
              {s.product.halted ? <Play size={14} /> : <Pause size={14} />}
              {s.product.halted ? '恢复生产与交付' : '暂停生产与交付'}
            </button>
          </div>
          <Hint>
            暂停交付不会消除已交付车辆的风险。库存占用现金并产生仓储费用；退订会随着等待时间上升。
          </Hint>
        </Panel>
        <Panel title="产能投资" subtitle="资本支出不直接计入当期利润">
          <div className="investment-options">
            <div>
              <span className="investment-icon">
                <Factory size={21} />
              </span>
              <div>
                <strong>扩建生产线</strong>
                <small>+350 辆 / 周 · 6 周完成</small>
              </div>
              <strong>
                {money(CONFIG.expansionCost)}
                <small>亿元</small>
              </strong>
              <button
                className="button small"
                disabled={s.manufacturing.expansions.length > 0 || s.status !== 'active'}
                onClick={() => dispatch({ type: 'expand', owned: false })}
              >
                投资
              </button>
            </div>
            <div>
              <span className="investment-icon green">
                <Wrench size={21} />
              </span>
              <div>
                <strong>建设自有工厂</strong>
                <small>+1,400 辆 / 周 · 13 周完成</small>
              </div>
              <strong>
                {money(CONFIG.factoryCost)}
                <small>亿元</small>
              </strong>
              <button
                className="button small"
                disabled={
                  s.manufacturing.owned ||
                  s.manufacturing.expansions.length > 0 ||
                  s.status !== 'active'
                }
                onClick={() => dispatch({ type: 'expand', owned: true })}
              >
                {s.manufacturing.owned ? '已建设' : '投资'}
              </button>
            </div>
          </div>
          {s.manufacturing.expansions.map((e) => (
            <div className="construction" key={e.id}>
              <strong>
                {e.owned ? '自有工厂' : '新增产线'}建设中 <span>还需 {e.remaining} 周</span>
              </strong>
              <Progress value={(1 - e.remaining / (e.owned ? 13 : 6)) * 100} />
            </div>
          ))}
          <button
            className="button full"
            disabled={s.focus.operations > s.week || s.status !== 'active'}
            onClick={() => dispatch({ type: 'focus', area: 'operations' })}
          >
            <ClipboardCheck size={16} />
            {s.focus.operations > s.week ? '生产协调专项执行中' : 'CEO 生产专项协调'}
            <span className="attention-cost">2 点注意力</span>
          </button>
          <p className="fine-print">
            专项协调 4 周内增加 12% 可用产能。自有工厂降低单位制造成本，也增加每周固定支出。
          </p>
        </Panel>
      </div>
      <Panel title="供应链方案" subtitle="方案调整只影响后续生产；历史批次保留原供应商记录">
        <div className="supplier-grid">
          {(Object.keys(SUPPLIERS) as Supplier[]).map((key) => {
            const supplier = SUPPLIERS[key],
              selected = s.manufacturing.supplier === key;
            return (
              <button
                key={key}
                className={`supplier-card ${selected ? 'selected' : ''}`}
                onClick={() => dispatch({ type: 'supplier', supplier: key })}
                disabled={s.status !== 'active'}
                aria-pressed={selected}
              >
                <span className="supplier-title">
                  <strong>{supplier.name}</strong>
                  {selected ? <CheckCircle2 size={18} /> : <span className="radio-circle" />}
                </span>
                <p>{supplier.description}</p>
                <span className="supplier-factor">
                  采购成本系数 <b>{supplier.costFactor.toFixed(2)}×</b>
                  <small>
                    {key === 'unverified'
                      ? '耐久信息不足'
                      : key === 'premium'
                        ? '高可靠性'
                        : '充分验证'}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
      <Panel
        title="质量监测与事故处置"
        subtitle="缺陷来自真实批次，随保有量和使用时间逐渐暴露"
        action={
          <Badge tone={cases.some((c) => c.status !== 'closed') ? 'danger' : 'positive'}>
            {cases.some((c) => c.status !== 'closed') ? '发现质量异常' : '持续监测中'}
          </Badge>
        }
      >
        {cases.length ? (
          <div className="case-list">
            {cases.map((c) => {
              const quote = recallQuote(s, c);
              return (
                <div className={`quality-case ${c.status === 'closed' ? 'closed' : ''}`} key={c.id}>
                  <div className="case-title">
                    <span className="case-symbol">
                      {c.status === 'closed' ? (
                        <ShieldCheck size={22} />
                      ) : (
                        <AlertTriangle size={22} />
                      )}
                    </span>
                    <div>
                      <strong>
                        {c.title}
                        <Badge tone={c.status === 'closed' ? 'positive' : 'danger'}>
                          {c.status === 'closed'
                            ? '已整改'
                            : c.status === 'warning'
                              ? '待调查'
                              : '待召回'}
                        </Badge>
                      </strong>
                      <p>
                        {weekLabel(c.openedWeek)} · 关联 {c.batchIds.length} 个批次 · 已收到{' '}
                        {integer(c.complaints)} 例投诉
                      </p>
                    </div>
                  </div>
                  <div className="case-evidence">
                    <span>
                      证据可信度 <b>{c.evidence.toFixed(0)}%</b>
                    </span>
                    <span>
                      调查状态 <b>{c.findings.length ? '已确认原因' : '症状已知，原因未明'}</b>
                    </span>
                    <span>
                      报告义务 <b>{c.reported ? '已报告' : '待报告'}</b>
                    </span>
                  </div>
                  {c.findings.length > 0 && (
                    <div className="findings">
                      <strong>调查结论与历史原因</strong>
                      {c.findings.map((f) => (
                        <p key={f}>
                          <CheckCircle2 size={14} />
                          {f}
                        </p>
                      ))}
                    </div>
                  )}
                  {c.status === 'closed' ? (
                    <p className="positive-text recall-complete">
                      <CheckCircle2 size={16} />
                      已召回维修 {integer(c.recalled)} 辆，历史记录继续保留。
                    </p>
                  ) : (
                    <div className="case-actions">
                      <button
                        className="button"
                        disabled={c.status !== 'warning' || s.status !== 'active'}
                        onClick={() => dispatch({ type: 'investigate', caseId: c.id })}
                      >
                        <Search size={15} />
                        专项调查<small>3 点注意力</small>
                      </button>
                      <button
                        className="button"
                        disabled={c.reported || s.status !== 'active'}
                        onClick={() => dispatch({ type: 'report', caseId: c.id })}
                      >
                        发布进展与报告
                      </button>
                      <button
                        className="button danger"
                        disabled={c.evidence < 70 || s.status !== 'active'}
                        onClick={() => dispatch({ type: 'recall', caseId: c.id })}
                      >
                        <Wrench size={15} />
                        启动召回<small>{money(quote.cost)} 亿元 · 2 点</small>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            icon={ShieldCheck}
            title={
              s.product.totalDelivered ? '尚未发现批次级质量异常' : '从第一辆交付开始，持续观察'
            }
          >
            投诉并不等于完整事实。车辆使用时间越长，耐久问题越有可能逐步显现。
          </Empty>
        )}
        <Hint>
          严重安全问题必须调查、报告并整改。忽略预警会造成声誉损失、追加成本与强制暂停交付；授权运营高管可自主处理。
        </Hint>
      </Panel>
      <Panel
        title="生产批次追溯"
        subtitle="保存车型 V1.0 的供应商、上市后验证与交付记录"
        action={
          s.batches.length > 8 ? (
            <button className="text-button" onClick={() => setAllBatches(!allBatches)}>
              {allBatches ? '收起批次' : `展开全部 ${s.batches.length} 个批次`}
            </button>
          ) : undefined
        }
      >
        {batches.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>批次编号</th>
                  <th>生产时间</th>
                  <th>供应商</th>
                  <th className="num">生产 / 交付</th>
                  <th className="num">当时验证度</th>
                  <th className="num">投诉数</th>
                  <th>处置</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="mono">{b.id.toUpperCase()}</td>
                    <td>{weekLabel(b.week)}</td>
                    <td>{SUPPLIERS[b.source.supplier].name.split(' · ')[0]}</td>
                    <td className="num">
                      {integer(b.units)} / {integer(b.delivered)}
                    </td>
                    <td className="num">{b.source.validation.toFixed(0)}%</td>
                    <td className={`num ${b.complaints ? 'warning-text' : ''}`}>{b.complaints}</td>
                    <td>
                      <Badge tone={b.repaired ? 'positive' : b.complaints ? 'warning' : 'neutral'}>
                        {b.repaired ? '已维修' : b.complaints ? '有反馈' : '监测中'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={Boxes} title="还没有生产批次">
            完成研发并上市后，订单与生产计划会驱动工厂运转。
          </Empty>
        )}
      </Panel>
    </>
  );
}
