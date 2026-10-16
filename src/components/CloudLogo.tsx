/**
 * Official Cloud Provider Logos — AWS, Microsoft Azure (Fluent 2021+ Ribbon), Google Cloud.
 * Renders both pixel-perfect SVGs and high-resolution assets for crisp fidelity at all DPRs.
 */

export type CloudId = 'aws' | 'azure' | 'gcp';

export const AwsWordmark = ({
  width = 44,
  height = 28,
  isDark = false,
  className = '',
}: {
  width?: number;
  height?: number;
  isDark?: boolean;
  className?: string;
}) => {
  const textColor = isDark ? '#FFFFFF' : '#232F3E';
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 68 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      {/* AWS Typography */}
      <text
        x="34"
        y="21"
        textAnchor="middle"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="21"
        fontWeight="800"
        letterSpacing="-0.5px"
        fill={textColor}
      >
        aws
      </text>
      {/* AWS Smile Arrow Curve */}
      <path
        d="M14 24.5C22 29.5 32 31 42 29.5C47 28.5 51.5 26.5 55 23.5"
        stroke="#FF9900"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      {/* Arrowhead */}
      <path
        d="M52 23.5L56 23L54.5 27.5"
        stroke="#FF9900"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};

import { AZURE_LOGO_DATA_URI, GCP_LOGO_DATA_URI, LENS_LOGO_DATA_URI } from './brandAssets';

export const AzureMark = ({
  size = 32,
  className = '',
}: {
  size?: number;
  className?: string;
}) => (
  <img
    src={AZURE_LOGO_DATA_URI}
    alt="Microsoft Azure"
    width={size}
    height={size}
    className={`shrink-0 object-contain ${className}`}
    style={{ width: size, height: size }}
    loading="eager"
  />
);

export const GcpMark = ({
  size = 32,
  className = '',
}: {
  size?: number;
  className?: string;
}) => (
  <img
    src={GCP_LOGO_DATA_URI}
    alt="Google Cloud"
    width={size}
    height={size}
    className={`shrink-0 object-contain ${className}`}
    style={{ width: size, height: size }}
    loading="eager"
  />
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
  // Each tile defines a square inner area (`inner`) that all three marks share.
  // object-contain centers every logo inside that area regardless of the logo's
  // intrinsic aspect ratio, so AWS, Azure, and GCP get identical breathing room.
  const sizeMap = {
    xs: { box: 'w-7 h-7 rounded-lg p-1', inner: 18, awsW: 24, awsH: 16 },
    sm: { box: 'w-10 h-10 rounded-xl p-1.5', inner: 24, awsW: 32, awsH: 20 },
    md: { box: 'w-12 h-12 rounded-2xl p-2', inner: 28, awsW: 38, awsH: 24 },
    lg: { box: 'w-16 h-16 rounded-2xl p-2.5', inner: 38, awsW: 50, awsH: 32 },
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
      {id === 'aws' && <AwsWordmark width={config.awsW} height={config.awsH} isDark={isDark} />}
      {id === 'azure' && <AzureMark size={config.inner} />}
      {id === 'gcp' && <GcpMark size={config.inner} />}
    </span>
  );
}

/**
 * Official CloudifyOps Brand Symbol (Teal-to-Green dual-loop / ops mark)
 */
export function CloudifyOpsSymbol({
  className = '',
  height = 26,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <img
      src="/logos/cloudifyops.png"
      alt="CloudifyOps"
      height={height}
      className={`shrink-0 object-contain ${className}`}
      style={{ height, width: 'auto' }}
      loading="eager"
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

