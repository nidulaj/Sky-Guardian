import React from 'react';

/**
 * Airplane cabin window with a dawn sky above the clouds. Pure SVG, no image assets.
 * Decorative: hidden from assistive technology.
 */
export default function WindowIllustration({ className = '', animated = true }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 480 600" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sg-bezel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F3EDE3" />
          <stop offset="55%" stopColor="#DCD1BF" />
          <stop offset="100%" stopColor="#B9A98F" />
        </linearGradient>
        <linearGradient id="sg-recess" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B8A992" />
          <stop offset="100%" stopColor="#8E7E68" />
        </linearGradient>
        <linearGradient id="sg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8DAFC6" />
          <stop offset="38%" stopColor="#BFD2DC" />
          <stop offset="62%" stopColor="#EADBCF" />
          <stop offset="80%" stopColor="#F5CBAB" />
          <stop offset="100%" stopColor="#EFB08B" />
        </linearGradient>
        <radialGradient id="sg-sun" cx="0.62" cy="0.74" r="0.45">
          <stop offset="0%" stopColor="#FFF6E8" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#FCE3C9" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FCE3C9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sg-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EDE6DA" />
          <stop offset="100%" stopColor="#D3C6B2" />
        </linearGradient>
        <linearGradient id="sg-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F6D6C2" />
        </linearGradient>
        <filter id="sg-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        <filter id="sg-inner" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <clipPath id="sg-glass">
          <rect x="86" y="96" width="308" height="408" rx="138" />
        </clipPath>
      </defs>

      {/* Bezel and recess */}
      <rect x="18" y="18" width="444" height="564" rx="200" fill="url(#sg-bezel)" />
      <rect x="18.5" y="18.5" width="443" height="563" rx="199.5" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" />
      <rect x="60" y="66" width="360" height="468" rx="164" fill="url(#sg-recess)" />

      {/* Glass */}
      <g clipPath="url(#sg-glass)">
        <rect x="86" y="96" width="308" height="408" fill="url(#sg-sky)" />
        <rect x="86" y="96" width="308" height="408" fill="url(#sg-sun)" />

        <g className={animated ? 'animate-drift' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <g filter="url(#sg-soft)" fill="url(#sg-cloud)">
            <ellipse cx="120" cy="452" rx="110" ry="34" />
            <ellipse cx="250" cy="440" rx="140" ry="30" />
            <ellipse cx="380" cy="456" rx="120" ry="36" />
            <ellipse cx="200" cy="490" rx="200" ry="40" />
            <ellipse cx="330" cy="500" rx="160" ry="34" />
          </g>
          <g filter="url(#sg-soft)" fill="#FFFFFF" opacity="0.8">
            <ellipse cx="160" cy="430" rx="60" ry="14" />
            <ellipse cx="330" cy="424" rx="70" ry="12" />
          </g>
        </g>

        {/* Pulled-up window shade */}
        <rect x="86" y="96" width="308" height="86" fill="url(#sg-shade)" />
        <rect x="86" y="180" width="308" height="3" fill="#B9A98F" opacity="0.6" />
        <rect x="206" y="160" width="68" height="9" rx="4.5" fill="#C4B6A0" />
        <rect x="206" y="160" width="68" height="3" rx="1.5" fill="#FFFFFF" opacity="0.5" />

        {/* Glass reflection */}
        <path d="M 120 520 L 300 96 L 340 96 L 160 520 Z" fill="#FFFFFF" opacity="0.07" />
      </g>

      {/* Glass edge shadow for depth */}
      <rect
        x="86"
        y="96"
        width="308"
        height="408"
        rx="138"
        fill="none"
        stroke="#2B241F"
        strokeOpacity="0.35"
        strokeWidth="8"
        filter="url(#sg-inner)"
        clipPath="url(#sg-glass)"
      />
      <rect x="86" y="96" width="308" height="408" rx="138" fill="none" stroke="#7D6E59" strokeWidth="2" />
    </svg>
  );
}
