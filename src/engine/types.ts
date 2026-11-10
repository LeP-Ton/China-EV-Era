export type Strategy = 'technology' | 'value' | 'premium' | 'marketing' | 'quality';
export type TechKey = 'battery' | 'driving' | 'safety';
export type Module = 'dashboard' | 'research' | 'production' | 'finance' | 'market' | 'office';
export type Supplier = 'established' | 'premium' | 'unverified';
export type DevelopmentMode = 'standard' | 'investment' | 'supplier' | 'lean' | 'rushed';
export type ExecutiveRole = 'cto' | 'cfo' | 'coo';
export type Tone = 'info' | 'positive' | 'warning' | 'danger';

export interface Plan {
  research: number;
  marketing: number;
  quality: number;
  productionTarget: number;
  techFocus: TechKey;
}

export interface Product {
  name: string;
  type: '轿车' | 'SUV' | 'MPV';
  segment: 'economy' | 'mainstream' | 'premium';
  price: number;
  battery: 'LFP' | 'NMC';
  batteryCapacity: number;
  performance: number;
  driving: number;
  cabin: number;
  safety: number;
  status: 'draft' | 'developing' | 'ready' | 'selling';
  mode: DevelopmentMode;
  progress: number;
  validation: number;
  startedWeek: number | null;
  readyWeek: number | null;
  launchWeek: number | null;
  launchValidation: number;
  halted: boolean;
  haltReason: 'none' | 'manual' | 'safety' | 'recall';
  backlog: number;
  inventory: number;
  totalOrders: number;
  totalCanceled: number;
  totalDelivered: number;
}

export interface Executive {
  id: ExecutiveRole;
  name: string;
  title: string;
  specialty: string;
  expertise: number;
  management: number;
  risk: number;
  personality: string;
  motivation: number;
  trust: number;
  autonomous: boolean;
  holdUntil: number;
  goal: 'balanced' | 'growth' | 'reliability';
  lastAction: string;
}

export interface Rival {
  id: string;
  name: string;
  brand: string;
  model: string;
  strategy: Strategy;
  price: number;
  range: number;
  performance: number;
  driving: number;
  cabin: number;
  safety: number;
  reputation: number;
  cash: number;
  debt: number;
  capacity: number;
  constructionWeeks: number;
  pendingCapacity: number;
  marketing: number;
  unitCost: number;
  backlog: number;
  totalDelivered: number;
  weeklyDelivered: number;
  share: number;
  researchProgress: number;
  generation: number;
  active: boolean;
  lastAction: string;
}

export interface Batch {
  id: string;
  week: number;
  units: number;
  delivered: number;
  unitCost: number;
  deliveries: { week: number; units: number }[];
  defectRate: number;
  latency: number;
  complaints: number;
  repaired: boolean;
  source: {
    validation: number;
    supplier: Supplier;
    qualityBudget: number;
    ramp: number;
    mode: DevelopmentMode;
  };
}

export interface QualityCase {
  id: string;
  title: string;
  batchIds: string[];
  openedWeek: number;
  investigatedWeek: number | null;
  status: 'warning' | 'investigating' | 'closed';
  severity: number;
  evidence: number;
  complaints: number;
  reported: boolean;
  recalled: number;
  findings: string[];
}

export interface Topic {
  id: string;
  title: string;
  channel: '汽车媒体' | '车主社区' | '微博热搜' | '短视频' | '汽车论坛' | '企业公告';
  actor: string;
  severity: number;
  credibility: number;
  heat: number;
  sentiment: number;
  bornWeek: number;
  caseId?: string;
}

export interface Message {
  id: string;
  week: number;
  from: string;
  role: string;
  title: string;
  body: string;
  tone: Tone;
  target: Module;
  read: boolean;
}

export interface HistoryEvent {
  id: string;
  week: number;
  kind: 'player' | 'npc' | 'market' | 'quality' | 'finance' | 'milestone';
  title: string;
  detail: string;
  tone: Tone;
}

export interface PeriodFinance {
  revenue: number;
  cogs: number;
  productionCash: number;
  research: number;
  marketing: number;
  quality: number;
  payroll: number;
  fixed: number;
  interest: number;
  aftersales: number;
  capex: number;
  financing: number;
  profit: number;
  delivered: number;
  orders: number;
  canceled: number;
}

export interface Transaction {
  id: string;
  week: number;
  category: string;
  label: string;
  cashDelta: number;
  profitDelta: number;
  balance: number;
}

export interface WeeklyRecord {
  week: number;
  cash: number;
  revenue: number;
  profit: number;
  delivered: number;
  produced: number;
  orders: number;
  canceled: number;
  backlog: number;
  inventory: number;
  share: number;
  reputation: number;
  valuation: number;
  complaints: number;
  potentialDemand: number;
}

export interface QuarterReport extends PeriodFinance {
  quarter: number;
  cash: number;
  debt: number;
  share: number;
  reputation: number;
  valuation: number;
  inventory: number;
  causes: string[];
}

export interface GameState {
  version: 1;
  setup: NewGameOptions;
  seed: string;
  rng: number;
  nextId: number;
  week: number;
  status: 'active' | 'completed' | 'bankrupt';
  company: {
    name: string;
    brand: string;
    strategy: Strategy;
    cash: number;
    initialCash: number;
    debt: number;
    ownership: number;
    reputation: number;
    valuation: number;
    peakValuation: number;
    totalProfit: number;
    totalRevenue: number;
    lastEquityWeek: number;
  };
  plan: Plan;
  product: Product;
  tech: Record<TechKey, { level: number; progress: number }>;
  executives: Executive[];
  rivals: Rival[];
  manufacturing: {
    capacity: number;
    owned: boolean;
    supplier: Supplier;
    expansions: { id: string; remaining: number; capacity: number; owned: boolean }[];
    lastProduced: number;
  };
  attention: { available: number; month: number; spent: number };
  focus: { research: number; operations: number; finance: number };
  batches: Batch[];
  cases: QualityCase[];
  topics: Topic[];
  messages: Message[];
  history: HistoryEvent[];
  transactions: Transaction[];
  decisions: { week: number; action: Command }[];
  weekly: WeeklyRecord[];
  reports: QuarterReport[];
  period: PeriodFinance;
  periodQuarter: number;
  pause: { title: string; detail: string; target: Module } | null;
  achievements: string[];
  market: { demand: number; shares: Record<string, number>; outsideShare: number };
}

export type Command =
  | { type: 'plan'; values: Partial<Plan> }
  | {
      type: 'product';
      values: Partial<
        Pick<
          Product,
          | 'name'
          | 'type'
          | 'segment'
          | 'price'
          | 'battery'
          | 'batteryCapacity'
          | 'performance'
          | 'driving'
          | 'cabin'
          | 'safety'
        >
      >;
    }
  | { type: 'develop'; mode: DevelopmentMode }
  | { type: 'launch' }
  | { type: 'supplier'; supplier: Supplier }
  | { type: 'expand'; owned: boolean }
  | { type: 'loan'; amount: number }
  | { type: 'repay'; amount: number }
  | { type: 'equity'; amount: number }
  | { type: 'focus'; area: 'research' | 'operations' | 'finance' }
  | { type: 'investigate'; caseId: string }
  | { type: 'report'; caseId: string }
  | { type: 'recall'; caseId: string }
  | { type: 'halt'; value: boolean }
  | { type: 'press' }
  | { type: 'requestReport'; messageId: string }
  | { type: 'defer'; messageId: string }
  | { type: 'executive'; id: ExecutiveRole; autonomous?: boolean; goal?: Executive['goal'] }
  | { type: 'read'; messageId: string }
  | { type: 'acknowledge' };

export interface NewGameOptions {
  name: string;
  brand: string;
  model: string;
  strategy: Strategy;
  seed: string;
}
export interface CommandResult {
  state: GameState;
  ok: boolean;
  message: string;
}
