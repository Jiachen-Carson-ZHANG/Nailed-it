'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MerchantStyleView } from '@/domain/merchant-style';
import { listMerchantStylesAction } from '@/lib/actions/merchant-style-actions';

export function MerchantStylePreview() {
  const [styles, setStyles] = useState<MerchantStyleView[]>([]);

  useEffect(() => {
    let active = true;
    listMerchantStylesAction().then((next) => active && setStyles(next)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="merchant-style-preview" aria-labelledby="merchant-style-preview-title">
      <div className="merchant-style-section-header">
        <div>
          <p className="section-eyebrow">Showcase</p>
          <h2 id="merchant-style-preview-title">Your style collection</h2>
        </div>
        <Link className="merchant-style-manage-link" href="/merchant/styles">Manage collection →</Link>
      </div>
      {styles.length > 0 ? (
        <div className="merchant-style-preview-grid">
          {styles.slice(0, 4).map((style) => (
            <img alt={style.title} key={style.id} src={style.imageUrl} />
          ))}
        </div>
      ) : (
        <p className="helper-copy">Upload your first design to start the customer showcase.</p>
      )}
    </section>
  );
}
