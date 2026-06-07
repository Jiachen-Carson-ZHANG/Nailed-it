'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MerchantStyleView } from '@/domain/merchant-style';
import { useLanguage } from '@/i18n/context';
import { listMerchantStylesAction } from '@/lib/actions/merchant-style-actions';

export function MerchantStylePreview() {
  const [styles, setStyles] = useState<MerchantStyleView[]>([]);
  const { language } = useLanguage();
  const copy = {
    'zh-CN': {
      eyebrow: '作品展示',
      title: '你的款式集合',
      manageLink: '管理款式集合',
      empty: '先上传你的第一个款式，开始搭建顾客可见作品页。',
    },
    en: {
      eyebrow: 'Showcase',
      title: 'Your style collection',
      manageLink: 'Manage collection',
      empty: 'Upload your first design to start the customer showcase.',
    },
  } as const;
  const labels = copy[language];

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
          <p className="section-eyebrow">{labels.eyebrow}</p>
          <h2 id="merchant-style-preview-title">{labels.title}</h2>
        </div>
        <Link className="merchant-style-manage-link" href="/merchant/styles">
          {labels.manageLink} →
        </Link>
      </div>
      {styles.length > 0 ? (
        <div className="merchant-style-preview-grid">
          {styles.slice(0, 4).map((style) => (
            <img alt={style.title} key={style.id} src={style.imageUrl} />
          ))}
        </div>
      ) : (
        <p className="helper-copy">{labels.empty}</p>
      )}
    </section>
  );
}
