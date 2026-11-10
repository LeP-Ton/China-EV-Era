import {
  ArrowRight,
  Globe2,
  Megaphone,
  MessageCircle,
  Radio,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { forecast, STRATEGIES, unitCostOf } from '../engine';
import { Badge, Hint, Panel, Progress, type ViewProps } from './shared';
import { integer, money, pct, price, weekLabel } from './format';

export function Market({ state: s, dispatch }: ViewProps) {
  const [filter, setFilter] = useState<'all' | 'owners' | 'media'>('all');
  const [targetPrice, setTargetPrice] = useState(price(s.product.price));
  const projected = forecast(s);
  const preview = forecast({
    ...s,
    product: { ...s.product, price: Number(targetPrice) / 100 || s.product.price },
  });
  const share = s.weekly.at(-1)?.share ?? 0;
  const topics = s.topics
    .filter(
      (t) =>
        filter === 'all' ||
        (filter === 'owners' && ['车主社区', '汽车论坛'].includes(t.channel)) ||
        (filter === 'media' && !['车主社区', '汽车论坛'].includes(t.channel)),
    )
    .slice()
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 12);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'product', values: { price: Number(targetPrice) / 100 } });
  };
  return (
    <>
      <div className="market-hero">
        <div>
          <span className="eyebrow">COMPETE ON YOUR OWN TERMS</span>
          <h2>市场不等人，战略不随波。</h2>
          <p>价格、技术、品牌与交付，共同决定消费者的选择。</p>
        </div>
        <div>
          <span>细分市场周潜在需求</span>
          <strong>
            {integer(s.market.demand)}
            <small>辆</small>
          </strong>
        </div>
        <div>
          <span>品牌声誉</span>
          <strong>
            {s.company.reputation.toFixed(1)}
            <small>/ 100</small>
          </strong>
        </div>
        <div>
          <span>实际交付份额</span>
          <strong>
            {pct(share)}
            <small />
          </strong>
        </div>
      </div>
      <Panel title="竞争格局" subtitle="所有企业争夺同一市场需求，并受自身资金、费用和产能约束">
        <div className="table-scroll">
          <table className="competition-table">
            <thead>
              <tr>
                <th>企业与车型</th>
                <th>经营路线</th>
                <th className="num">售价 / 万元</th>
                <th className="num">周产能 / 辆</th>
                <th className="num">累计交付 / 辆</th>
                <th className="num">实际份额</th>
                <th className="num">现金 / 亿元</th>
              </tr>
            </thead>
            <tbody>
              <tr className="player-row">
                <td>
                  <span className="company-table-icon">{s.company.brand.charAt(0)}</span>
                  <span>
                    <strong>
                      {s.company.name}
                      <Badge>你的企业</Badge>
                    </strong>
                    <small>
                      {s.product.name}
                      {s.product.status !== 'selling' && ' · 尚未上市'}
                    </small>
                  </span>
                </td>
                <td>{STRATEGIES[s.company.strategy].name}</td>
                <td className="num">{price(s.product.price)}</td>
                <td className="num">{integer(s.manufacturing.capacity)}</td>
                <td className="num">{integer(s.product.totalDelivered)}</td>
                <td className="num">{pct(share)}</td>
                <td className="num">{money(s.company.cash)}</td>
              </tr>
              {s.rivals.map((r, i) => (
                <tr key={r.id}>
                  <td>
                    <span className={`company-table-icon rival-${i}`}>{r.brand.charAt(0)}</span>
                    <span>
                      <strong>
                        {r.name}
                        {!r.active && <Badge tone="danger">已退出</Badge>}
                      </strong>
                      <small>{r.model}</small>
                    </span>
                  </td>
                  <td>{STRATEGIES[r.strategy].name}</td>
                  <td className="num">{price(r.price)}</td>
                  <td className="num">{integer(r.capacity)}</td>
                  <td className="num">{integer(r.totalDelivered)}</td>
                  <td className="num">{pct(r.share)}</td>
                  <td className="num">{money(r.cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rival-decisions">
          {s.rivals.map((r) => (
            <div key={r.id}>
              <span>{r.name}</span>
              <p>{r.lastAction}</p>
            </div>
          ))}
        </div>
      </Panel>
      <div className="two-column">
        <Panel title="消费者画像" subtitle="模型预测的各群体选择概率，包含暂不购车选项">
          <div className="segment-bars">
            {projected.segments.map((segment) => (
              <div key={segment.name}>
                <span>{segment.name}</span>
                <Progress value={segment.playerShare * 100} />
                <strong>{pct(segment.playerShare)}</strong>
              </div>
            ))}
          </div>
          <Hint>
            {s.product.status === 'selling'
              ? '预测反映当前配置、声誉、营销和交付周期。'
              : '这里是假设当前车型已上市的需求预测，尚未产生真实订单。'}
            实际交付仍受产能、资金、库存和退订影响。
          </Hint>
        </Panel>
        <Panel title="定价与需求试算" subtitle="降低价格可能增加订单，同时减少单车利润">
          <form onSubmit={submit}>
            <div className="price-input-row">
              <label>
                车型零售价 <span>万元</span>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  min="9"
                  max="70"
                  step="0.01"
                  required
                />
              </label>
              <button className="button primary" type="submit" disabled={s.status !== 'active'}>
                应用定价
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="pricing-results">
              <div>
                <span>试算每周新增订单</span>
                <strong>
                  {integer(preview.orders.player ?? 0)}
                  <small>辆</small>
                </strong>
              </div>
              <div>
                <span>试算单车毛利</span>
                <strong
                  className={Number(targetPrice) / 100 < unitCostOf(s) ? 'negative-text' : ''}
                >
                  {(Number(targetPrice) - unitCostOf(s) * 100).toFixed(2)}
                  <small>万元</small>
                </strong>
              </div>
              <div>
                <span>季度营销预算</span>
                <strong>
                  {money(s.plan.marketing)}
                  <small>亿元</small>
                </strong>
              </div>
            </div>
          </form>
          <p className="fine-print">
            预测使用当前竞争对手状态。时间推进后，需求波动与对手自主决策会改变结果。
          </p>
        </Panel>
      </div>
      <Panel
        title="舆论雷达"
        subtitle="真实严重性、证据可信度与传播热度是三个独立维度"
        action={
          <div className="segmented">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              全部
            </button>
            <button
              className={filter === 'owners' ? 'active' : ''}
              onClick={() => setFilter('owners')}
            >
              车主与社区
            </button>
            <button
              className={filter === 'media' ? 'active' : ''}
              onClick={() => setFilter('media')}
            >
              媒体与公告
            </button>
          </div>
        }
      >
        <div className="opinion-grid">
          {topics.length ? (
            topics.map((t) => {
              const linked = t.caseId ? s.cases.find((c) => c.id === t.caseId) : undefined;
              return (
                <article
                  className={`opinion-topic ${linked && linked.status !== 'closed' ? 'risk' : ''}`}
                  key={t.id}
                >
                  <div className="topic-meta">
                    <span>{t.channel}</span>
                    <small>{weekLabel(t.bornWeek)}</small>
                  </div>
                  <h4>{t.title}</h4>
                  <p>
                    {t.actor} ·{' '}
                    {linked
                      ? linked.status === 'closed'
                        ? '缺陷已整改，历史记录保留'
                        : '真实缺陷待调查或整改'
                      : '来自企业行动或市场事实'}
                  </p>
                  <div className="topic-data">
                    <div>
                      <span>传播热度</span>
                      <strong>
                        {t.heat.toFixed(0)}
                        <small>/100</small>
                      </strong>
                    </div>
                    <div>
                      <span>证据可信度</span>
                      <strong>
                        {t.credibility.toFixed(0)}
                        <small>%</small>
                      </strong>
                    </div>
                    <div>
                      <span>真实严重性</span>
                      <strong>
                        {linked && linked.evidence < 70
                          ? '待查'
                          : t.severity === 0
                            ? '无安全问题'
                            : `${t.severity.toFixed(0)}/100`}
                      </strong>
                    </div>
                  </div>
                  <Progress value={t.heat} color={t.sentiment < 0 ? 'amber' : 'blue'} />
                </article>
              );
            })
          ) : (
            <p className="muted">当前筛选暂无话题，企业的后续经营会形成新的传播信息。</p>
          )}
        </div>
        <div className="opinion-footer">
          <div>
            <ShieldAlert size={18} />
            <p>事实先于传播。公开沟通能解释信息，召回与维修才能修复缺陷。</p>
          </div>
          <button
            className="button"
            disabled={s.status !== 'active'}
            onClick={() => dispatch({ type: 'press' })}
          >
            <Megaphone size={16} />
            主持公开沟通<span className="attention-cost">2 点注意力</span>
          </button>
        </div>
      </Panel>
    </>
  );
}
