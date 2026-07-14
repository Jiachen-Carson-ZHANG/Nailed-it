import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveOriginalCollageResult,
  saveLatestCollageResult,
  getCollageImages,
  getCollageResult,
  clearCollageResult,
} from './collage-result-store';

const img1 = { imageBase64: 'aaa', mimeType: 'image/png' as const, previewUrl: 'data:image/png;base64,aaa' };
const img2 = { imageBase64: 'bbb', mimeType: 'image/png' as const, previewUrl: 'data:image/png;base64,bbb' };

describe('collage-result-store', () => {
  beforeEach(() => clearCollageResult());

  it('getCollageImages returns null before any save', () => {
    expect(getCollageImages()).toEqual({ original: null, latest: null });
  });

  it('saveOriginalCollageResult sets both slots on first call', () => {
    saveOriginalCollageResult(img1);
    expect(getCollageImages()).toEqual({ original: img1, latest: img1 });
  });

  it('saveOriginalCollageResult does NOT overwrite original on subsequent calls', () => {
    saveOriginalCollageResult(img1);
    saveOriginalCollageResult(img2);
    expect(getCollageImages().original).toEqual(img1);
    expect(getCollageImages().latest).toEqual(img1);
  });

  it('saveLatestCollageResult updates latest but not original', () => {
    saveOriginalCollageResult(img1);
    saveLatestCollageResult(img2);
    expect(getCollageImages().original).toEqual(img1);
    expect(getCollageImages().latest).toEqual(img2);
  });

  it('clearCollageResult resets both slots', () => {
    saveOriginalCollageResult(img1);
    clearCollageResult();
    expect(getCollageImages()).toEqual({ original: null, latest: null });
  });

  it('getCollageResult returns latestImage', () => {
    saveOriginalCollageResult(img1);
    saveLatestCollageResult(img2);
    expect(getCollageResult()).toEqual(img2);
  });

  it('getCollageResult returns null before any save', () => {
    expect(getCollageResult()).toBeNull();
  });

  // NOTE: CollageHousePanel.tsx still imports saveCollageResult (Task 5 will fix all CollageHousePanel imports).
  // This is a known cross-task transition state and not a blocker for this test coverage fix.
});
