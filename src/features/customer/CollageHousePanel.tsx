'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { getCustomerBookingPath, getCustomerTryOnPath } from '@/domain/session';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { saveTryOnImage } from '@/domain/tryon-image-store';
import { saveTryOnStyleImage } from '@/domain/tryon-style-store';
import {
  saveOriginalCollageResult,
  saveLatestCollageResult,
  getCollageResult,
  clearCollageResult,
  getCollageImages,
} from '@/domain/collage-result-store';
import { CollageResultScreen } from './CollageResultScreen';
import { clearBreakdownResults } from '@/domain/breakdown-store';
import { DRAWER_ZONES, type DrawerZoneId } from './studio-layout-config';
import { NailLoadingScreen } from './NailLoadingScreen';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DrawerItem = {
  id: string;
  label: string;
  emoji: string;
  category: string;
  description: string;
};

export type PlacedDecal = {
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

export const DRAWER_ITEMS: Record<DrawerZoneId, DrawerItem[]> = {
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

let keySeq = 0;
function nextKey() { return `dk-${++keySeq}`; }

// Keywords that clearly have nothing to do with nail art.
// The list is intentionally broad so common off-topic inputs are caught
// without false-positiving on legitimate nail-adjacent words.
const OFF_TOPIC_KEYWORDS = [
  // food
  '做饭', '食谱', '菜谱', '炒菜', '烹饪', '厨房', '火锅', '外卖', '点餐',
  // navigation / travel
  '导航', '地图', '路线', '交通', '机票', '酒店', '旅游', '景点',
  // finance
  '股票', '基金', '理财', '贷款', '银行', '投资', '比特币', '加密货币',
  // politics / news
  '政治', '新闻', '选举', '战争', '军事',
  // medicine
  '医院', '药品', '处方', '诊断', '手术',
  // explicit / harmful
  '色情', '暴力', '赌博', '毒品',
  // generic off-topic
  '天气', '写代码', '编程', '数学', '作业', '翻译',
];

function isOffTopic(text: string): boolean {
  const lower = text.toLowerCase();
  return OFF_TOPIC_KEYWORDS.some((kw) => lower.includes(kw));
}

// Maps a drawer zone to the English category label the generation prompt expects
// (must line up with CATEGORY_EN semantics in collage-nail-gen.ts).
const ZONE_TO_EN: Record<DrawerZoneId, string> = {
  color: 'base color',
  shape: 'nail shape',
  art: 'nail art',
  deco: 'decoration',
};

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
  // 中文注释：若上次生成过成图（用户从结果页去试戴/识别后又"返回"），直接恢复到结果页，
  // 而不是回到入口卡片。getCollageResult 只读不清，返回时才拿得到。
  const restored = useRef<SelectedNailImage | null | undefined>(undefined);
  if (restored.current === undefined) restored.current = getCollageResult();
  const hasRestored = Boolean(restored.current);

  const [open, setOpen]       = useState(hasRestored);
  const [shellEl, setShellEl] = useState<Element | null>(null);
  const [genState, setGenState] = useState<GenState>(
    hasRestored ? { phase: 'done', imageBase64: restored.current!.imageBase64 } : { phase: 'idle' }
  );
  const [showResult, setShowResult] = useState(hasRestored);
  const [latestImageBase64, setLatestImageBase64] = useState<string | null>(
    hasRestored ? restored.current!.imageBase64 : null
  );

  // Drawer
  const [openDrawer, setOpenDrawer] = useState<DrawerZoneId | null>(null);

  // All decals placed on the hand image
  const [decals, setDecals] = useState<PlacedDecal[]>([]);

  // Whether the hand image is highlighted (drag is hovering over it)
  const [handHighlight, setHandHighlight] = useState(false);

  // Extra text input
  const [extraText, setExtraText] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

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

  // 拼贴小屋 overlay/加载屏/结果页是 fixed 浮层，但首页 feed（兄弟节点）始终留在 DOM。
  // 若不锁底层滚动，真机上手指在浮层上滑动会穿透滚动背后的长 feed（表现为「页面比一屏高、能滑动」）。
  // overlay 打开期间锁住 body + html 的滚动，关闭时精确还原。
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const body = document.body;
    const html = document.documentElement;
    const prevBody = body.style.overflow;
    const prevHtml = html.style.overflow;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, [open]);

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
    if (extraText.trim() && isOffTopic(extraText)) {
      setInputError('请输入与美甲相关的内容，例如颜色、风格、装饰元素等～');
      setExtraText('');
      return;
    }
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
      // 中文注释：记住这张成图，供"返回"时恢复结果页；同时也是给识别/试戴用的同一张图。
      const collageImage = {
        imageBase64: data.imageBase64,
        mimeType: 'image/png' as const,
        previewUrl: `data:image/png;base64,${data.imageBase64}`,
      };
      saveOriginalCollageResult(collageImage);
      setLatestImageBase64(data.imageBase64);
      setGenState({ phase: 'done', imageBase64: data.imageBase64 });
    } catch (e) {
      setGenState({ phase: 'error', message: e instanceof Error ? e.message : '生成失败，请稍后重试' });
    }
  };

  // 局部重新生成：不切换到 loading phase，避免卸载 CollageResultScreen（会丢失勾选状态）。
  // 子组件自己管理 isRegenerating，这里只负责 fetch + 更新 store/state，返回新图 base64。
  const handlePartialRegen = async (
    checkedZones: DrawerZoneId[],
    newDecals: PlacedDecal[],
    newExtraText: string,
  ): Promise<string> => {
    if (newExtraText.trim() && isOffTopic(newExtraText)) {
      throw new Error('请输入与美甲相关的内容');
    }
    const prompt = buildPrompt(newDecals, newExtraText);
    const ingredients = newDecals.map((d) => ({ category: d.item.category, label: d.item.description }));
    // Pass the previous image as a reference so the model keeps the overall look,
    // and tell it which categories the user chose to change.
    const changedCategories = checkedZones.map((z) => ZONE_TO_EN[z]);
    const res = await fetch('/api/ai/collage-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: ingredients.length > 0 ? ingredients : [{ category: '风格', label: '精致美甲' }],
        customText: prompt,
        referenceImageBase64: latestImageBase64 ?? undefined,
        referenceMimeType: 'image/png',
        changedCategories,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    const data = await res.json() as { imageBase64: string };
    const collageImage = {
      imageBase64: data.imageBase64,
      mimeType: 'image/png' as const,
      previewUrl: `data:image/png;base64,${data.imageBase64}`,
    };
    saveLatestCollageResult(collageImage);
    setLatestImageBase64(data.imageBase64);
    setDecals(newDecals);
    setExtraText(newExtraText);
    setGenState({ phase: 'done', imageBase64: data.imageBase64 });
    return data.imageBase64;
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
    // 中文注释：把生成图打包成识别/试戴接口通用的 SelectedNailImage，
    // 通过模块级 store 交给目标页面预填，免去用户重新上传。
    const collageImage = genState.phase === 'done' ? {
      imageBase64: genState.imageBase64,
      mimeType: 'image/png' as const,
      previewUrl: `data:image/png;base64,${genState.imageBase64}`,
    } : null;

    const collageImages = getCollageImages();
    const originalImg = collageImages.original ?? collageImage;
    const latestImg = (latestImageBase64 ? collageImages.latest : null) ?? collageImages.latest ?? collageImage;

    // 结果页在加载屏开始出场时就已渲染在后面（z-index 低），加载屏淡出时结果页
    // 自然显现，避免透明过渡期间露出首页。showResult=false 时用 visibility:hidden
    // 保持占位但不可见（pointer-events 也关掉），showResult=true 后正常显示。
    const rs = collageImage ? (
      <div style={showResult
        ? { position: 'absolute', inset: 0, zIndex: 199 }
        : { position: 'absolute', inset: 0, zIndex: 199, visibility: 'hidden', pointerEvents: 'none' }}>
        <CollageResultScreen
          originalImage={originalImg!}
          latestImage={latestImg!}
          decals={decals}
          extraText={extraText}
          drawerItems={DRAWER_ITEMS}
          onExtraTextChange={setExtraText}
          onPartialRegen={handlePartialRegen}
          onFullReset={() => {
            clearCollageResult();
            setLatestImageBase64(null);
            setGenState({ phase: 'idle' });
            setDecals([]);
            setExtraText('');
            setShowResult(false);
          }}
          onBreakdown={(img) => {
            clearBreakdownResults();
            saveTryOnImage(img);
            router.push(getCustomerBookingPath());
          }}
          onTryOn={(img) => {
            saveTryOnStyleImage(img);
            router.push(`${getCustomerTryOnPath()}?from=collage`);
          }}
          onClose={() => {
            clearCollageResult();
            setLatestImageBase64(null);
            setOpen(false);
            setGenState({ phase: 'idle' });
            setShowResult(false);
          }}
        />
      </div>
    ) : null;

    // 加载屏叠在结果页上方，出场动画结束后 showResult 变 true，结果页显现
    const ls = (
      <NailLoadingScreen
        done={genState.phase === 'done'}
        onTransitionEnd={() => setShowResult(true)}
      />
    );

    // 若结果已就绪且加载屏已退场，只渲染结果页（加载屏已卸载）
    if (showResult && genState.phase === 'done') {
      return shellEl ? createPortal(rs!, shellEl) : rs!;
    }

    // 加载屏出场动画进行中：结果页（若已生成）在下，加载屏在上
    const content = (
      <>
        {rs}
        {ls}
      </>
    );
    return shellEl ? createPortal(content, shellEl) : content;
  }

  // ── Main studio overlay ───────────────────────────────────────────────────
  const overlay = (
    <div className="studio-overlay" role="dialog" aria-modal="true" aria-label="拼贴小屋">

      {/* Off-topic input error dialog */}
      {inputError && (
        <div className="studio-input-error-backdrop" onClick={() => setInputError(null)}>
          <div className="studio-input-error-dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p className="studio-input-error-icon" aria-hidden="true">🚫</p>
            <p className="studio-input-error-msg">{inputError}</p>
            <button type="button" className="studio-input-error-btn" onClick={() => setInputError(null)}>
              好的，重新输入
            </button>
          </div>
        </div>
      )}

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
