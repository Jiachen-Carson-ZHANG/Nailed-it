'use client';

import { useEffect, useRef } from 'react';
import type { AnalyticsEventType } from '@/domain/analytics';
import { track, type TrackInput } from './track';

type TrackOnMountProps = { eventType: AnalyticsEventType } & TrackInput;

/**
 * Fires exactly one analytics event when mounted — used to log a view from a server-rendered
 * surface (e.g. style_detail_view) by embedding this client child. The ref guard makes it
 * StrictMode-safe so React's dev double-invoke does not double-count.
 */
export function TrackOnMount({ eventType, ...input }: TrackOnMountProps) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(eventType, input);
    // Fire once on mount only; prop changes must not re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
