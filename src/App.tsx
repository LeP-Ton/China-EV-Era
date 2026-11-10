import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cpu,
  Download,
  Factory,
  FastForward,
  FileText,
  Flag,
  History,
  LayoutDashboard,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Trophy,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  advanceWeek,
  applyCommand,
  createGame,
  gameDate,
  replayGame,
  STRATEGIES,
  type Command,
  type GameState,
  type Module,
  type NewGameOptions,
} from './engine';
import {
  loadLocal,
  loadRankings,
  parseGame,
  rankingOf,
  recordRanking,
  saveLocal,
  serializeGame,
  type Ranking,
} from './persistence';
import { CreateGame } from './ui/CreateGame';
import { Dashboard, PlanEditor } from './ui/Dashboard';
import { Finance, ReportContent } from './ui/Finance';
import { Market } from './ui/Market';
import { Office } from './ui/Office';
import { Production } from './ui/Production';
import { Research } from './ui/Research';
import { Badge, Brand, Empty, Hint, Modal } from './ui/shared';
import { integer, money, pct, weekLabel } from './ui/format';

const modules = [
  {
    id: 'dashboard' as const,
    name: 'CEO 经营驾驶舱',
    short: '经营驾驶舱',
    en: 'CEO CONSOLE',
    icon: LayoutDashboard,
    description: '从全局出发，让每一个决策都有据可依。',
  },
  {
    id: 'research' as const,
    name: '车型与技术研发',
    short: '车型与技术研发',
    en: 'PRODUCT & TECHNOLOGY',
    icon: Cpu,
    description: '定义产品，积累技术，把投入变成可交付的价值。',
  },
  {
    id: 'production' as const,
    name: '生产与供应链',
    short: '生产与供应链',
    en: 'MANUFACTURING & QUALITY',
    icon: Factory,
    description: '平衡产能与订单，为每一辆交付承担责任。',
  },
  {
    id: 'finance' as const,
    name: '财务与资本',
    short: '财务与资本',
    en: 'FINANCE & CAPITAL',
    icon: Wallet,
    description: '看清利润，也看清支撑下一程的现金。',
  },
  {
    id: 'market' as const,
    name: '舆论与市场',
    short: '舆论与市场',
    en: 'MARKET INTELLIGENCE',
    icon: BarChart3,
    description: '读懂消费者的偏好，听见市场的真实声音。',
  },
  {
    id: 'office' as const,
    name: '企业办公通信',
    short: '企业办公通信',
    en: 'EXECUTIVE COMMUNICATIONS',
    icon: MessageSquare,
    description: '让专业的人自主执行，在关键时刻做出判断。',
  },
];
type Dialog = 'plan' | 'save' | 'help' | 'report' | 'history' | 'outcome' | 'rankings' | null;

function downloadSave(s: GameState) {
  const blob = new Blob([serializeGame(s)], { type: 'application/json' });
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `GameX-${s.company.brand}-W${s.week}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Timeline({ state, onReplay }: { state: GameState; onReplay: () => void }) {
  const [filter, setFilter] = useState('all');
  const options = {
    all: '全部记录',
    player: 'CEO 决策',
    npc: '高管行动',
    market: '市场竞争',
    quality: '质量与召回',
    finance: '财务结算',
    milestone: '企业里程碑',
  };
  return (
    <>
      <div className="timeline-toolbar">
        <select
          value={filter}
          aria-label="筛选企业历史"
          onChange={(e) => setFilter(e.target.value)}
        >
          {Object.entries(options).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
        <button className="button small" onClick={onReplay}>
          <History size={15} />
          校验种子复盘
        </button>
      </div>
      <Hint>
        种子 {state.seed} · {state.decisions.length} 次 CEO 决策 · {state.week}{' '}
        个经营周。复盘会重新执行相同指令，核对真实经营状态。
      </Hint>
      <div className="timeline">
        {state.history
          .slice()
          .reverse()
          .filter((e) => filter === 'all' || e.kind === filter)
          .map((e) => (
            <article key={e.id} className={`timeline-event ${e.tone}`}>
              <i />
              <div>
                <small>
                  {weekLabel(e.week)} · {options[e.kind]}
                </small>
                <h4>{e.title}</h4>
                <p>{e.detail}</p>
              </div>
            </article>
          ))}
      </div>
    </>
  );
}

function Rankings({ state }: { state: GameState }) {
  const [sort, setSort] = useState<keyof Ranking>('valuation');
  const current = rankingOf(state);
  const rows = [current, ...loadRankings().filter((r) => r.id !== current.id)].sort(
    (a, b) => Number(b[sort]) - Number(a[sort]),
  );
  return (
    <>
      <div className="timeline-toolbar">
        <p className="muted">当前企业与本浏览器已结算的历史企业</p>
        <select
          value={sort}
          aria-label="排行榜排序"
          onChange={(e) => setSort(e.target.value as keyof Ranking)}
        >
          {Object.entries({
            valuation: '最高估值',
            profit: '累计利润',
            delivered: '累计交付',
            share: '市场份额',
            tech: '技术实力',
            reputation: '品牌声誉',
            weeks: '存续时间',
          }).map(([key, text]) => (
            <option value={key} key={key}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>排名 / 企业</th>
              <th className="num">最高估值 / 亿</th>
              <th className="num">利润 / 亿</th>
              <th className="num">累计交付</th>
              <th className="num">声誉</th>
              <th className="num">质量事件</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>
                  <strong>
                    {i + 1}. {r.name}
                  </strong>
                  <small className="table-sub">
                    {STRATEGIES[r.strategy].name} · 存续 {r.weeks} 周
                  </small>
                </td>
                <td className="num">{money(r.valuation)}</td>
                <td className="num">{money(r.profit)}</td>
                <td className="num">{integer(r.delivered)}</td>
                <td className="num">{r.reputation.toFixed(1)}</td>
                <td className="num">{r.incidents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine-print">
        多维成绩各自独立，没有单一胜利分数。技术等级合计 {current.tech}，当前交付份额{' '}
        {pct(current.share)}。
      </p>
    </>
  );
}

export default function App() {
  const [initial] = useState(() => {
    try {
      return { game: loadLocal('auto'), error: '' };
    } catch (error) {
      return { game: null, error: (error as Error).message };
    }
  });
  const [game, setGame] = useState<GameState | null>(initial.game);
  const gameRef = useRef(game);
  gameRef.current = game;
  const [module, setModule] = useState<Module>('dashboard');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [endWeek, setEndWeek] = useState(13);
  const [restart, setRestart] = useState(false);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    initial.error ? { text: initial.error, error: true } : null,
  );
  const [saveStatus, setSaveStatus] = useState('已开启自动保存');
  const [reportIndex, setReportIndex] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastReportCount = useRef(game?.reports.length ?? 0);
  const endRecorded = useRef('');
  const notify = useCallback((text: string, error = false) => setToast({ text, error }), []);
  const closeDialog = useCallback(() => setDialog(null), []);
  const navigate = useCallback((target: Module) => {
    setModule(target);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  const dispatch = useCallback(
    (action: Command) => {
      const previous = gameRef.current;
      if (!previous) return;
      const result = applyCommand(previous, action);
      gameRef.current = result.state;
      setGame(result.state);
      if (result.message) notify(result.message, !result.ok);
    },
    [notify],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const saveNow = () => {
      if (gameRef.current) {
        try {
          saveLocal(gameRef.current, 'auto');
        } catch {
          /* 页面退出时不阻塞，可在存档中心手动导出。 */
        }
      }
    };
    window.addEventListener('pagehide', saveNow);
    return () => window.removeEventListener('pagehide', saveNow);
  }, []);
  useEffect(() => {
    if (!game) return;
    setSaveStatus('正在保存…');
    const timer = setTimeout(() => {
      try {
        saveLocal(game, 'auto');
        setSaveStatus('已自动保存到本地');
      } catch {
        setSaveStatus('保存失败，请导出存档');
        notify('浏览器存储不可用或已满，请在存档中心导出当前进度。', true);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [game, notify]);
  useEffect(() => {
    if (!game || !running) return;
    if (game.status !== 'active' || game.pause || game.week >= endWeek) {
      setRunning(false);
      return;
    }
    const timer = setTimeout(
      () => setGame((current) => (current ? advanceWeek(current) : current)),
      speed === 1 ? 1000 : 140,
    );
    return () => clearTimeout(timer);
  }, [game, running, endWeek, speed]);
  useEffect(() => {
    if (!game) return;
    if (game.reports.length > lastReportCount.current && game.status === 'active') {
      setReportIndex(game.reports.length - 1);
      setDialog('report');
      setRunning(false);
    }
    lastReportCount.current = game.reports.length;
    if (
      game.status !== 'active' &&
      endRecorded.current !== `${game.seed}-${game.week}-${game.status}`
    ) {
      endRecorded.current = `${game.seed}-${game.week}-${game.status}`;
      setRunning(false);
      setDialog('outcome');
      try {
        recordRanking(game);
      } catch {
        notify('历史排行保存失败，仍可导出本局存档。', true);
      }
    }
  }, [game, notify]);

  const create = (options: NewGameOptions) => {
    const state = createGame(options);
    lastReportCount.current = 0;
    endRecorded.current = '';
    setGame(state);
    setRestart(false);
    setRunning(false);
    setModule('dashboard');
    setDialog(null);
    notify(`${state.company.name}已成立。首款产品与管理团队已就位。`);
  };
  const restore = (restored: GameState) => {
    lastReportCount.current = restored.reports.length;
    endRecorded.current =
      restored.status === 'active' ? '' : `${restored.seed}-${restored.week}-${restored.status}`;
    setRunning(false);
    setGame(restored);
    setDialog(null);
    notify(`已恢复 ${weekLabel(restored.week)} 的企业进度。`);
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      restore(parseGame(await file.text()));
    } catch (error) {
      notify((error as Error).message, true);
    }
    event.target.value = '';
  };

  if (!game || restart)
    return (
      <>
        <CreateGame
          onCreate={create}
          initialOptions={
            game
              ? {
                  name: game.company.name,
                  brand: game.company.brand,
                  model: game.product.name,
                  strategy: game.company.strategy,
                  seed: game.seed,
                }
              : undefined
          }
          onCancel={game ? () => setRestart(false) : undefined}
        />
        {toast && (
          <div className={`toast ${toast.error ? 'error' : ''}`} role="status">
            {toast.text}
            <button onClick={() => setToast(null)} aria-label="关闭通知">
              <X size={14} />
            </button>
          </div>
        )}
      </>
    );
  const s = game;
  const selectedModule = modules.find((m) => m.id === module)!;
  const unread = s.messages.filter((m) => !m.read).length;
  const start = (fast = false) => {
    if (running && !fast) {
      setRunning(false);
      return;
    }
    if (fast) setSpeed(6);
    dispatch({ type: 'acknowledge' });
    setEndWeek(Math.min(156, (Math.floor(s.week / 13) + 1) * 13));
    setRunning(true);
  };
  const openReport = () => {
    if (s.reports.length) {
      setReportIndex(s.reports.length - 1);
      setDialog('report');
    } else notify('推进至第 13 周结算后，将生成第一份季度报告。');
  };
  const props = { state: s, dispatch, navigate };
  const report = s.reports[reportIndex];
  const replay = () => {
    try {
      const result = replayGame(s);
      notify(
        result.verified
          ? `复盘一致：${s.week} 周、${s.decisions.length} 次决策，经营状态校验码 ${result.fingerprint}。`
          : '复盘校验未通过，请保留存档用于排查。',
        !result.verified,
      );
    } catch (error) {
      notify((error as Error).message, true);
    }
  };
  return (
    <div className="app-shell" data-week={s.week} data-status={s.status}>
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <Brand />
        <div className="company-switch">
          <span className="company-logo">{s.company.brand.charAt(0)}</span>
          <div>
            <strong>{s.company.name}</strong>
            <small>{s.company.brand} · 创始人工作台</small>
          </div>
        </div>
        <div className="nav-label">企业工作空间</div>
        <nav>
          {modules.map((item) => (
            <button
              key={item.id}
              aria-label={item.name}
              className={module === item.id ? 'active' : ''}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span>{item.name}</span>
              {item.id === 'office' && unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
              {item.id === module && item.id !== 'office' && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-tools">
          <div className="nav-label">企业档案</div>
          <button
            onClick={() => {
              setRunning(false);
              setDialog('history');
            }}
          >
            <History size={18} />
            企业历史与复盘
          </button>
          <button onClick={() => setDialog('rankings')}>
            <Trophy size={18} />
            成就与本地排行
          </button>
          <button
            onClick={() => {
              setRunning(false);
              setDialog('save');
            }}
          >
            <Save size={18} />
            存档中心
          </button>
        </div>
        <div className="sidebar-footer">
          <div className="system-status">
            <i className="online-dot" />
            {s.status === 'active' ? '企业系统正常运行' : '本局经营已结算'}
          </div>
          <button onClick={() => setDialog('help')}>
            <CircleHelp size={17} />
            <span>经营指南</span>
            <span>V1.0</span>
          </button>
          <div className="ceo-profile">
            <span>CEO</span>
            <div>
              <strong>创始人</strong>
              <small>{STRATEGIES[s.company.strategy].name} · 由你掌舵</small>
            </div>
            <Settings2 size={16} />
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button nav-toggle"
              aria-label="打开导航"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu size={20} />
            </button>
            <span>工作空间</span>
            <ChevronRight size={13} />
            <strong>{selectedModule.short}</strong>
          </div>
          <div className="topbar-actions">
            <span className="autosave-status">
              <CheckCircle2 size={13} />
              {saveStatus}
            </span>
            <button
              className="icon-button notification-button"
              aria-label={`办公消息，${unread} 条未读`}
              onClick={() => navigate('office')}
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label="打开存档中心"
              onClick={() => {
                setRunning(false);
                setDialog('save');
              }}
            >
              <MoreHorizontal size={21} />
            </button>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">{selectedModule.en}</span>
              <h1>
                {selectedModule.short}
                <span className="version-pill">{module === 'dashboard' ? 'LIVE' : 'GAMEX'}</span>
              </h1>
              <p>{selectedModule.description}</p>
            </div>
            <div className="page-heading-actions">
              <button className="button" onClick={openReport}>
                <FileText size={15} />
                季度报告
              </button>
              <button
                className="button primary"
                onClick={() => {
                  setRunning(false);
                  setDialog('plan');
                }}
              >
                <Settings2 size={15} />
                配置经营计划
              </button>
            </div>
          </div>
          <div className="timebar">
            <div className="game-date">
              <CalendarDays size={17} />
              <strong>{gameDate(s.week)}</strong>
              <span>第 {s.week >= 156 ? 13 : (s.week % 13) + 1} 周 / 13</span>
              <div className="time-progress">
                <i style={{ width: `${s.week >= 156 ? 100 : ((s.week % 13) / 13) * 100}%` }} />
              </div>
              <small>经营进程 {Math.min(12, Math.floor(s.week / 13) + 1)} / 12 季度</small>
            </div>
            <div className="timebar-controls">
              <Badge tone={running ? 'positive' : 'neutral'}>
                {s.status !== 'active' ? '已结算' : running ? '自动运营中' : '时间已暂停'}
              </Badge>
              <div className="speed-switch">
                <button className={speed === 1 ? 'active' : ''} onClick={() => setSpeed(1)}>
                  1×
                </button>
                <button className={speed === 6 ? 'active' : ''} onClick={() => setSpeed(6)}>
                  6×
                </button>
              </div>
              <button
                className="icon-button"
                disabled={s.status !== 'active'}
                title="单周推进"
                aria-label="单周推进"
                onClick={() => {
                  setRunning(false);
                  setGame(advanceWeek(s));
                }}
              >
                <SkipForward size={17} />
              </button>
              <button
                className="button small time-play"
                disabled={s.status !== 'active'}
                onClick={() => start()}
              >
                {running ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                {running ? '暂停' : '开始运营'}
              </button>
              <button
                className="icon-button"
                disabled={s.status !== 'active'}
                title="快速推进至季末，重大事件暂停"
                aria-label="快速推进至季末"
                onClick={() => start(true)}
              >
                <FastForward size={18} />
              </button>
            </div>
          </div>
          <div className="attention-strip">
            <div>
              <Sparkles size={14} />
              <span>
                本月 CEO 注意力 <strong>{s.attention.available}</strong>
                <small>/ 10</small>
              </span>
              <div className="attention-pips">
                {Array.from({ length: 10 }, (_, i) => (
                  <i key={i} className={i < s.attention.available ? 'filled' : ''} />
                ))}
              </div>
            </div>
            <p>
              把精力留给关键决策，日常运营交给团队。
              <button onClick={() => setDialog('help')}>
                了解机制
                <ChevronRight size={12} />
              </button>
            </p>
          </div>
          {s.pause && (
            <div
              className={`event-banner ${s.pause.target === 'production' ? 'danger' : ''}`}
              role="alert"
            >
              <span className="event-banner-icon">
                <Flag size={19} />
              </span>
              <div>
                <strong>{s.pause.title}</strong>
                <p>{s.pause.detail}</p>
              </div>
              <button className="button small" onClick={() => navigate(s.pause!.target)}>
                前往查看
                <ArrowRight size={14} />
              </button>
              <button
                className="icon-button"
                aria-label="收起事件提示"
                onClick={() => dispatch({ type: 'acknowledge' })}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div className="view-content" key={module}>
            {module === 'dashboard' && (
              <Dashboard {...props} openPlan={() => setDialog('plan')} openReport={openReport} />
            )}
            {module === 'research' && <Research {...props} openPlan={() => setDialog('plan')} />}
            {module === 'production' && (
              <Production {...props} openPlan={() => setDialog('plan')} />
            )}
            {module === 'finance' && <Finance {...props} openReport={openReport} />}
            {module === 'market' && <Market {...props} />}
            {module === 'office' && <Office {...props} />}
          </div>
          <footer className="main-footer">
            <span>GameX · 决策有迹可循，未来由你定义。</span>
            <span>
              本地模拟 <i />
              种子 {s.seed}
              <i />
              {weekLabel(s.week)}
            </span>
          </footer>
        </main>
      </div>
      {dialog === 'plan' && (
        <Modal title="季度经营计划" eyebrow="STRATEGIC PLANNING" onClose={closeDialog}>
          <PlanEditor state={s} dispatch={dispatch} onDone={closeDialog} />
        </Modal>
      )}
      {dialog === 'save' && (
        <Modal title="存档中心" eyebrow="YOUR COMPANY, YOUR HISTORY" onClose={closeDialog}>
          <Hint>自动存档保存当前进度。手动快照独立保存；载入会替换当前进度，建议先导出备份。</Hint>
          <div className="save-snapshot">
            <div className="company-logo">{s.company.brand.charAt(0)}</div>
            <div>
              <strong>{s.company.name}</strong>
              <p>
                {weekLabel(s.week)} · 现金 {money(s.company.cash)} 亿元
              </p>
            </div>
            <Badge tone="positive">{saveStatus}</Badge>
          </div>
          <div className="save-actions">
            <button
              onClick={() => {
                try {
                  saveLocal(s, 'manual');
                  notify('手动快照已保存，可随时载入。');
                } catch {
                  notify('保存失败，请导出存档。', true);
                }
              }}
            >
              <Save />
              <strong>保存手动快照</strong>
              <small>覆盖上一次手动快照</small>
            </button>
            <button
              onClick={() => {
                try {
                  const stored = loadLocal('manual');
                  if (stored) restore(stored);
                  else notify('尚未保存过手动快照。', true);
                } catch (error) {
                  notify((error as Error).message, true);
                }
              }}
            >
              <History />
              <strong>载入手动快照</strong>
              <small>回到上一次保存的时刻</small>
            </button>
            <button
              onClick={() => {
                downloadSave(s);
                notify('存档已导出，包含随机数状态、决策与完整经营记录。');
              }}
            >
              <Download />
              <strong>导出存档文件</strong>
              <small>下载完整 JSON 存档</small>
            </button>
            <button onClick={() => fileInput.current?.click()}>
              <Upload />
              <strong>导入本地存档</strong>
              <small>校验通过后恢复进度</small>
            </button>
          </div>
          <div className="restart-row">
            <div>
              <strong>开始另一段企业旅程</strong>
              <p>可选择新的战略或复用当前种子。新企业会替换自动进度，手动快照仍然保留。</p>
            </div>
            <button
              className="button"
              onClick={() => {
                setRunning(false);
                setRestart(true);
                setDialog(null);
              }}
            >
              重新开始
              <ArrowRight size={15} />
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            onChange={importFile}
            hidden
          />
        </Modal>
      )}
      {dialog === 'help' && (
        <Modal
          title="你的 CEO 经营指南"
          eyebrow="A FEW THINGS BEFORE THE NEXT DECISION"
          onClose={closeDialog}
          wide
        >
          <div className="help-grid">
            <article>
              <span>01</span>
              <h3>把战略变成产品</h3>
              <p>
                先确认车型配置与研发方式。研发按周执行，成熟平台、精简功能和增加团队均可提速；压缩验证则会增加潜在缺陷。准备就绪后批准上市，消费者才会产生真实订单。
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>每 13 周，重新校准</h3>
              <p>
                每季有 13 周，总计 12
                季度。可以单周推进、自动运营或快速至季末。重大事件会暂停，季度末生成报告；调整预算会在下一周生效。
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>团队值得被授权</h3>
              <p>
                CTO 自主立项和上市，CFO
                在有限授信内保证现金，运营高管协调生产并调查和召回。目标不同，执行方式也不同。关闭自主授权后，日常执行仍继续，重大决策由你负责。
              </p>
            </article>
            <article>
              <span>04</span>
              <h3>注意力，用在关键处</h3>
              <p>
                每月 10 点，季度内第 1、5、9 周刷新，不累计。研发/生产/财务专项 2 点，质量调查 3
                点，召回协调 2 点，补充报告 1 点。浏览、战略调整、定价和融资不消耗注意力。
              </p>
            </article>
            <article>
              <span>05</span>
              <h3>利润与现金各有含义</h3>
              <p>
                订单不等于收入，生产采购先占用现金，实际交付才产生收入并结转成本。融资不是营收，建厂不是当期费用。高估值不能支付工资，现金耗尽会破产。
              </p>
            </article>
            <article>
              <span>06</span>
              <h3>口碑来自真实的责任</h3>
              <p>
                质量问题来自特定历史批次，随保有量和车龄逐步暴露。调查确认原因，报告公开事实，召回修复缺陷。公关改变传播，不能消除真实缺陷。忽略安全预警会导致强制暂停。
              </p>
            </article>
          </div>
          <Hint>
            全部企业、供应商、数据和监管机制均为游戏模拟。市场份额指本局的虚构细分市场。辅助驾驶等级是游戏配置指标。
          </Hint>
          <button className="button primary full" onClick={closeDialog}>
            了解，开始经营
            <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {dialog === 'report' && report && (
        <Modal
          title={`${2026 + Math.floor((report.quarter - 1) / 4)} 年 Q${((report.quarter - 1) % 4) + 1} 经营报告`}
          eyebrow="QUARTERLY BUSINESS REVIEW"
          onClose={closeDialog}
          wide
        >
          <div className="report-tabs">
            {s.reports.map((r, i) => (
              <button
                className={i === reportIndex ? 'active' : ''}
                key={r.quarter}
                onClick={() => setReportIndex(i)}
              >
                第 {r.quarter} 季度
              </button>
            ))}
          </div>
          <ReportContent report={report} />
          <div className="form-actions">
            <button
              className="button"
              onClick={() => {
                closeDialog();
                navigate('finance');
              }}
            >
              查看财务明细
            </button>
            <button
              className="button primary"
              disabled={s.status !== 'active'}
              onClick={() => setDialog('plan')}
            >
              配置下一阶段计划
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'history' && (
        <Modal
          title="企业历史与复盘"
          eyebrow="EVERY DECISION LEAVES A TRACE"
          onClose={closeDialog}
          wide
        >
          <Timeline state={s} onReplay={replay} />
        </Modal>
      )}
      {dialog === 'rankings' && (
        <Modal
          title="成就与本地排行"
          eyebrow="SUCCESS HAS MORE THAN ONE MEASURE"
          onClose={closeDialog}
          wide
        >
          <div className="achievement-list">
            {s.achievements.length ? (
              s.history
                .filter((e) => e.kind === 'milestone')
                .map((e) => (
                  <Badge key={e.id} tone="positive">
                    <Trophy size={13} />
                    {e.title}
                  </Badge>
                ))
            ) : (
              <p className="muted">第一项里程碑，等待你的决策。</p>
            )}
          </div>
          <Rankings state={s} />
        </Modal>
      )}
      {dialog === 'outcome' && (
        <Modal
          title={
            s.status === 'completed' ? '三年，一家由你定义的车企。' : '这段创业旅程，留下了答案。'
          }
          eyebrow={s.status === 'completed' ? 'YOUR COMPANY · YOUR LEGACY' : 'BUSINESS REVIEW'}
          onClose={closeDialog}
          wide
        >
          <div className="outcome-hero">
            <Trophy size={36} />
            <p>
              {s.company.name} · {STRATEGIES[s.company.strategy].name}
            </p>
            <h3>
              {s.status === 'completed' ? '完成 12 季度经营' : `存续 ${s.week} 周，进入破产清算`}
            </h3>
            <span>利润、规模、技术与安全，都是你的企业留下的成绩。</span>
          </div>
          <div className="outcome-stats">
            {[
              { label: '最高企业估值', value: `${money(s.company.peakValuation)} 亿` },
              { label: '累计净利润', value: `${money(s.company.totalProfit)} 亿` },
              { label: '累计汽车交付', value: `${integer(s.product.totalDelivered)} 辆` },
              { label: '最终市场份额', value: pct(s.weekly.at(-1)?.share ?? 0) },
              {
                label: '基础技术等级',
                value: `合计 Lv.${Object.values(s.tech).reduce((a, t) => a + t.level, 0)}`,
              },
              {
                label: '质量事件记录',
                value: `${s.cases.length} 起 · 已处置 ${s.cases.filter((c) => c.status === 'closed').length}`,
              },
            ].map((v) => (
              <div key={v.label}>
                <span>{v.label}</span>
                <strong>{v.value}</strong>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button className="button" onClick={() => setDialog('history')}>
              回看关键转折
            </button>
            <button
              className="button"
              onClick={() => {
                downloadSave(s);
                notify('本局经营档案已导出。');
              }}
            >
              导出本局档案
            </button>
            <button
              className="button primary"
              onClick={() => {
                setRestart(true);
                setDialog(null);
              }}
            >
              创立下一家企业
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className={`toast ${toast.error ? 'error' : ''}`} role="status">
          {toast.error ? <Flag size={17} /> : <CheckCircle2 size={17} />}
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="关闭通知">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
