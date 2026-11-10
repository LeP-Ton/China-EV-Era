// 统一使用可序列化的 32 位生成器；存档保存状态而非只保存原始种子。
export function hashSeed(seed: string): number {
  let value = 2166136261;
  for (const char of seed) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function randomStep(seed: number): { state: number; value: number } {
  const state = (seed + 0x6d2b79f5) >>> 0;
  let value = Math.imul(state ^ (state >>> 15), state | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { state, value: ((value ^ (value >>> 14)) >>> 0) / 4294967296 };
}

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const round = (value: number) => Math.round((value + Number.EPSILON) * 1000000) / 1000000;
