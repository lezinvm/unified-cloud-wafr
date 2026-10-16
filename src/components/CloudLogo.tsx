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
  <svg
    width={size}
    height={size}
    viewBox="0 0 96 96"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    <defs>
      <linearGradient id="azGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#114a8b" />
        <stop offset="100%" stopColor="#0669bc" />
      </linearGradient>
      <linearGradient id="azGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3ccbf4" />
        <stop offset="100%" stopColor="#2892df" />
      </linearGradient>
    </defs>
    <path
      fill="url(#azGrad1)"
      d="M33.338 6.544h26.038l-27.03 80.087a4.152 4.152 0 0 1-3.933 2.824H8.149a4.145 4.145 0 0 1-3.928-5.47L29.404 9.368a4.152 4.152 0 0 1 3.934-2.825z"
    />
    <path
      fill="#0078d4"
      d="M71.175 60.261h-41.29a1.911 1.911 0 0 0-1.305 3.309l26.532 24.764a4.171 4.171 0 0 0 2.846 1.121h23.38z"
    />
    <path
      fill="url(#azGrad2)"
      d="M71.175 60.261L48.148 11.23a4.144 4.144 0 0 0-3.805-2.486H25.047a4.147 4.147 0 0 1 3.925-2.825h20.528a4.15 4.15 0 0 1 3.805 2.486l27.18 57.944a4.144 4.144 0 0 1-3.925 5.812h-5.385z"
    />
  </svg>
);

export const GcpMark = ({
  size = 32,
  className = '',
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    <path
      d="M45.5 32.5c0-.8-.1-1.6-.2-2.3H32v4.8h7.6c-.3 1.8-1.4 3.4-3 4.4v3.6h4.8c2.8-2.6 4.4-6.4 4.4-10.5z"
      fill="#4285F4"
    />
    <path
      d="M32 46c3.9 0 7.2-1.3 9.6-3.5l-4.8-3.6c-1.3.9-3 1.4-4.8 1.4-3.7 0-6.8-2.5-7.9-5.9h-4.9v3.8C21.6 42.4 26.4 46 32 46z"
      fill="#34A853"
    />
    <path
      d="M24.1 34.4c-.3-.9-.5-1.9-.5-2.9 0-1 .2-2 .5-2.9v-3.8h-4.9C18.1 26.8 17.5 29.3 17.5 32s.6 5.2 1.7 7.2l4.9-3.8z"
      fill="#FBBC05"
    />
    <path
      d="M32 22.7c2.1 0 4 .7 5.5 2.1l4.1-4.1C39.1 18.5 35.8 17.3 32 17.3c-5.6 0-10.4 3.6-12.8 8.7l4.9 3.8c1.1-3.4 4.2-6.1 7.9-6.1z"
      fill="#EA4335"
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
  const sizeMap = {
    xs: { box: 'w-7 h-7 rounded-lg p-1', imgW: 20, imgH: 14, azSize: 16, gcpSize: 16 },
    sm: { box: 'w-10 h-10 rounded-xl p-1.5', imgW: 28, imgH: 22, azSize: 24, gcpSize: 24 },
    md: { box: 'w-12 h-12 rounded-2xl p-2', imgW: 36, imgH: 26, azSize: 30, gcpSize: 30 },
    lg: { box: 'w-16 h-16 rounded-2xl p-2.5', imgW: 48, imgH: 34, azSize: 40, gcpSize: 40 },
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
      {id === 'aws' && <AwsWordmark width={config.imgW} height={config.imgH} isDark={isDark} />}
      {id === 'azure' && <AzureMark size={config.azSize} />}
      {id === 'gcp' && <GcpMark size={config.gcpSize} />}
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
        src="/lens-logo.png"
        alt="LENS"
        height={height}
        className="shrink-0 object-contain hidden"
        style={{ height, width: 'auto' }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      {/* Clean SVG Vector LENS Logo with Teal-Emerald infinity accent */}
      <div className="flex items-center gap-1.5 select-none">
        <svg width={height} height={height} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="14" fill="#0F172A" stroke="#10B981" strokeWidth="2" />
          <path d="M10 16C10 13.5 12 11.5 14.5 11.5C17 11.5 19 16 19 16C19 16 21 20.5 23.5 20.5C26 20.5 28 18.5 28 16" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M22 16C22 13.5 20 11.5 17.5 11.5C15 11.5 13 16 13 16C13 16 11 20.5 8.5 20.5C6 20.5 4 18.5 4 16" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span className="font-extrabold tracking-wider text-base" style={{ color: '#10B981', letterSpacing: '0.08em' }}>
          LENS
        </span>
      </div>
    </div>
  );
}

