import React from 'react';

interface BrandLogoProps {
  showWordmark?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ showWordmark = true }) => (
  <div className="fcf-brand" aria-label="Forever CashFlow">
    <span className="fcf-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 36 36" role="presentation">
        <defs>
          <linearGradient id="fcf-logo-gradient" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#F9A825" />
            <stop offset="100%" stopColor="#FF6A1A" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="34" height="34" rx="8" fill="url(#fcf-logo-gradient)" />
        <path d="M10 26V10H22M10 17H19" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 17L23 9M18 9H23V14" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M29 13C27.8 11.4 26.3 10.7 24.5 10.7C21.1 10.7 19 13.5 19 18C19 22.5 21.1 25.3 24.5 25.3C26.3 25.3 27.8 24.6 29 23" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
      </svg>
    </span>
    {showWordmark && (
      <span className="fcf-brand-wordmark">
        Forever <strong>Cash</strong>Flow
      </span>
    )}
  </div>
);
