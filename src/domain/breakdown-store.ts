import type { BreakdownResult } from './nail';

let glossaryResult: BreakdownResult | null = null;

export function saveBreakdownResult(result: BreakdownResult): void {
  glossaryResult = structuredClone(result);
}

export function getBreakdownResult(): BreakdownResult | null {
  return glossaryResult ? structuredClone(glossaryResult) : null;
}

export function clearBreakdownResults(): void {
  glossaryResult = null;
}

