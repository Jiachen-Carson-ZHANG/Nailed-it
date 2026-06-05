import type { BreakdownResult } from './nail';

let glossaryResult: BreakdownResult | null = null;

function clone(r: BreakdownResult): BreakdownResult {
  return structuredClone(r);
}

export function saveBreakdownResult(result: BreakdownResult): void {
  glossaryResult = clone(result);
}

export function getBreakdownResult(): BreakdownResult | null {
  return glossaryResult ? clone(glossaryResult) : null;
}

export function clearBreakdownResults(): void {
  glossaryResult = null;
}
