'use client';

import type { AITrendingStyle } from '@/domain/nail';
import { Button } from '@/components/ui/Button';

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
    name: 'Sun-kissed Bio Gel Gradient Nails',
    description: '',
    tags: [],
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
    name: 'Iridescent Sea Glass Encapsulated Nails',
    description: '',
    tags: [],
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
    name: 'Thermochromic Mini Checkerboard Handprint Nails',
    description: '',
    tags: [],
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
  return (
    <section className="trending-panel" aria-labelledby="trending-panel-title">
      <div className="trending-panel-header">
        <div>
          <h2 id="trending-panel-title" className="trending-panel-title">热门款式</h2>
          <p className="trending-panel-subtitle">AI自动识别抓取近期热门款式</p>
        </div>
        <Button size="compact" variant="secondary" onClick={() => {}}>
          Refresh
        </Button>
      </div>
      <div className="trending-list">
        {STATIC_TRENDING.map((style) => (
          <TrendingRow key={style.rank} style={style} />
        ))}
      </div>
    </section>
  );
}
