import type { DevelopmentMode, Plan, Strategy, Supplier } from './types';

export const CONFIG = {
  weeksPerQuarter: 13,
  quarters: 12,
  maxWeeks: 156,
  attentionPerMonth: 10,
  baseWeeklyDemand: 7200,
  annualInterest: 0.065,
  creditLimit: 1000,
  payroll: 3.4,
  contractFixed: 2.4,
  factoryFixed: 4.8,
  prototypeCost: 90,
  launchCost: 20,
  expansionCost: 220,
  factoryCost: 580,
  expansionCapacity: 350,
  factoryCapacity: 1400,
  maxTechLevel: 3,
} as const;

export const STRATEGIES: Record<
  Strategy,
  {
    name: string;
    subtitle: string;
    description: string;
    cash: number;
    reputation: number;
    plan: Plan;
    price: number;
  }
> = {
  technology: {
    name: '技术创新',
    subtitle: '用技术建立护城河',
    description: '电池技术 Lv.1，研发团队更强；前期投入较高。',
    cash: 1550,
    reputation: 53,
    plan: {
      research: 120,
      marketing: 28,
      quality: 28,
      productionTarget: 7800,
      techFocus: 'battery',
    },
    price: 0.2498,
  },
  value: {
    name: '极致性价比',
    subtitle: '把效率转化为规模',
    description: '较大的代工产能与更低的配置成本，考验现金周转。',
    cash: 1550,
    reputation: 49,
    plan: {
      research: 70,
      marketing: 40,
      quality: 24,
      productionTarget: 14300,
      techFocus: 'battery',
    },
    price: 0.1598,
  },
  premium: {
    name: '高端豪华',
    subtitle: '少一些销量，多一些价值',
    description: '更高品牌认知与产品配置，研发周期更长。',
    cash: 1750,
    reputation: 69,
    plan: {
      research: 110,
      marketing: 48,
      quality: 38,
      productionTarget: 6500,
      techFocus: 'safety',
    },
    price: 0.3698,
  },
  marketing: {
    name: '营销驱动',
    subtitle: '让好产品被更多人看见',
    description: '品牌和传播优势明显；获客费用需要持续投入。',
    cash: 1650,
    reputation: 60,
    plan: {
      research: 85,
      marketing: 85,
      quality: 25,
      productionTarget: 11700,
      techFocus: 'driving',
    },
    price: 0.2298,
  },
  quality: {
    name: '稳健经营',
    subtitle: '用可靠性赢得长期信任',
    description: '安全技术 Lv.1，质量团队更强；验证时间较长。',
    cash: 1550,
    reputation: 61,
    plan: { research: 85, marketing: 24, quality: 48, productionTarget: 7800, techFocus: 'safety' },
    price: 0.2398,
  },
};

export const SUPPLIERS: Record<
  Supplier,
  { name: string; costFactor: number; risk: number; description: string }
> = {
  established: {
    name: '华衡 · 成熟方案',
    costFactor: 1,
    risk: 0.003,
    description: '成熟零件与完整验证记录，成本与风险均衡。',
  },
  premium: {
    name: '精工 · 高可靠方案',
    costFactor: 1.07,
    risk: 0.001,
    description: '更高采购成本，更低潜在缺陷率。',
  },
  unverified: {
    name: '新锐 · 低价新方案',
    costFactor: 0.89,
    risk: 0.036,
    description: '采购价格较低，但长期耐久验证不足。',
  },
};

export const MODES: Record<
  DevelopmentMode,
  { name: string; speed: number; validation: number; cost: number; detail: string }
> = {
  standard: {
    name: '标准研发',
    speed: 1,
    validation: 0.94,
    cost: 1,
    detail: '按完整研发节奏推进，兼顾验证与成本。',
  },
  investment: {
    name: '增配团队',
    speed: 1.28,
    validation: 0.92,
    cost: 1.6,
    detail: '增加样车和工程团队，提速同时保留主要验证。',
  },
  supplier: {
    name: '成熟平台',
    speed: 1.25,
    validation: 0.99,
    cost: 1.15,
    detail: '采用成熟平台缩短周期，续航与智驾上限略有折让。',
  },
  lean: {
    name: '聚焦核心',
    speed: 1.2,
    validation: 0.96,
    cost: 0.85,
    detail: '精简座舱功能，缩小范围；质量验证照常进行。',
  },
  rushed: {
    name: '压缩验证',
    speed: 1.65,
    validation: 0.44,
    cost: 0.7,
    detail: '跳过部分耐久验证；潜在缺陷会在交付后逐步暴露。',
  },
};

export const TECH_NAMES = {
  battery: '动力电池',
  driving: '智能驾驶',
  safety: '底盘与安全',
} as const;
export const GOAL_NAMES = {
  balanced: '均衡执行',
  growth: '增长优先',
  reliability: '稳健优先',
} as const;
