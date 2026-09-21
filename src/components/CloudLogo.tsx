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

export const AzureMark = ({
  size = 32,
  className = '',
}: {
  size?: number;
  className?: string;
}) => (
  <img
    src="/logos/azure.png"
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
    src="/logos/gcp.png"
    alt="Google Cloud"
    width={size}
    height={Math.round(size * 0.85)}
    className={`shrink-0 object-contain ${className}`}
    style={{ width: size, height: Math.round(size * 0.85) }}
    loading="eager"
  />
);

/**
 * Modern, beautifully proportioned square chip container for cloud provider logos.
 * Uniform aspect ratio across AWS, Azure, and GCP with crisp borders and soft shadows.
 */
export function CloudChip({
  id,
  size = 'md',
  selected = false,
  isDark = false,
  className = '',
}: {
  id: CloudId;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  isDark?: boolean;
  className?: string;
}) {
  const sizeConfig = {
    sm: { box: 'w-10 h-10 rounded-xl p-1.5', imgW: 28, imgH: 22, azSize: 24, gcpSize: 24 },
    md: { box: 'w-12 h-12 rounded-2xl p-2', imgW: 36, imgH: 26, azSize: 30, gcpSize: 30 },
    lg: { box: 'w-16 h-16 rounded-2xl p-2.5', imgW: 48, imgH: 34, azSize: 40, gcpSize: 40 },
  }[size];

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

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 transition-all ${sizeConfig.box} ${className}`}
      style={{
        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
        border: `1px solid ${BORDERS[id]}`,
        boxShadow: selected
          ? `0 0 0 3px ${RINGS[id]}, 0 2px 6px rgba(0,0,0,0.08)`
          : isDark
            ? '0 1px 3px rgba(0,0,0,0.3)'
            : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {id === 'aws' && <AwsWordmark width={sizeConfig.imgW} height={sizeConfig.imgH} isDark={isDark} />}
      {id === 'azure' && <AzureMark size={sizeConfig.azSize} />}
      {id === 'gcp' && <GcpMark size={sizeConfig.gcpSize} />}
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

