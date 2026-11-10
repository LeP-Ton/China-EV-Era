import type { SVGProps } from 'react';
import { DEFAULT_BRAND_LOGO, type BrandLogoId } from '../engine';

const paths: Record<BrandLogoId, string> = {
  spark: 'M16 2 20 12 30 16 20 20 16 30 12 20 2 16 12 12Z',
  summit: 'M2 26 12 5 18 17 23 10 31 26H24L22 20 18 26 12 13 6 26Z',
  wings: 'M1 7 14 13V26L4 18 1 12 11 17V15L1 10ZM31 7 18 13V26L28 18 31 12 21 17V15L31 10Z',
  bolt: 'M19 1 5 19H14L12 31 28 12H18Z',
  orbit:
    'M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm0 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16ZM2 21 28 7 30 11 4 25Z',
  horizon: 'M4 18a12 12 0 0 1 24 0H24a8 8 0 0 0-16 0ZM2 21H30V24H2ZM6 27H26V30H6Z',
};

export function BrandLogoIcon({
  logo = DEFAULT_BRAND_LOGO,
  ...props
}: SVGProps<SVGSVGElement> & { logo?: BrandLogoId }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={32}
      height={32}
      aria-hidden="true"
      focusable="false"
      data-logo={logo}
      {...props}
    >
      <path d={paths[logo]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
