/**
/**
 * Cloud Provider Logos — AWS, Microsoft Azure, Google Cloud.
 *
 * All three provider marks are authored as inline SVGs on an identical 24x24
 * viewBox with the artwork sized to roughly the same optical weight. This
 * replaces the previous mix of a text wordmark + two differently-proportioned
 * PNGs, which could never look balanced at a shared box size. Rendering them
 * from one coordinate system guarantees consistent sizing and padding.
 */

import { useState } from 'react';
import { LENS_LOGO_DATA_URI, CLOUDIFYOPS_LOGO_DATA_URI } from './brandAssets';

export type CloudId = 'aws' | 'azure' | 'gcp';

// AWS — "aws" wordmark with the orange "smile" arrow, framed in 24x24.
export const AwsMark = ({
  size = 24,
  isDark = false,
  className = '',
}: {
  size?: number;
  isDark?: boolean;
  className?: string;
}) => {
  const textColor = isDark ? '#FFFFFF' : '#252F3E';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <text
        x="12"
        y="12.5"
        textAnchor="middle"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="8.5"
        fontWeight="800"
        letterSpacing="-0.3"
        fill={textColor}
      >
        aws
      </text>
      <path
        d="M5 16.2c4.3 2.6 9.7 2.6 14 0"
        stroke="#FF9900"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16.6 15.1l2.6-.4-.7 2.6"
        stroke="#FF9900"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};

// Backward-compatible alias. Older screens import `AwsWordmark` and pass a
// `width`/`height`; map that to the new square `AwsMark` using width as size.
export const AwsWordmark = ({
  width = 24,
  isDark = false,
  className = '',
}: {
  width?: number;
  height?: number;
  isDark?: boolean;
  className?: string;
}) => <AwsMark size={width} isDark={isDark} className={className} />;

// Microsoft Azure — the "A" ribbon mark.
export const AzureMark = ({
  size = 24,
  className = '',
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    <defs>
      <linearGradient id="azA" x1="6" y1="3" x2="12" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#114A8B" />
        <stop offset="1" stopColor="#0669BC" />
      </linearGradient>
      <linearGradient id="azB" x1="14" y1="12" x2="12" y2="21" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3CCBF4" />
        <stop offset="1" stopColor="#2892DF" />
      </linearGradient>
    </defs>
    <path d="M9 3h5.1l-5.3 15.7a1 1 0 0 1-.95.68H4.2a.6.6 0 0 1-.57-.8L8.05 3.68A1 1 0 0 1 9 3Z" fill="url(#azA)" />
    <path d="M16.3 14.3H8.2a.46.46 0 0 0-.31.8l5.2 4.86a1 1 0 0 0 .68.27h4.57l-2.04-5.93Z" fill="#0078D4" />
    <path d="M14.9 3H9a1 1 0 0 1 .95.68L15 19.38a.6.6 0 0 1-.57.8h5.37a.6.6 0 0 0 .57-.8L15.86 3.68A1 1 0 0 0 14.9 3Z" fill="url(#azB)" />
  </svg>
);

// Google Cloud — four-color cloud mark.
export const GcpMark = ({
  size = 24,
  className = '',
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    {/* Official Google Cloud mark (single-path, from Simple Icons / public domain). */}
    <path
      d="M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a6.717 6.717 0 0 0 4.077 1.356h5.173l.03.03h5.192c6.687.053 9.376-8.605 3.835-12.35a9.365 9.365 0 0 0-2.821-4.552l-.043.043.006-.05A9.344 9.344 0 0 0 12.19 2.38zm-.358 4.146c1.244-.04 2.518.368 3.486 1.15a5.186 5.186 0 0 1 1.862 4.078v.518c3.53-.07 3.53 5.262 0 5.193h-5.193l-.008.009v-.04H6.785a2.59 2.59 0 0 1-1.067-.23h.001a2.597 2.597 0 1 1 3.437-3.437l3.013-3.012A6.747 6.747 0 0 0 8.11 8.24c.018-.01.04-.026.054-.023a5.186 5.186 0 0 1 3.67-1.69z"
      fill="#4285F4"
    />
  </svg>
);

/**
 * Modern, beautifully proportioned square chip container for cloud provider logos.
 * Uniform aspect ratio across AWS, Azure, and GCP with crisp borders and soft shadows.
 */
export function CloudChip({
  id = 'aws',
  size = 'md',
  selected = false,
  isDark = false,
  className = '',
}: {
  id?: CloudId;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  isDark?: boolean;
  className?: string;
}) {
  // All three marks share one square `inner` size (they're all 24x24 SVGs),
  // so AWS, Azure, and GCP render at identical dimensions inside the tile.
  const sizeMap = {
    xs: { box: 'w-7 h-7 rounded-lg p-1', inner: 20 },
    sm: { box: 'w-10 h-10 rounded-xl p-1.5', inner: 26 },
    md: { box: 'w-12 h-12 rounded-2xl p-2', inner: 32 },
    lg: { box: 'w-16 h-16 rounded-2xl p-2.5', inner: 42 },
  };

  const config = sizeMap[size] || sizeMap.sm;

  const BORDERS: Record<CloudId, string> = {
    aws: selected ? 'rgba(255,153,0,0.6)' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    azure: selected ? 'rgba(0,120,212,0.6)' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    gcp: selected ? 'rgba(66,133,244,0.6)' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
  };

  const RINGS: Record<CloudId, string> = {
    aws: 'rgba(255,153,0,0.2)',
    azure: 'rgba(0,120,212,0.2)',
    gcp: 'rgba(66,133,244,0.2)',
  };

  const border = (id && BORDERS[id]) || (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)');
  const ring = (id && RINGS[id]) || 'rgba(59,130,246,0.2)';

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 transition-all ${config.box} ${className}`}
      style={{
        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
        border: `1px solid ${border}`,
        boxShadow: selected
          ? `0 0 0 3px ${ring}, 0 2px 6px rgba(0,0,0,0.08)`
          : isDark
            ? '0 1px 3px rgba(0,0,0,0.3)'
            : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {id === 'aws' && <AwsMark size={config.inner} isDark={isDark} />}
      {id === 'azure' && <AzureMark size={config.inner} />}
      {id === 'gcp' && <GcpMark size={config.inner} />}
    </span>
  );
}

/**
 * Official CloudifyOps Corporate Brand Symbol & Wordmark
 * Embedded as self-contained Base64 Data URI to guarantee flawless rendering
 * on any VM, proxy, container, or production deployment.
 */
export function CloudifyOpsSymbol({
  className = '',
  height = 26,
}: {
  className?: string;
  height?: number;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={`flex items-center gap-1.5 font-bold tracking-tight select-none text-emerald-500 ${className}`}
        style={{ height, fontSize: Math.max(14, Math.round(height * 0.52)) }}
      >
        <svg
          width={height}
          height={height}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
        >
          <circle cx="11" cy="16" r="7" stroke="#00C49F" strokeWidth="3" />
          <circle cx="21" cy="16" r="7" stroke="#0088FE" strokeWidth="3" />
        </svg>
        <span style={{ color: '#00C49F' }}>Cloudify<span style={{ color: '#0088FE' }}>Ops</span></span>
      </div>
    );
  }

  return (
    <img
      src={CLOUDIFYOPS_LOGO_DATA_URI}
      alt="CloudifyOps"
      height={height}
      className={`shrink-0 object-contain ${className}`}
      style={{ height, width: 'auto' }}
      loading="eager"
      onError={() => setHasError(true)}
    />
  );
}

/**
 * Official LENS WAFR Product Brand Logo (LEN with Green Infinity Loop)
 */
export function LensLogo({
  className = '',
  height = 28,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
      <img
        src={LENS_LOGO_DATA_URI}
        alt="LENS"
        height={height}
        className="shrink-0 object-contain"
        style={{ height, width: 'auto' }}
        loading="eager"
      />
    </div>
  );
}

