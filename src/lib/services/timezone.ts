// Merchant-timezone resolution — see ADR-0005 (P4b). Turns a merchant-local wall-clock slot
// into the three forms the pure scheduling kernel needs: weekday, local-minute range, and an
// absolute epoch-ms interval. No external date library; uses Intl for the zone offset.

import type { AvailabilityRequest, Weekday } from '@/domain/scheduling';

function tzOffsetMs(timeZone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) map[p.type] = p.value;
  const hour = map.hour === '24' ? 0 : Number(map.hour);
  const asUtcOfLocal = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return asUtcOfLocal - utcMs;
}

/** Convert a wall-clock date ('YYYY-MM-DD') + time ('HH:MM') in `timeZone` to an epoch-ms instant. */
export function zonedWallTimeToUtcMs(dateStr: string, timeStr: string, timeZone: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi);
  return naiveUtc - tzOffsetMs(timeZone, naiveUtc);
}

/** Resolve a merchant-local slot into the kernel's request shape (weekday + local range + ms interval). */
export function resolveSlot(
  timeZone: string,
  dateStr: string,
  timeStr: string,
  durationMin: number,
): AvailabilityRequest {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay() as Weekday;
  const startMin = h * 60 + mi;
  const startMs = zonedWallTimeToUtcMs(dateStr, timeStr, timeZone);
  return {
    weekday,
    localRange: { startMin, endMin: startMin + durationMin },
    interval: { startMs, endMs: startMs + durationMin * 60_000 },
  };
}
