'use client';

import { useState } from 'react';
import type { AITrendingStyle } from '@/domain/nail';

const RANK_EMOJI = ['①', '②', '③'];

const PLATFORM_SHORT: Record<string, string> = {
  Pinterest: 'Pinterest',
  Xiaohongshu: '小红书',
  TikTok: 'TikTok',
  Douyin: '抖音',
  'Google Images': 'Google',
};

const STATIC_TRENDING: AITrendingStyle[] = [
  {
    rank: 1,
    nameCn: '日晒感生物凝胶渐变甲',
    nameEn: 'Sun-kissed Bio Gel Gradient Nails',
    searchLinks: [
      { platform: 'Pinterest', label: 'Pinterest', url: 'https://www.pinterest.com/search/pins/?q=%E6%97%A5%E6%99%92%E6%84%9F%E6%B8%90%E5%8F%98%E7%94%B2' },
      { platform: 'Xiaohongshu', label: '小红书', url: 'https://www.xiaohongshu.com/search_result?keyword=%E6%97%A5%E6%99%92%E6%84%9F%E6%B8%90%E5%8F%98%E7%94%B2', appUrl: 'xhsdiscover://search/result?keyword=%E6%97%A5%E6%99%92%E6%84%9F%E6%B8%90%E5%8F%98%E7%94%B2' },
      { platform: 'TikTok', label: 'TikTok', url: 'https://www.tiktok.com/search?q=sun+kissed+gel+gradient+nails' },
      { platform: 'Douyin', label: '抖音', url: 'https://www.douyin.com/search/%E6%97%A5%E6%99%92%E6%84%9F%E6%B8%90%E5%8F%98%E7%94%B2', appUrl: 'snssdk1128://search/result?keyword=%E6%97%A5%E6%99%92%E6%84%9F%E6%B8%90%E5%8F%98%E7%94%B2' },
    ],
  },
  {
    rank: 2,
    nameCn: '幻彩海玻璃碎封装甲',
    nameEn: 'Iridescent Sea Glass Encapsulated Nails',
    searchLinks: [
      { platform: 'Pinterest', label: 'Pinterest', url: 'https://www.pinterest.com/search/pins/?q=sea+glass+encapsulated+nails' },
      { platform: 'Xiaohongshu', label: '小红书', url: 'https://www.xiaohongshu.com/search_result?keyword=%E6%B5%B7%E7%8E%BB%E7%92%83%E7%A2%8E%E5%B0%81%E8%A3%85%E7%94%B2', appUrl: 'xhsdiscover://search/result?keyword=%E6%B5%B7%E7%8E%BB%E7%92%83%E7%A2%8E%E5%B0%81%E8%A3%85%E7%94%B2' },
      { platform: 'TikTok', label: 'TikTok', url: 'https://www.tiktok.com/search?q=sea+glass+nail+art' },
      { platform: 'Douyin', label: '抖音', url: 'https://www.douyin.com/search/%E6%B5%B7%E7%8E%BB%E7%92%83%E7%94%B2', appUrl: 'snssdk1128://search/result?keyword=%E6%B5%B7%E7%8E%BB%E7%92%83%E7%94%B2' },
    ],
  },
  {
    rank: 3,
    nameCn: '温变迷你棋盘手印甲',
    nameEn: 'Thermochromic Mini Checkerboard Handprint Nails',
    searchLinks: [
      { platform: 'Pinterest', label: 'Pinterest', url: 'https://www.pinterest.com/search/pins/?q=checkerboard+thermochromic+nail+art' },
      { platform: 'Xiaohongshu', label: '小红书', url: 'https://www.xiaohongshu.com/search_result?keyword=%E6%B8%A9%E5%8F%98%E6%A3%8B%E7%9B%98%E7%94%B2', appUrl: 'xhsdiscover://search/result?keyword=%E6%B8%A9%E5%8F%98%E6%A3%8B%E7%9B%98%E7%94%B2' },
      { platform: 'TikTok', label: 'TikTok', url: 'https://www.tiktok.com/search?q=thermochromic+checkerboard+nails' },
      { platform: 'Douyin', label: '抖音', url: 'https://www.douyin.com/search/%E6%B8%A9%E5%8F%98%E6%A3%8B%E7%9B%98%E7%94%B2', appUrl: 'snssdk1128://search/result?keyword=%E6%B8%A9%E5%8F%98%E6%A3%8B%E7%9B%98%E7%94%B2' },
    ],
  },
];

function handleMobileAppLink(e: React.MouseEvent<HTMLAnchorElement>, link: { url: string; appUrl?: string }) {
  if (!link.appUrl) return;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) return;

  e.preventDefault();

  let appOpened = false;

  const cancelFallback = () => {
    if (!appOpened) {
      appOpened = true;
      clearTimeout(timer);
    }
  };

  const timer = setTimeout(() => {
    if (!appOpened) window.open(link.url, '_blank', 'noopener,noreferrer');
  }, 1500);

  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelFallback(); }, { once: true });
  window.addEventListener('blur', cancelFallback, { once: true });
  window.addEventListener('pagehide', cancelFallback, { once: true });

  window.location.href = link.appUrl;
}

function TrendingRow({ style }: { style: AITrendingStyle }) {
  const rankGlyph = RANK_EMOJI[style.rank - 1] ?? String(style.rank);
  const links = style.searchLinks.filter((l) => l.platform !== 'Google Images');
  return (
    <div className="trending-row">
      <span className="trending-rank" aria-label={`Rank ${style.rank}`}>{rankGlyph}</span>
      <span className="trending-name">{style.nameCn}</span>
      {links.length > 0 && (
        <span className="trending-row-links">
          {links.map((link) => (
            <a
              key={link.platform}
              className="trending-link"
              href={link.url}
              rel="noopener noreferrer"
              target="_blank"
              onClick={(e) => handleMobileAppLink(e, link)}
            >
              {PLATFORM_SHORT[link.platform] ?? link.label}
            </a>
          ))}
        </span>
      )}
    </div>
  );
}

export function TrendingStylesPanel() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="trending-panel" aria-labelledby="trending-panel-title">
      <h2 id="trending-panel-title" className="trending-panel-title">热门款式</h2>
      <button
        type="button"
        className="trending-panel-toggle"
        aria-expanded={expanded}
        aria-controls="trending-panel-body"
        aria-labelledby="trending-panel-title"
        onClick={() => setExpanded((v) => !v)}
      >
        <p className="trending-panel-subtitle">AI自动识别抓取近期热门款式</p>
        <svg
          className="trending-panel-chevron"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="none"
          width="16"
          height="16"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
        >
          <polyline points="5,7 10,13 15,7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>
      <div id="trending-panel-body" className="trending-list" hidden={!expanded}>
        {STATIC_TRENDING.map((style) => (
          <TrendingRow key={style.rank} style={style} />
        ))}
      </div>
    </section>
  );
}
