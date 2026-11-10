import { ArrowDownRight, ArrowUpRight, ChevronRight, Info, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { Command, GameState, Module, Tone } from '../engine';
import { money } from './format';
import carRenderUrl from '../assets/vehicles/nev-sedan-render.webp';

export interface ViewProps {
  state: GameState;
  dispatch: (command: Command) => void;
  navigate: (module: Module) => void;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark">
        <i />
        <i />
      </div>
      <div>
        <strong>
          Game<span>X</span>
        </strong>
        {!compact && <small>新能源汽车经营系统</small>}
      </div>
    </div>
  );
}
export function Badge({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: Tone | 'neutral';
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Metric({
  label,
  value,
  unit,
  detail,
  icon: Icon,
  tone = '',
  change,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  detail: string;
  icon: LucideIcon;
  tone?: string;
  change?: number;
}) {
  return (
    <div className={`metric ${tone}`}>
      <div className="metric-label">
        {label}
        <Icon size={17} strokeWidth={1.6} />
      </div>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      <div className="metric-foot">
        {change !== undefined && (
          <span className={change >= 0 ? 'positive-text' : 'negative-text'}>
            {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        <span>{detail}</span>
      </div>
    </div>
  );
}
export function Progress({ value, color = 'blue' }: { value: number; color?: string }) {
  return (
    <div className={`progress ${color}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="hint">
      <Info size={15} />
      <span>{children}</span>
    </div>
  );
}
export function Jump({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ChevronRight size={14} />
    </button>
  );
}
export function Empty({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={24} />
      </div>
      <h4>{title}</h4>
      <p>{children}</p>
    </div>
  );
}

export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, textarea, a[href]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? 'wide' : ''}`}
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <div>
            {eyebrow && <small className="eyebrow">{eyebrow}</small>}
            <h2>{title}</h2>
          </div>
          <button className="icon-button" aria-label="关闭弹窗" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TrendChart({
  state,
  mode = 'operations',
  height = 220,
}: {
  state: GameState;
  mode?: 'operations' | 'cash';
  height?: number;
}) {
  const history = state.weekly.slice(-26);
  const prior = state.weekly.find((w) => w.week === (history[0]?.week ?? 1) - 1);
  const series1 =
    mode === 'cash'
      ? [prior?.cash ?? state.company.initialCash, ...history.map((w) => w.cash)]
      : [prior?.revenue ?? 0, ...history.map((w) => w.revenue)];
  const series2 = mode === 'cash' ? [] : [prior?.profit ?? 0, ...history.map((w) => w.profit)];
  const max = Math.max(history.length ? 10 : 100, ...series1, ...series2) * 1.15;
  const min = Math.min(0, ...series1, ...series2) * 1.2;
  const width = 680,
    top = 14,
    bottom = height - 30,
    left = 44,
    right = width - 15;
  const y = (v: number) => bottom - ((v - min) / (max - min)) * (bottom - top);
  const x = (i: number) => left + (i / Math.max(series1.length - 1, 1)) * (right - left);
  const path = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="trend-chart"
        role="img"
        aria-label={mode === 'cash' ? '现金余额历史趋势，单位亿元' : '周度营收与利润趋势，单位亿元'}
      >
        <defs>
          <linearGradient id={`chart-fill-${mode}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#315ce8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#315ce8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => {
          const value = min + ((max - min) * i) / 4;
          return (
            <g key={i}>
              <line
                x1={left}
                x2={right}
                y1={y(value)}
                y2={y(value)}
                stroke="#ebeff5"
                strokeDasharray="3 4"
              />
              <text x={left - 10} y={y(value) + 4} textAnchor="end" className="axis">
                {money(value, max - min < 50 ? 2 : 1)}
              </text>
            </g>
          );
        })}
        {history.length > 0 && (
          <>
            <path
              d={`${path(series1)} L${x(series1.length - 1)},${y(0)} L${left},${y(0)}Z`}
              fill={`url(#chart-fill-${mode})`}
            />
            <path
              d={path(series1)}
              stroke="#345ae4"
              strokeWidth="2.5"
              fill="none"
              strokeLinejoin="round"
            />
            {series2.length > 0 && (
              <path
                d={path(series2)}
                stroke="#28a89b"
                strokeWidth="2"
                fill="none"
                strokeLinejoin="round"
              />
            )}
          </>
        )}
        {[0, Math.floor((series1.length - 1) / 2), series1.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i) => (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="axis">
              {i === 0
                ? history.length >= 26
                  ? `W${history[0].week - 1}`
                  : '创立日'
                : `W${history[i - 1]?.week ?? 0}`}
            </text>
          ))}
      </svg>
      {history.length === 0 && (
        <div className="chart-placeholder">
          <strong>第一条曲线，从你的决策开始</strong>
          <span>推进经营时间后，这里会显示真实的周度数据</span>
        </div>
      )}
    </div>
  );
}

export function CarRender({ className = '' }: { className?: string }) {
  return (
    <img
      className={`car-render ${className}`}
      src={carRenderUrl}
      alt="银色新能源汽车概念渲染"
      width={1774}
      height={887}
      loading="eager"
      decoding="async"
      draggable={false}
    />
  );
}
