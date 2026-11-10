export const BRAND_LOGOS = [
  { id: 'spark', name: '星芒' },
  { id: 'summit', name: '山岳' },
  { id: 'wings', name: '凌翼' },
  { id: 'bolt', name: '闪电' },
  { id: 'orbit', name: '星环' },
  { id: 'horizon', name: '旭日' },
] as const;

export type BrandLogoId = (typeof BRAND_LOGOS)[number]['id'];
export const DEFAULT_BRAND_LOGO: BrandLogoId = 'spark';

export function isBrandLogo(value: unknown): value is BrandLogoId {
  return BRAND_LOGOS.some((logo) => logo.id === value);
}
