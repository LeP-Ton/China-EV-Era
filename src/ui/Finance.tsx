import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  CircleDollarSign,
  FileText,
  Landmark,
  PieChart,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { cashRunway, currentPeriod, type QuarterReport } from '../engine';
import { Badge, Empty, Hint, Metric, Panel, TrendChart, type ViewProps } from './shared';
import { integer, money, pct, weekLabel } from './format';

export function ReportContent({ report }: { report: QuarterReport }) {
  return (
    <div className="report-content">
      <div className="report-summary">
        <div>
          <span>营业收入</span>
          <strong>
            {money(report.revenue)}
            <small>亿元</small>
          </strong>
        </div>
        <div>
          <span>季度净利润</span>
          <strong className={report.profit < 0 ? 'negative-text' : 'positive-text'}>
            {money(report.profit)}
            <small>亿元</small>
          </strong>
        </div>
        <div>
          <span>实际交付</span>
          <strong>
            {integer(report.delivered)}
            <small>辆</small>
          </strong>
        </div>
      </div>
      <h4>数字背后的原因</h4>
      <div className="report-causes">
        {report.causes.map((cause, i) => (
          <div key={cause}>
            <span>0{i + 1}</span>
            <p>{cause}</p>
          </div>
        ))}
      </div>
      <div className="report-facts">
        <span>
          期末现金 <b>{money(report.cash)} 亿元</b>
        </span>
        <span>
          期末负债 <b>{money(report.debt)} 亿元</b>
        </span>
        <span>
          细分市场份额 <b>{pct(report.share)}</b>
        </span>
        <span>
          品牌声誉 <b>{report.reputation.toFixed(1)} / 100</b>
        </span>
      </div>
    </div>
  );
}

export function Finance({
  state: s,
  dispatch,
  openReport,
}: ViewProps & { openReport: () => void }) {
  const [selected, setSelected] = useState('current');
  const period =
    selected === 'current'
      ? currentPeriod(s)
      : (s.reports.find((r) => r.quarter === Number(selected)) ?? currentPeriod(s));
  const runway = cashRunway(s);
  const gross = period.revenue - period.cogs;
  const expenses = [
    { key: 'research', label: '研发与样车费用', value: period.research },
    { key: 'marketing', label: '营销与上市费用', value: period.marketing },
    { key: 'quality', label: '生产质量检测', value: period.quality },
    { key: 'payroll', label: '团队薪酬', value: period.payroll },
    { key: 'fixed', label: '工厂固定成本与仓储', value: period.fixed },
    { key: 'interest', label: '贷款利息', value: period.interest },
    { key: 'aftersales', label: '售后、召回与处置', value: period.aftersales },
  ];
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="可用现金"
          value={money(s.company.cash)}
          unit="亿元"
          detail={
            runway === Infinity
              ? '近期经营现金流为正'
              : `按近期经营支出可支撑约 ${runway.toFixed(0)} 周`
          }
          icon={Wallet}
        />
        <Metric
          label="企业估值"
          value={money(s.company.valuation)}
          unit="亿元"
          detail={`历史最高 ${money(s.company.peakValuation)} 亿元`}
          icon={Building2}
        />
        <Metric
          label="有息负债"
          value={money(s.company.debt)}
          unit="亿元"
          detail={`基础年利率 6.5% · 剩余授信 ${money(1000 - s.company.debt)} 亿`}
          icon={Landmark}
        />
        <Metric
          label="创始人持股"
          value={(s.company.ownership * 100).toFixed(1)}
          unit="%"
          detail={`累计净利润 ${money(s.company.totalProfit)} 亿元`}
          icon={PieChart}
        />
      </div>
      <div className="finance-grid">
        <Panel
          title="利润与费用"
          subtitle="只在实际交付时确认收入和汽车销售成本"
          action={
            <select
              className="compact-select"
              aria-label="选择财务期间"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="current">当前季度</option>
              {s.reports.map((r) => (
                <option value={r.quarter} key={r.quarter}>
                  第 {r.quarter} 季度
                </option>
              ))}
            </select>
          }
        >
          <div className="income-top">
            <span>营业收入</span>
            <strong>
              {money(period.revenue)} <small>亿元</small>
            </strong>
          </div>
          <div className="income-line">
            <span>− 汽车销售成本</span>
            <strong>{money(period.cogs)}</strong>
          </div>
          <div className="income-line subtotal">
            <span>汽车毛利润</span>
            <strong>{money(gross)}</strong>
          </div>
          <div className="expense-list">
            {expenses.map((e) => (
              <div key={e.key}>
                <span>{e.label}</span>
                <div className="expense-track">
                  <i
                    style={{
                      width: `${Math.min(100, (e.value / Math.max(1, ...expenses.map((v) => v.value))) * 100)}%`,
                    }}
                  />
                </div>
                <strong>{money(e.value)}</strong>
              </div>
            ))}
          </div>
          <div className="income-total">
            <span>季度净利润</span>
            <strong className={period.profit < 0 ? 'negative-text' : 'positive-text'}>
              {money(period.profit)} <small>亿元</small>
            </strong>
          </div>
          <div className="cash-bridge">
            <strong>现金与利润的差异</strong>
            <div>
              <span>采购投入现金</span>
              <span>−{money(period.productionCash)} 亿</span>
            </div>
            <div>
              <span>资本支出</span>
              <span>−{money(period.capex)} 亿</span>
            </div>
            <div>
              <span>融资净流入</span>
              <span>
                {period.financing >= 0 ? '+' : ''}
                {money(period.financing)} 亿
              </span>
            </div>
            <p>生产采购先形成库存资产，交付时才结转成本；融资和建厂影响现金，不增加营业收入。</p>
          </div>
        </Panel>
        <div className="stack">
          <Panel title="现金余额趋势" subtitle="最近 26 个经营周 · 单位：亿元">
            <TrendChart state={s} mode="cash" height={200} />
          </Panel>
          <Panel title="资本工具" subtitle="扩张的每一笔钱，都有对应的代价">
            <div className="capital-tool">
              <span className="capital-icon">
                <Landmark size={21} />
              </span>
              <div>
                <strong>银行贷款</strong>
                <p>保留股权，承担本金与每周利息</p>
              </div>
              <button
                className="button small"
                disabled={s.company.debt > 700 || s.status !== 'active'}
                onClick={() => dispatch({ type: 'loan', amount: 300 })}
              >
                贷款 3 亿元
              </button>
            </div>
            <div className="capital-tool">
              <span className="capital-icon violet">
                <PieChart size={21} />
              </span>
              <div>
                <strong>股权融资</strong>
                <p>按当前估值稀释股份，间隔 13 周</p>
              </div>
              <button
                className="button small"
                disabled={s.status !== 'active'}
                onClick={() => dispatch({ type: 'equity', amount: 300 })}
              >
                融资 3 亿元
              </button>
            </div>
            <div className="capital-tool">
              <span className="capital-icon green">
                <ArrowUpRight size={21} />
              </span>
              <div>
                <strong>偿还贷款</strong>
                <p>减少现金储备，降低后续利息</p>
              </div>
              <button
                className="button small"
                disabled={s.company.debt === 0 || s.status !== 'active'}
                onClick={() => dispatch({ type: 'repay', amount: Math.min(300, s.company.debt) })}
              >
                还款 {money(Math.min(300, s.company.debt), 0)} 亿元
              </button>
            </div>
            <button
              className="button full"
              disabled={s.focus.finance > s.week || s.status !== 'active'}
              onClick={() => dispatch({ type: 'focus', area: 'finance' })}
            >
              <ShieldCheck size={16} />
              {s.focus.finance > s.week ? '财务审计专项执行中' : 'CEO 财务风险审计'}
              <span className="attention-cost">2 点注意力</span>
            </button>
            <p className="fine-print">
              审计持续 13 周，使贷款年利率下降 0.8 个百分点。CFO 可在授权范围内自主使用有限授信。
            </p>
          </Panel>
        </div>
      </div>
      <div className="two-column">
        <Panel
          title="季度报告归档"
          subtitle="保留每一次关键转折的财务证据"
          action={
            s.reports.length ? (
              <button className="text-button" onClick={openReport}>
                打开季度报告
                <ArrowUpRight size={14} />
              </button>
            ) : undefined
          }
        >
          {s.reports.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>经营季度</th>
                    <th className="num">营收 / 亿元</th>
                    <th className="num">利润 / 亿元</th>
                    <th className="num">交付 / 辆</th>
                    <th>结果</th>
                  </tr>
                </thead>
                <tbody>
                  {s.reports
                    .slice()
                    .reverse()
                    .map((r) => (
                      <tr key={r.quarter}>
                        <td>
                          {2026 + Math.floor((r.quarter - 1) / 4)} 年 Q{((r.quarter - 1) % 4) + 1}
                        </td>
                        <td className="num">{money(r.revenue)}</td>
                        <td className={`num ${r.profit < 0 ? 'negative-text' : 'positive-text'}`}>
                          {money(r.profit)}
                        </td>
                        <td className="num">{integer(r.delivered)}</td>
                        <td>
                          <Badge tone={r.profit >= 0 ? 'positive' : 'warning'}>
                            {r.profit >= 0 ? '盈利' : '投入期'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={FileText} title="第一份报告尚在路上">
              每 13 周生成一份完整报告。期间你可以随时查看真实现金流水与经营数据。
            </Empty>
          )}
        </Panel>
        <Panel title="估值是预期，现金是生存" subtitle="游戏内资本市场定价逻辑">
          <div className="valuation-factors">
            <div>
              <span>增长与营收</span>
              <strong>年化营收 × 收入倍数</strong>
              <p>收入倍数随销量增长调整；增长不会直接产生可用现金。</p>
            </div>
            <div>
              <span>盈利与技术</span>
              <strong>利润能力 + 技术积累</strong>
              <p>持续经营盈利与三个基础技术等级共同影响估值。</p>
            </div>
            <div>
              <span>风险与负债</span>
              <strong>现金 − 债务 − 未处置风险</strong>
              <p>高估值企业也可能现金枯竭；尚未处理的质量事件会影响投资者预期。</p>
            </div>
          </div>
        </Panel>
      </div>
      <Panel title="现金流水" subtitle="可追溯的最近 12 笔交易 · 融资与利润分别记录">
        {s.transactions.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>业务摘要</th>
                  <th className="num">现金变动 / 亿元</th>
                  <th className="num">利润影响 / 亿元</th>
                  <th className="num">交易后现金 / 亿元</th>
                </tr>
              </thead>
              <tbody>
                {s.transactions
                  .slice(-12)
                  .reverse()
                  .map((t) => (
                    <tr key={t.id}>
                      <td>{weekLabel(t.week)}</td>
                      <td>{t.label}</td>
                      <td className={`num ${t.cashDelta >= 0 ? 'positive-text' : ''}`}>
                        {t.cashDelta > 0 ? '+' : ''}
                        {money(t.cashDelta, 3)}
                      </td>
                      <td className="num">{money(t.profitDelta, 3)}</td>
                      <td className="num">{money(t.balance, 3)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={Banknote} title="首期资金已就位">
            开始研发、融资或推进时间后，所有真实交易将记录在这里。
          </Empty>
        )}
      </Panel>
    </>
  );
}
