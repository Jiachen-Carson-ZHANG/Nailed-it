import type { BreakdownResult } from './nail';

let standardResult: BreakdownResult | null = null;
let freeResult: BreakdownResult | null = null;

function clone(r: BreakdownResult): BreakdownResult {
  return structuredClone(r);
}

export function saveBreakdownResult(result: BreakdownResult) {
  if (result.mode === 'standard') {
    standardResult = clone(result);
  } else {
    freeResult = clone(result);
  }
}

export function getBreakdownResults(): { standard: BreakdownResult | null; free: BreakdownResult | null } {
  return {
    standard: standardResult ? clone(standardResult) : null,
    free: freeResult ? clone(freeResult) : null
  };
}

export function clearBreakdownResults() {
  standardResult = null;
  freeResult = null;
}
