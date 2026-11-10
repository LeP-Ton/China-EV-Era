import { ArrowRight, Cpu, Gem, Megaphone, ShieldCheck, TrendingUp, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DEFAULT_SEED, STRATEGIES, type NewGameOptions, type Strategy } from '../engine';
import { Brand, CarRender } from './shared';

const strategyIcons = {
  technology: Cpu,
  value: TrendingUp,
  premium: Gem,
  marketing: Megaphone,
  quality: ShieldCheck,
};
export function CreateGame({
  onCreate,
  onCancel,
  initialOptions,
}: {
  onCreate: (options: NewGameOptions) => void;
  onCancel?: () => void;
  initialOptions?: NewGameOptions;
}) {
  const [form, setForm] = useState<NewGameOptions>(
    initialOptions ?? {
      name: '远川汽车科技',
      brand: '远川',
      model: '远川 ONE',
      strategy: 'technology',
      seed: DEFAULT_SEED,
    },
  );
  const update = (key: keyof NewGameOptions, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onCreate(form);
  };
  return (
    <div className="creation-screen">
      <div className="creation-story">
        <Brand />
        <div className="story-content">
          <div className="story-kicker">
            <span />
            2026 · 中国新能源时代
          </div>
          <h1>
            下一家伟大的车企，
            <br />
            由你定义。
          </h1>
          <p>
            决定方向，信任团队。
            <br />
            在技术、资本与市场之间，找到属于你的路。
          </p>
          <CarRender />
          <div className="story-facts">
            <div>
              <strong>12</strong>
              <span>经营季度</span>
            </div>
            <div>
              <strong>05</strong>
              <span>战略起点</span>
            </div>
            <div>
              <strong>∞</strong>
              <span>决策可能</span>
            </div>
          </div>
        </div>
        <footer>
          EV Era 1.0 <span>企业经营模拟 · 本地独立运行</span>
        </footer>
      </div>
      <div className="creation-form-wrap">
        {onCancel && (
          <button
            className="icon-button creation-close"
            aria-label="取消重新开始"
            onClick={onCancel}
          >
            <X />
          </button>
        )}
        <form onSubmit={submit} className="creation-form">
          <span className="eyebrow">BUILD YOUR NEXT CHAPTER</span>
          <h2>创立你的新能源车企</h2>
          <p className="muted">一个品牌，一支团队，一段三年的创业旅程。</p>
          <div className="form-grid">
            <label className="span-2">
              企业名称
              <input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
                maxLength={30}
              />
            </label>
            <label>
              汽车品牌
              <input
                value={form.brand}
                onChange={(e) => update('brand', e.target.value)}
                required
                maxLength={15}
              />
            </label>
            <label>
              首款车型
              <input
                value={form.model}
                onChange={(e) => update('model', e.target.value)}
                required
                maxLength={24}
              />
            </label>
          </div>
          <div className="form-label">
            选择初始战略<span>起点不同，路线由你决定</span>
          </div>
          <div className="strategy-options">
            {(Object.keys(STRATEGIES) as Strategy[]).map((key) => {
              const item = STRATEGIES[key],
                Icon = strategyIcons[key];
              return (
                <button
                  type="button"
                  className={`strategy-option ${form.strategy === key ? 'selected' : ''}`}
                  key={key}
                  onClick={() => update('strategy', key)}
                  aria-pressed={form.strategy === key}
                >
                  <Icon size={19} />
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.subtitle}</small>
                  </div>
                  <i />
                </button>
              );
            })}
          </div>
          <p className="strategy-detail">
            {STRATEGIES[form.strategy].description} 初始资金{' '}
            <b>{(STRATEGIES[form.strategy].cash / 100).toFixed(2)} 亿元</b>。
          </p>
          <label className="seed-label">
            市场随机种子 <span>相同种子与决策，可复现同一段企业历史</span>
            <input
              value={form.seed}
              onChange={(e) => update('seed', e.target.value)}
              required
              maxLength={80}
            />
          </label>
          <button className="button primary create-button" type="submit">
            进入 CEO 经营桌面
            <ArrowRight size={17} />
          </button>
          <p className="creation-note">进度自动保存在当前浏览器，也可导出为本地存档。</p>
        </form>
      </div>
    </div>
  );
}
