import React from 'react';

interface BrandLogoProps {
  showWordmark?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ showWordmark = true }) => (
  <div className="fcf-brand" aria-label="Forever CashFlow">
    <span className="fcf-brand-mark" aria-hidden="true">
      <img src="/icon-192.png" alt="" />
    </span>
    {showWordmark && (
      <span className="fcf-brand-wordmark">
        Forever <strong>Cash</strong>Flow
      </span>
    )}
  </div>
);
