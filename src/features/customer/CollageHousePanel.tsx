'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { getCustomerBookingPath, getCustomerTryOnPath } from '@/domain/session';
import { DRAWER_ZONES, type DrawerZoneId } from './studio-layout-config';
import { NailLoadingScreen } from './NailLoadingScreen';

// ── Types ─────────────────────────────────────────────────────────────────────

type DrawerItem = {
  id: string;
  label: string;
  emoji: string;
  category: string;
  description: string;
};

type PlacedDecal = {
  key: string;
  item: DrawerItem;
  // position on the hand image as % of hand-img wrapper
  px: number;
  py: number;
};

type GenState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; imageBase64: string }
  | { phase: 'error'; message: string };

// ── Drawer item data ──────────────────────────────────────────────────────────

const DRAWER_ITEMS: Record<DrawerZoneId, DrawerItem[]> = {
  color: [
    { id: 'c_nude',    label: '裸色',   emoji: '🤎', category: '底色', description: '裸色甲油' },
    { id: 'c_pink',    label: '粉色',   emoji: '🩷', category: '底色', description: '粉色甲油' },
    { id: 'c_white',   label: '白色',   emoji: '🤍', category: '底色', description: '白色甲油' },
    { id: 'c_red',     label: '红色',   emoji: '❤️', category: '底色', description: '红色甲油' },
    { id: 'c_black',   label: '黑色',   emoji: '🖤', category: '底色', description: '黑色甲油' },
    { id: 'c_blue',    label: '蓝色',   emoji: '💙', category: '底色', description: '蓝色甲油' },
    { id: 'c_purple',  label: '紫色',   emoji: '💜', category: '底色', description: '紫色甲油' },
    { id: 'c_grad',    label: '渐变',   emoji: '🌈', category: '底色', description: '渐变色甲油' },
    { id: 'c_glitter', label: '亮片',   emoji: '✨', category: '底色', description: '亮片甲油' },
    { id: 'c_matte',   label: '磨砂',   emoji: '🩶', category: '底色', description: '磨砂色甲油' },
  ],
  shape: [
    { id: 's_round',    label: '圆形',   emoji: '⭕', category: '甲型', description: '圆形甲型' },
    { id: 's_oval',     label: '椭圆',   emoji: '🥚', category: '甲型', description: '椭圆形甲型' },
    { id: 's_squoval',  label: '方圆',   emoji: '🟦', category: '甲型', description: '方圆形甲型' },
    { id: 's_square',   label: '方形',   emoji: '⬜', category: '甲型', description: '方形甲型' },
    { id: 's_almond',   label: '杏仁',   emoji: '🌰', category: '甲型', description: '杏仁形甲型' },
    { id: 's_stiletto', label: '尖形',   emoji: '💘', category: '甲型', description: '尖形甲型' },
    { id: 's_coffin',   label: '棺材',   emoji: '🪦', category: '甲型', description: '棺材形甲型' },
    { id: 's_ballet',   label: '芭蕾',   emoji: '🩰', category: '甲型', description: '芭蕾形甲型' },
  ],
  art: [
    { id: 'a_french',  label: '法式',   emoji: '🤍', category: '艺术', description: '法式白边' },
    { id: 'a_inkwash', label: '水墨',   emoji: '🖌️', category: '艺术', description: '水墨晕染效果' },
    { id: 'a_jelly',   label: '果冻',   emoji: '🍬', category: '艺术', description: '果冻透明感' },
    { id: 'a_aurora',  label: '极光',   emoji: '🌌', category: '艺术', description: '极光渐变效果' },
    { id: 'a_line',    label: '线条',   emoji: '〰️', category: '艺术', description: '细线条设计' },
    { id: 'a_pattern', label: '图案',   emoji: '🔲', category: '艺术', description: '图案手绘' },
    { id: 'a_3d',      label: '浮雕',   emoji: '🌟', category: '艺术', description: '3D立体浮雕' },
    { id: 'a_chrome',  label: '镜面',   emoji: '🪞', category: '艺术', description: '镜面魔镜粉' },
  ],
  deco: [
    { id: 'd_pearl',   label: '珍珠',   emoji: '🫧', category: '装饰', description: '珍珠装饰' },
    { id: 'd_gem_s',   label: '小钻',   emoji: '💎', category: '装饰', description: '小钻石装饰' },
    { id: 'd_gem_l',   label: '大钻',   emoji: '💠', category: '装饰', description: '大钻石装饰' },
    { id: 'd_bow',     label: '蝴蝶结', emoji: '🎀', category: '装饰', description: '蝴蝶结charm' },
    { id: 'd_flower',  label: '花朵',   emoji: '🌸', category: '装饰', description: '立体花朵装饰' },
    { id: 'd_star',    label: '星星',   emoji: '⭐', category: '装饰', description: '星形装饰' },
    { id: 'd_foil',    label: '金箔',   emoji: '🥇', category: '装饰', description: '金箔碎片' },
    { id: 'd_charm',   label: '金属件', emoji: '⚙️', category: '装饰', description: '金属装饰件' },
  ],
};

const LOADING_EMOJIS = ['💜', '🍒', '🌸', '💎', '✨', '🎀', '🌙', '🦋', '🌺', '💫'];

let keySeq = 0;
function nextKey() { return `dk-${++keySeq}`; }

function buildPrompt(decals: PlacedDecal[], extraText: string): string {
  const parts = decals.map((d) => d.item.description);
  const base = parts.length > 0
    ? `请生成一张写实美甲效果图，设计包含：${parts.join('、')}。风格精致唯美，光线自然。`
    : '请生成一张精致唯美的美甲效果图，光线自然。';
  return extraText.trim() ? `${base} 额外要求：${extraText.trim()}` : base;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CollageHousePanel() {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [shellEl, setShellEl] = useState<Element | null>(null);
  const [genState, setGenState] = useState<GenState>({ phase: 'idle' });
  const [showResult, setShowResult] = useState(false);

  // Drawer
  const [openDrawer, setOpenDrawer] = useState<DrawerZoneId | null>(null);

  // All decals placed on the hand image
  const [decals, setDecals] = useState<PlacedDecal[]>([]);

  // Whether the hand image is highlighted (drag is hovering over it)
  const [handHighlight, setHandHighlight] = useState(false);

  // Extra text input
  const [extraText, setExtraText] = useState('');

  // Touch drag refs
  const dragItem   = useRef<DrawerItem | null>(null);
  const ghostEl    = useRef<HTMLDivElement | null>(null);
  const handImgEl  = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!shellEl && typeof document !== 'undefined') {
      const shell = document.querySelector('.mobile-shell');
      if (shell) setShellEl(shell);
    }
  }, [shellEl]);

  // ── Hit-test: is the touch/drop point over the hand image? ────────────────
  const isOverHand = useCallback((clientX: number, clientY: number): boolean => {
    const img = handImgEl.current;
    if (!img) return false;
    const r = img.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }, []);

  // Compute where on the hand (% of hand element) the drop landed
  const handDropPos = useCallback((clientX: number, clientY: number): { px: number; py: number } => {
    const img = handImgEl.current;
    if (!img) return { px: 50, py: 50 };
    const r = img.getBoundingClientRect();
    return {
      px: ((clientX - r.left) / r.width)  * 100,
      py: ((clientY - r.top)  / r.height) * 100,
    };
  }, []);

  // ── Touch drag ────────────────────────────────────────────────────────────
  // React's onTouchMove is a PASSIVE listener, so e.preventDefault() there is a
  // no-op (browser logs "Unable to preventDefault inside passive event listener")
  // and the drawer scrolls instead of dragging. We register the move/end handlers
  // as NON-passive native document listeners on touchstart so preventDefault works
  // and the ghost can be dragged onto the hand.
  const onItemTouchStart = useCallback((item: DrawerItem, e: React.TouchEvent) => {
    dragItem.current = item;
    const t = e.touches[0];
    const ghost = document.createElement('div');
    ghost.className = 'wb-drag-ghost';
    ghost.textContent = item.emoji;
    ghost.style.left = `${t.clientX}px`;
    ghost.style.top  = `${t.clientY}px`;
    document.body.appendChild(ghost);
    ghostEl.current = ghost;

    const handleMove = (ev: TouchEvent) => {
      ev.preventDefault(); // non-passive: actually prevents scroll during drag
      const mt = ev.touches[0];
      if (!mt) return;
      if (ghostEl.current) {
        ghostEl.current.style.left = `${mt.clientX}px`;
        ghostEl.current.style.top  = `${mt.clientY}px`;
      }
      setHandHighlight(isOverHand(mt.clientX, mt.clientY));
    };

    const handleEnd = (ev: TouchEvent) => {
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);

      const et = ev.changedTouches[0];
      ghostEl.current?.remove();
      ghostEl.current = null;
      setHandHighlight(false);

      const dropItem = dragItem.current;
      dragItem.current = null;
      if (!dropItem || !et) return;
      if (!isOverHand(et.clientX, et.clientY)) return;

      const { px, py } = handDropPos(et.clientX, et.clientY);
      setDecals((prev) => {
        const filtered = ['底色', '甲型'].includes(dropItem.category)
          ? prev.filter((d) => d.item.category !== dropItem.category)
          : prev;
        return [...filtered, { key: nextKey(), item: dropItem, px, py }];
      });
    };

    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
  }, [isOverHand, handDropPos]);

  // ── Mouse / HTML5 DnD ────────────────────────────────────────────────────
  const onItemDragStart = useCallback((item: DrawerItem, e: React.DragEvent) => {
    dragItem.current = item;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', item.id); // required for drag to start in Firefox/Safari
  }, []);

  const onHandDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setHandHighlight(true);
  }, []);

  // Only clear highlight when leaving the wrap entirely (not when entering a child)
  const onHandDragLeave = useCallback((e: React.DragEvent) => {
    if (!(e.currentTarget as Node).contains(e.relatedTarget as Node)) {
      setHandHighlight(false);
    }
  }, []);

  const onItemDragEnd = useCallback(() => {
    dragItem.current = null;
    setHandHighlight(false);
  }, []);

  const onHandDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setHandHighlight(false);
    const item = dragItem.current;
    dragItem.current = null;
    if (!item) return;
    const img = handImgEl.current;
    if (!img) return;
    const r = img.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width)  * 100;
    const py = ((e.clientY - r.top)  / r.height) * 100;
    setDecals((prev) => {
      const filtered = ['底色', '甲型'].includes(item.category)
        ? prev.filter((d) => d.item.category !== item.category)
        : prev;
      return [...filtered, { key: nextKey(), item, px, py }];
    });
  }, []);

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const prompt = buildPrompt(decals, extraText);
    setGenState({ phase: 'loading' });
    try {
      const ingredients = decals.map((d) => ({ category: d.item.category, label: d.item.description }));
      const res = await fetch('/api/ai/collage-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: ingredients.length > 0 ? ingredients : [{ category: '风格', label: '精致美甲' }], customText: prompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { imageBase64: string };
      setGenState({ phase: 'done', imageBase64: data.imageBase64 });
    } catch (e) {
      setGenState({ phase: 'error', message: e instanceof Error ? e.message : '生成失败，请稍后重试' });
    }
  };

  // ── Entry card ────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button type="button" className="collage-house-entry" onClick={() => setOpen(true)}>
        <span className="collage-house-entry-text">
          <span className="collage-house-entry-title">拼贴小屋</span>
          <span className="collage-house-entry-sub">DIY 你的专属美甲拼贴</span>
        </span>
        <span className="collage-house-entry-arrow">›</span>
      </button>
    );
  }

  if (genState.phase === 'loading' || genState.phase === 'done') {
    // Once the loading screen signals its transition is complete AND we have the image, show the result.
    if (showResult && genState.phase === 'done') {
      const rs = (
        <ResultScreen
          imageBase64={genState.imageBase64}
          onRetry={() => { setGenState({ phase: 'idle' }); setDecals([]); setExtraText(''); setShowResult(false); }}
          onBreakdown={() => router.push(getCustomerBookingPath())}
          onTryOn={() => router.push(getCustomerTryOnPath())}
          onClose={() => { setOpen(false); setGenState({ phase: 'idle' }); setShowResult(false); }}
        />
      );
      return shellEl ? createPortal(rs, shellEl) : rs;
    }
    const ls = (
      <NailLoadingScreen
        done={genState.phase === 'done'}
        onTransitionEnd={() => setShowResult(true)}
      />
    );
    return shellEl ? createPortal(ls, shellEl) : ls;
  }

  // ── Main studio overlay ───────────────────────────────────────────────────
  const overlay = (
    <div className="studio-overlay" role="dialog" aria-modal="true" aria-label="拼贴小屋">

      {/* Top bar */}
      <div className="studio-topbar">
        <button
          type="button"
          className="studio-back-btn"
          aria-label="返回"
          onClick={() => setOpen(false)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="studio-topbar-title">
          <span className="studio-topbar-sparkle" aria-hidden="true">✦</span>
          拼贴小屋
          <span className="studio-topbar-sparkle" aria-hidden="true">✦</span>
        </span>
        <div className="studio-topbar-spacer" aria-hidden="true" />
      </div>

      <div className="studio-body studio-body-single">

        {/* ── Workbench image with clickable drawer zones ── */}
        <div className="studio-bench-wrap">
          <img
            src="/studio_assets/双层工作台.png"
            alt=""
            aria-hidden="true"
            className="studio-bench-bg"
          />

          {/* Drawer hotspot buttons + inline popups overlaid on the bench image */}
          {DRAWER_ZONES.map((zone) => {
            const isOpen = openDrawer === zone.id;
            // popup sits just below the hotspot
            const popupTop = zone.cy + zone.h / 2;
            return (
              <div key={zone.id}>
                <button
                  type="button"
                  className={`studio-drawer-zone${isOpen ? ' studio-drawer-zone-active' : ''}`}
                  aria-label={`打开${zone.label}抽屉`}
                  aria-expanded={isOpen}
                  style={{
                    left:   `${zone.cx - zone.w / 2}%`,
                    top:    `${zone.cy - zone.h / 2}%`,
                    width:  `${zone.w}%`,
                    height: `${zone.h}%`,
                  }}
                  onClick={() => setOpenDrawer((prev) => prev === zone.id ? null : zone.id)}
                />
                {isOpen && (
                  <div
                    className="studio-drawer-popup"
                    style={{
                      left:  `${zone.cx - zone.w / 2}%`,
                      top:   `${popupTop}%`,
                      width: `${zone.w}%`,
                    }}
                  >
                    {DRAWER_ITEMS[zone.id].map((item) => (
                      <div
                        key={item.id}
                        className="wb-item-chip"
                        draggable
                        onDragStart={(e) => onItemDragStart(item, e)}
                        onDragEnd={onItemDragEnd}
                        onTouchStart={(e) => onItemTouchStart(item, e)}
                        role="button"
                        tabIndex={0}
                        aria-label={item.label}
                      >
                        <span className="wb-item-chip-emoji" aria-hidden="true">{item.emoji}</span>
                        <span className="wb-item-chip-label">{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Right-hand image — the drag drop target */}
          <div
            className={`studio-hand-drop-wrap${handHighlight ? ' studio-hand-drop-wrap-active' : ''}`}
            style={{
              left: STUDIO_LAYOUT_HAND.left,
              top:  STUDIO_LAYOUT_HAND.top,
              width: STUDIO_LAYOUT_HAND.width,
              transform: STUDIO_LAYOUT_HAND.transform,
            }}
            onDragOver={onHandDragOver}
            onDragLeave={onHandDragLeave}
            onDrop={onHandDrop}
          >
            <img
              ref={handImgEl}
              src="/studio_assets/右手.png"
              alt="右手"
              className="studio-bench-hand studio-bench-hand-clickable"
              draggable={false}
            />
            {/* Decals placed on the hand */}
            {decals.map((d) => (
              <span
                key={d.key}
                className="studio-hand-decal"
                style={{ left: `${d.px}%`, top: `${d.py}%` }}
                aria-hidden="true"
              >
                {d.item.emoji}
              </span>
            ))}
          </div>
        </div>

        {/* ── Selection hint ── */}
        <p className="studio-select-hint">底色和甲型每次只能选一种哦~</p>

        {/* ── Extra text input ── */}
        <div className="studio-extra-input-wrap">
          <textarea
            className="studio-extra-input"
            placeholder="附加输入你想要的美甲元素：如颜色、主题、风格..."
            value={extraText}
            onChange={(e) => setExtraText(e.target.value)}
            rows={2}
            maxLength={200}
          />
        </div>

        {/* ── Generate CTA ── */}
        <div className="studio-cta-row wb-cta-row">
          {genState.phase === 'error' && (
            <p className="studio-gen-error">{genState.message}</p>
          )}
          <button
            type="button"
            className="studio-generate-btn"
            onClick={handleGenerate}
          >
            <span aria-hidden="true">🎨</span> AI 生成美甲效果图
            {decals.length > 0 && <span className="wb-cta-count">({decals.length})</span>}
          </button>
          {decals.length > 0 && (
            <button
              type="button"
              className="wb-reset-btn"
              onClick={() => setDecals([])}
            >
              清空全部
            </button>
          )}
        </div>

      </div>
    </div>
  );

  return shellEl ? createPortal(overlay, shellEl) : overlay;
}

// Hand layout constant (extracted to avoid reading STUDIO_LAYOUT which had scene-nav props)
const STUDIO_LAYOUT_HAND = {
  left: '50%',
  top:  '30%',
  width: '32%',
  transform: 'translate(-50%, -50%)',
};

// ── Loading screen ────────────────────────────────────────────────────────────
function LoadingScreen() {
  const ORBIT_EMOJIS = LOADING_EMOJIS.slice(0, 6);
  return (
    <div className="collage-house-overlay collage-loading-screen" aria-label="正在生成美甲效果图" aria-live="polite">
      <div className="collage-bg-sparkles" aria-hidden="true">
        {['✦','✧','✦','✧','✦','✧','✦','✧','✦','✧'].map((s, i) => (
          <span key={i} className="collage-bg-sparkle" style={{ '--i': i } as React.CSSProperties}>{s}</span>
        ))}
      </div>
      <div className="collage-loading-topbar">
        <span className="collage-loading-eyebrow">NAIL STUDIO</span>
        <h1 className="collage-loading-title">AI Style Studio</h1>
      </div>
      <div className="collage-loading-orbit-wrap" aria-hidden="true">
        <div className="collage-loading-rainbow-ring" />
        <div className="collage-loading-disc" />
        <div className="collage-loading-orbit-track">
          {ORBIT_EMOJIS.map((emoji, i) => (
            <span key={i} className="collage-loading-orbit-arm" style={{ '--orbit-i': i } as React.CSSProperties}>
              <span className="collage-loading-orbit-emoji">{emoji}</span>
            </span>
          ))}
        </div>
        <span className="collage-loading-center-emoji" aria-hidden="true">💅</span>
      </div>
      <p className="collage-loading-headline">Mixing your magic...</p>
      <p className="collage-loading-sub">Our nail fairy is crafting your look ✨</p>
    </div>
  );
}

// ── Result screen ─────────────────────────────────────────────────────────────
type ResultScreenProps = {
  imageBase64: string;
  onRetry: () => void;
  onBreakdown: () => void;
  onTryOn: () => void;
  onClose: () => void;
};

function ResultScreen({ imageBase64, onRetry, onBreakdown, onTryOn, onClose }: ResultScreenProps) {
  return (
    <div className="collage-house-overlay collage-result-screen">
      <div className="collage-bg-sparkles" aria-hidden="true">
        {['✦','✧','✦','✧','✦','✧','✦','✧','✦','✧'].map((s, i) => (
          <span key={i} className="collage-bg-sparkle" style={{ '--i': i } as React.CSSProperties}>{s}</span>
        ))}
      </div>
      <div className="collage-result-topbar">
        <h1 className="collage-result-title">你的专属美甲 ✨</h1>
        <button type="button" className="collage-close-btn" aria-label="关闭" onClick={onClose}>✕</button>
      </div>
      <div className="collage-result-image-wrap">
        <img src={`data:image/png;base64,${imageBase64}`} alt="AI生成的专属美甲效果图" className="collage-result-image" />
        <div className="collage-result-badge" aria-hidden="true">AI 生成</div>
      </div>
      <p className="collage-result-hint">喜欢这个方案？可以直接进行AI识别报价或试戴体验</p>
      <div className="collage-result-actions">
        <button type="button" className="collage-result-action-btn collage-result-action-primary" onClick={onBreakdown}>
          <span aria-hidden="true">🔍</span> AI 识别报价
        </button>
        <button type="button" className="collage-result-action-btn collage-result-action-secondary" onClick={onTryOn}>
          <span aria-hidden="true">🖐️</span> 虚拟试戴
        </button>
      </div>
      <button type="button" className="collage-result-retry-btn" onClick={onRetry}>↺ 重新搭配</button>
    </div>
  );
}
