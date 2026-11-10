import { SUPPLIERS } from './config';
import type { GameState, Product } from './types';
import { clamp } from './random';

export interface Offer {
  id: string;
  price: number;
  range: number;
  performance: number;
  driving: number;
  cabin: number;
  safety: number;
  reputation: number;
  marketing: number;
  wait: number;
}
export const SEGMENTS = [
  {
    name: '价格敏感',
    weight: 0.28,
    price: 3.7,
    range: 0.5,
    driving: 0.2,
    performance: 0.15,
    brand: 0.35,
    safety: 0.55,
    cabin: 0.2,
  },
  {
    name: '续航优先',
    weight: 0.22,
    price: 1.6,
    range: 2.3,
    driving: 0.3,
    performance: 0.2,
    brand: 0.4,
    safety: 0.5,
    cabin: 0.2,
  },
  {
    name: '智能偏好',
    weight: 0.17,
    price: 1.25,
    range: 0.5,
    driving: 2.5,
    performance: 0.3,
    brand: 0.5,
    safety: 0.4,
    cabin: 0.8,
  },
  {
    name: '性能偏好',
    weight: 0.1,
    price: 1.1,
    range: 0.3,
    driving: 0.5,
    performance: 2.5,
    brand: 0.5,
    safety: 0.5,
    cabin: 0.4,
  },
  {
    name: '高端品牌',
    weight: 0.09,
    price: 0.35,
    range: 0.3,
    driving: 0.7,
    performance: 0.8,
    brand: 3.2,
    safety: 0.6,
    cabin: 1.3,
  },
  {
    name: '安全可靠',
    weight: 0.14,
    price: 1.2,
    range: 0.5,
    driving: 0.2,
    performance: 0.1,
    brand: 0.9,
    safety: 2.6,
    cabin: 0.2,
  },
] as const;

export function rangeOf(product: Product, batteryLevel: number): number {
  const platform = product.mode === 'supplier' ? 0.94 : 1;
  return Math.round(
    product.batteryCapacity *
      (product.type === '轿车' ? 7.3 : product.type === 'SUV' ? 6.5 : 6.1) *
      (product.battery === 'NMC' ? 1.04 : 1) *
      (1 + batteryLevel * 0.045) *
      platform,
  );
}

export function unitCostOf(state: GameState): number {
  const p = state.product;
  const batteryCost = p.batteryCapacity * (p.battery === 'LFP' ? 0.00055 : 0.0007);
  const specificationCost =
    p.performance * 0.00025 + p.driving * 0.0045 + p.cabin * 0.0024 + (p.safety - 60) * 0.00042;
  const base =
    0.037 +
    batteryCost +
    specificationCost +
    (p.segment === 'premium' ? 0.022 : p.segment === 'economy' ? -0.008 : 0);
  // 工艺效率降低成本，不会降低质量。采购压价是独立的风险来源。
  const efficiency = (state.manufacturing.owned ? 0.9 : 1) * (1 - state.tech.battery.level * 0.025);
  return Math.max(0.055, base * SUPPLIERS[state.manufacturing.supplier].costFactor * efficiency);
}

export function playerOffer(state: GameState): Offer {
  const p = state.product;
  return {
    id: 'player',
    price: p.price,
    range: rangeOf(p, state.tech.battery.level),
    performance: p.performance,
    driving: Math.min(5, p.driving + state.tech.driving.level * 0.35),
    cabin: p.cabin,
    safety: Math.min(99, p.safety + state.tech.safety.level * 2),
    reputation: state.company.reputation,
    marketing: state.plan.marketing / 13,
    wait: p.backlog / Math.max(1, state.manufacturing.capacity) + (p.halted ? 12 : 0),
  };
}

export function offersOf(state: GameState, preview = false): Offer[] {
  const offers: Offer[] = state.rivals
    .filter((r) => r.active)
    .map((r) => ({
      id: r.id,
      price: r.price,
      range: r.range,
      performance: r.performance,
      driving: r.driving,
      cabin: r.cabin,
      safety: r.safety,
      reputation: r.reputation,
      marketing: r.marketing,
      wait: r.backlog / r.capacity,
    }));
  if (preview || state.product.status === 'selling') offers.push(playerOffer(state));
  return offers;
}

export function utility(offer: Offer, segment: (typeof SEGMENTS)[number]): number {
  return (
    1.4 -
    (segment.price * offer.price) / 0.25 +
    (segment.range * offer.range) / 650 +
    (segment.driving * offer.driving) / 5 +
    (segment.performance * offer.performance) / 100 +
    (segment.brand * offer.reputation) / 100 +
    (segment.safety * offer.safety) / 100 +
    (segment.cabin * offer.cabin) / 5 +
    Math.log1p(offer.marketing) * 0.24 -
    Math.min(16, offer.wait) * 0.15
  );
}

// 含“暂不购买”的多群体 Logit 选择模型；各企业争夺同一份总需求。
export function allocateDemand(
  offers: Offer[],
  demand: number,
): {
  orders: Record<string, number>;
  shares: Record<string, number>;
  outsideShare: number;
  segments: { name: string; playerShare: number }[];
} {
  const shares: Record<string, number> = Object.fromEntries(offers.map((o) => [o.id, 0]));
  let outsideShare = 0;
  const segments = SEGMENTS.map((segment) => {
    const weights = offers.map((offer) => Math.exp(clamp(utility(offer, segment), -10, 10)));
    const outside = Math.exp(0.65);
    const total = outside + weights.reduce((a, b) => a + b, 0);
    offers.forEach((offer, i) => {
      shares[offer.id] += (segment.weight * weights[i]) / total;
    });
    outsideShare += (segment.weight * outside) / total;
    const index = offers.findIndex((o) => o.id === 'player');
    return { name: segment.name, playerShare: index < 0 ? 0 : weights[index] / total };
  });
  const orders = Object.fromEntries(offers.map((o) => [o.id, Math.floor(demand * shares[o.id])]));
  return { orders, shares, outsideShare, segments };
}

export function forecast(state: GameState) {
  return allocateDemand(offersOf(state, true), state.market.demand);
}
