import { useId } from 'react';
import type { BrandLogoId } from '../engine';
import { BrandLogoIcon } from './BrandLogo';

export function CarEmblem({ logo }: { logo: BrandLogoId }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const metalId = 'car-emblem-metal-' + id;
  const contactId = 'car-emblem-contact-' + id;

  return (
    <g className="car-emblem" transform="matrix(1.3 -0.055 0.42 0.6 1494 454)">
      {/* 按当前原图的引擎盖平面校准透视；更换车辆素材时需重新校准。 */}
      <defs>
        <linearGradient id={metalId} x1="0%" y1="0%" x2="24%" y2="100%">
          <stop offset="0" stopColor="#e9edf0" />
          <stop offset="0.28" stopColor="#a5abb3" />
          <stop offset="0.46" stopColor="#f1f3f5" />
          <stop offset="0.55" stopColor="#717b86" />
          <stop offset="0.76" stopColor="#b7bec5" />
          <stop offset="1" stopColor="#e4e8ec" />
        </linearGradient>
        <filter
          id={contactId}
          x="-30%"
          y="-40%"
          width="160%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="0.55" />
        </filter>
      </defs>
      <BrandLogoIcon
        logo={logo}
        x={-15.8}
        y={-15.1}
        width={32}
        height={32}
        fill="#3b414b"
        opacity={0.32}
        filter={'url(#' + contactId + ')'}
      />
      <BrandLogoIcon
        className="car-emblem-face"
        logo={logo}
        x={-16}
        y={-16}
        width={32}
        height={32}
        fill={'url(#' + metalId + ')'}
        stroke="#59636f"
        strokeWidth={0.4}
        opacity={0.95}
        style={{ paintOrder: 'stroke fill' }}
      />
      <BrandLogoIcon
        logo={logo}
        x={-16}
        y={-16.35}
        width={32}
        height={32}
        fill="none"
        stroke="#f6f8fa"
        strokeWidth={0.3}
        opacity={0.4}
      />
    </g>
  );
}
