'use client';

import { useRef, useState, useCallback } from 'react';

export type ZoomableImageProps = {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  /** frame 的宽高比，默认 1 */
  aspectRatio?: number;
  /** 最大放大倍数，默认 4 */
  maxScale?: number;
  style?: React.CSSProperties;
};

type Transform = { scale: number; tx: number; ty: number };

const IDENTITY: Transform = { scale: 1, tx: 0, ty: 0 };

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function ZoomableImage({
  src,
  alt,
  className,
  wrapperClassName,
  aspectRatio = 1,
  maxScale = 4,
  style,
}: ZoomableImageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // 当前的活动指针（pointerId -> 屏幕坐标）
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  // 手势基线
  const gestureRef = useRef<{
    startDist: number;
    startScale: number;
    startMidX: number;
    startMidY: number;
    startTx: number;
    startTy: number;
    // 单指拖动基线（屏幕坐标）
    dragX: number;
    dragY: number;
    frameW: number;
    frameH: number;
    captured: boolean;
  }>({
    startDist: 0,
    startScale: 1,
    startMidX: 0,
    startMidY: 0,
    startTx: 0,
    startTy: 0,
    dragX: 0,
    dragY: 0,
    frameW: 0,
    frameH: 0,
    captured: false,
  });

  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [animating, setAnimating] = useState(false);
  const transformRef = useRef<Transform>(IDENTITY);
  transformRef.current = transform;

  const cacheFrameSize = useCallback(() => {
    const rect = frameRef.current?.getBoundingClientRect();
    gestureRef.current.frameW = rect?.width ?? 0;
    gestureRef.current.frameH = rect?.height ?? 0;
  }, []);

  const clampTranslate = useCallback((scale: number, tx: number, ty: number): { tx: number; ty: number } => {
    if (scale <= 1) return { tx: 0, ty: 0 };
    const { frameW, frameH } = gestureRef.current;
    const maxX = (frameW * (scale - 1)) / 2;
    const maxY = (frameH * (scale - 1)) / 2;
    return { tx: clamp(tx, -maxX, maxX), ty: clamp(ty, -maxY, maxY) };
  }, []);

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const beginPinch = useCallback(() => {
    const pts = Array.from(pointersRef.current.values());
    if (pts.length < 2) return;
    cacheFrameSize();
    const [p1, p2] = pts;
    const g = gestureRef.current;
    g.startDist = dist(p1, p2) || 1;
    g.startScale = transformRef.current.scale;
    g.startMidX = (p1.x + p2.x) / 2;
    g.startMidY = (p1.y + p2.y) / 2;
    g.startTx = transformRef.current.tx;
    g.startTy = transformRef.current.ty;
  }, [cacheFrameSize]);

  const beginDrag = useCallback((x: number, y: number) => {
    cacheFrameSize();
    const g = gestureRef.current;
    g.dragX = x;
    g.dragY = y;
    g.startTx = transformRef.current.tx;
    g.startTy = transformRef.current.ty;
  }, [cacheFrameSize]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // 手势开始移除过渡，避免卡顿
    if (animating) setAnimating(false);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const count = pointersRef.current.size;

    if (count === 2) {
      beginPinch();
      // 确认双指手势，捕获两个指针
      if (!gestureRef.current.captured) {
        pointersRef.current.forEach((_, id) => {
          try { frameRef.current?.setPointerCapture(id); } catch { /* ignore */ }
        });
        gestureRef.current.captured = true;
      }
    } else if (count === 1 && transformRef.current.scale > 1) {
      beginDrag(e.clientX, e.clientY);
      // scale>1 单指拖动才 capture
      try { frameRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      gestureRef.current.captured = true;
    }
    // count===1 且 scale===1：不 capture、不阻止，放行页面滚动
  }, [animating, beginPinch, beginDrag]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const pt = pointersRef.current.get(e.pointerId);
    if (!pt) return;
    pt.x = e.clientX;
    pt.y = e.clientY;
    const count = pointersRef.current.size;

    if (count >= 2) {
      const pts = Array.from(pointersRef.current.values());
      const [p1, p2] = pts;
      const g = gestureRef.current;
      const curDist = dist(p1, p2) || 1;
      const nextScale = clamp((g.startScale * curDist) / g.startDist, 1, maxScale);
      // 用双指中点位移微调，给缩放锚点感
      const curMidX = (p1.x + p2.x) / 2;
      const curMidY = (p1.y + p2.y) / 2;
      const midDx = curMidX - g.startMidX;
      const midDy = curMidY - g.startMidY;
      const { tx, ty } = clampTranslate(nextScale, g.startTx + midDx, g.startTy + midDy);
      e.preventDefault();
      setTransform({ scale: nextScale, tx, ty });
    } else if (count === 1 && transformRef.current.scale > 1) {
      const g = gestureRef.current;
      const dx = e.clientX - g.dragX;
      const dy = e.clientY - g.dragY;
      const { tx, ty } = clampTranslate(transformRef.current.scale, g.startTx + dx, g.startTy + dy);
      e.preventDefault();
      setTransform((prev) => ({ scale: prev.scale, tx, ty }));
    }
    // scale===1 单指：放行滚动
  }, [maxScale, clampTranslate]);

  const endPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    const g = gestureRef.current;
    if (g.captured) {
      try { frameRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    const remaining = pointersRef.current.size;
    if (remaining === 1) {
      // 2→1 指：重置拖动基线到剩余指针，避免跳变
      const [id, pt] = Array.from(pointersRef.current.entries())[0];
      if (transformRef.current.scale > 1) {
        beginDrag(pt.x, pt.y);
        try { frameRef.current?.setPointerCapture(id); } catch { /* ignore */ }
        g.captured = true;
      } else {
        g.captured = false;
      }
    } else if (remaining === 0) {
      g.captured = false;
    }
  }, [beginDrag]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // 仅 ctrl+滚轮缩放，普通滚轮放行页面滚动
    if (!e.ctrlKey) return;
    e.preventDefault();
    cacheFrameSize();
    const cur = transformRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextScale = clamp(cur.scale * factor, 1, maxScale);
    const { tx, ty } = clampTranslate(nextScale, cur.tx, cur.ty);
    setTransform({ scale: nextScale, tx, ty });
  }, [cacheFrameSize, clampTranslate, maxScale]);

  const onDoubleClick = useCallback(() => {
    cacheFrameSize();
    setAnimating(true);
    if (transformRef.current.scale > 1) {
      setTransform(IDENTITY);
    } else {
      const nextScale = Math.min(2, maxScale);
      setTransform({ scale: nextScale, tx: 0, ty: 0 });
    }
  }, [cacheFrameSize, maxScale]);

  const onTransitionEnd = useCallback(() => {
    setAnimating(false);
  }, []);

  const scale = transform.scale;

  return (
    <div
      ref={frameRef}
      className={`zoom-frame${wrapperClassName ? ` ${wrapperClassName}` : ''}`}
      style={{ aspectRatio: String(aspectRatio), touchAction: scale > 1 ? 'none' : 'pan-y', ...style }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
    >
      <img
        ref={imgRef}
        className={`zoom-img${animating ? ' zoom-img--animating' : ''}${className ? ` ${className}` : ''}`}
        src={src}
        alt={alt}
        draggable={false}
        style={{ transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${scale})` }}
        onTransitionEnd={onTransitionEnd}
      />
    </div>
  );
}

export default ZoomableImage;
