import {
  ArrowRight,
  Check,
  CheckCheck,
  FileText,
  MessageSquare,
  Send,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { cashRunway, GOAL_NAMES, type Executive } from '../engine';
import { Badge, Empty, Panel, Progress, type ViewProps } from './shared';
import { money, weekLabel } from './format';

export function Office({ state: s, dispatch, navigate }: ViewProps) {
  const [selected, setSelected] = useState(s.messages[0]?.id ?? '');
  const [filter, setFilter] = useState('all');
  const messages = s.messages.filter((m) => filter === 'all' || m.from === filter);
  const message = s.messages.find((m) => m.id === selected) ?? messages[0];
  const incident = s.cases.find((c) => c.status !== 'closed');
  return (
    <>
      <Panel title="企业办公通信" subtitle="报告来自真实经营状态，高管将按授权主动执行">
        <div className="office-filters">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            全部消息<span>{s.messages.length}</span>
          </button>
          {s.executives.map((e) => (
            <button
              className={filter === e.name ? 'active' : ''}
              key={e.id}
              onClick={() => setFilter(e.name)}
            >
              {e.name}
              <span>{s.messages.filter((m) => m.from === e.name && !m.read).length}</span>
            </button>
          ))}
        </div>
        <div className="office-layout">
          <div className="message-list">
            {messages.length ? (
              messages.map((m) => (
                <button
                  key={m.id}
                  className={`message-preview ${message?.id === m.id ? 'selected' : ''} ${!m.read ? 'unread' : ''}`}
                  onClick={() => {
                    setSelected(m.id);
                    dispatch({ type: 'read', messageId: m.id });
                  }}
                >
                  <div>
                    <span className={`tiny-avatar ${m.tone === 'danger' ? 'danger' : ''}`}>
                      {m.from.slice(-2)}
                    </span>
                    <strong>{m.from}</strong>
                    <small>{weekLabel(m.week)}</small>
                  </div>
                  <h4>{m.title}</h4>
                  <p>{m.body}</p>
                  <span className={`message-status ${m.tone}`}>
                    {m.tone === 'danger'
                      ? '风险预警'
                      : m.tone === 'warning'
                        ? '经营提醒'
                        : m.tone === 'positive'
                          ? '进展报告'
                          : '部门沟通'}
                  </span>
                  {!m.read && <i className="unread-dot" />}
                </button>
              ))
            ) : (
              <Empty icon={MessageSquare} title="暂无此部门消息">
                团队推进实际业务后，会主动发送相关报告。
              </Empty>
            )}
          </div>
          <div className="message-detail">
            {message && (
              <>
                <div className="message-detail-head">
                  <span className="avatar avatar-0">{message.from.slice(-2)}</span>
                  <div>
                    <strong>
                      {message.from}
                      <span>{message.role}</span>
                    </strong>
                    <p>发送给 CEO · {weekLabel(message.week)}</p>
                  </div>
                  <Badge tone={message.read ? 'neutral' : 'info'}>
                    {message.read ? '已读' : '未读'}
                  </Badge>
                </div>
                <div className="message-body">
                  <span className="eyebrow">INTERNAL MEMO / {message.target.toUpperCase()}</span>
                  <h2>{message.title}</h2>
                  <p className="salutation">CEO，你好：</p>
                  <p>{message.body}</p>
                  <div className="message-signature">
                    <span>{message.from}</span>
                    <small>
                      {message.role} · {s.company.name}
                    </small>
                  </div>
                </div>
                <div className="message-context">
                  <FileText size={18} />
                  <div>
                    <strong>当前关联业务快照</strong>
                    <p>
                      现金 {money(s.company.cash)} 亿元 · 车型研发 {s.product.progress.toFixed(0)}%
                      · 待交付 {s.product.backlog} 辆
                    </p>
                  </div>
                  <button className="text-button" onClick={() => navigate(message.target)}>
                    进入业务
                    <ArrowRight size={14} />
                  </button>
                </div>
                <div className="message-actions">
                  {message.target === 'research' && s.product.status === 'ready' ? (
                    <button className="button primary" onClick={() => dispatch({ type: 'launch' })}>
                      <Check size={15} />
                      批准车型上市
                    </button>
                  ) : message.target === 'production' && incident?.status === 'warning' ? (
                    <button
                      className="button primary"
                      onClick={() => dispatch({ type: 'investigate', caseId: incident.id })}
                    >
                      接受建议 · 专项调查
                    </button>
                  ) : message.target === 'finance' && cashRunway(s) < 8 && s.company.debt <= 700 ? (
                    <button
                      className="button primary"
                      onClick={() => dispatch({ type: 'loan', amount: 300 })}
                    >
                      批准 3 亿元银行贷款
                    </button>
                  ) : (
                    <button className="button primary" onClick={() => navigate(message.target)}>
                      查看并处理业务
                      <ArrowRight size={14} />
                    </button>
                  )}
                  <button
                    className="button"
                    onClick={() => dispatch({ type: 'requestReport', messageId: message.id })}
                  >
                    要求补充报告 <small>1 点注意力</small>
                  </button>
                  <button
                    className="button ghost"
                    onClick={() => dispatch({ type: 'defer', messageId: message.id })}
                  >
                    暂缓部门建议
                  </button>
                </div>
                <p className="fine-print">
                  暂缓建议会让该部门 4
                  周内暂停自主发起重大决策，日常执行继续；安全合规义务不受影响。
                </p>
              </>
            )}
          </div>
        </div>
      </Panel>
      <div className="section-title">
        <div>
          <span className="eyebrow">EXECUTIVE TEAM</span>
          <h2>好的团队，拥有自己的判断。</h2>
        </div>
        <p>调整目标与授权，不必替他们做每一件事</p>
      </div>
      <div className="executive-grid">
        {s.executives.map((e, i) => (
          <Panel
            title={e.name}
            subtitle={`${e.title} · ${e.specialty}`}
            key={e.id}
            action={<span className={`avatar avatar-${i}`}>{e.id.toUpperCase()}</span>}
          >
            <div className="executive-traits">
              <Badge tone="neutral">{e.personality}</Badge>
              <span>风险偏好 {e.risk}/100</span>
            </div>
            <div className="executive-stats">
              {[
                { label: '专业能力', value: e.expertise },
                { label: '管理能力', value: e.management },
                { label: '工作积极性', value: e.motivation },
                { label: '对 CEO 信任', value: e.trust },
              ].map((a) => (
                <div key={a.label}>
                  <span>{a.label}</span>
                  <Progress value={a.value} />
                  <b>{a.value}</b>
                </div>
              ))}
            </div>
            <label className="goal-select">
              部门经营目标
              <select
                value={e.goal}
                onChange={(event) =>
                  dispatch({
                    type: 'executive',
                    id: e.id,
                    goal: event.target.value as Executive['goal'],
                  })
                }
              >
                {Object.entries(GOAL_NAMES).map(([key, name]) => (
                  <option value={key} key={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="autonomy-toggle">
              <span>
                <strong>授权自主决策</strong>
                <small>
                  {e.id === 'cto'
                    ? '按目标立项、验证并安排上市'
                    : e.id === 'cfo'
                      ? '在有限授信内应对现金风险'
                      : '自主调查质量问题与召回整改'}
                </small>
              </span>
              <input
                type="checkbox"
                checked={e.autonomous}
                onChange={(event) =>
                  dispatch({ type: 'executive', id: e.id, autonomous: event.target.checked })
                }
              />
              <i />
            </label>
            {e.holdUntil > s.week && (
              <p className="warning-note">重大决策已暂缓至第 {e.holdUntil} 周</p>
            )}
            <div className="executive-action">
              <i className="online-dot" />
              <p>{e.lastAction}</p>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
