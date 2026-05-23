// Template for one-off Playwright captures driven by the record-patch skill.
//
// When the patch needs multi-step navigation (upload PDF, click a button, open
// a modal, scroll into view, etc.), copy this file to /tmp/<PATCH-ID>-capture.js,
// fill in the patch-specific steps in the marked section, run with
// `node /tmp/<PATCH-ID>-capture.js`, then delete the temp file.
//
// Standing conventions encoded here:
//   - Headless Chromium with a fixed 1440x900 viewport (matches the existing
//     before/after screenshots in docs/screenshots/).
//   - networkidle wait on initial goto.
//   - 60s timeout default — extraction-dependent flows are slow.
//   - Save to docs/screenshots/ with the canonical filename pattern.
//   - Non-zero exit on any failure so the calling skill can detect + report.
//
// Fill in the CAPTURE_STEPS section below. Everything else stays as-is.

const { chromium } = require('/tmp/node_modules/playwright');
const path = require('path');

// ──────────────────────────────────────────────────────────────────────────
// EDIT THESE per patch:
const PATCH_ID = 'ui-e1';                                       // lowercase
const STATE   = 'after';                                        // 'before' or 'after'
const DATE    = '2026-05-24';                                   // YYYY-MM-DD
const DETAIL  = '';                                             // optional, e.g. 'modal-open'
const URL     = 'http://localhost:3000';
const FRONTEND_BASE = 'http://localhost:3000';

const SCREENSHOT_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'docs', 'screenshots');
// If running this from /tmp/, set SCREENSHOT_DIR explicitly:
// const SCREENSHOT_DIR = '/home/tough/Nailed-it/docs/screenshots';

// ──────────────────────────────────────────────────────────────────────────

const filename = [DATE, PATCH_ID, STATE].concat(DETAIL ? [DETAIL] : []).join('-') + '.png';
const outPath = path.join(SCREENSHOT_DIR, filename);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Capture network errors for debugging
  page.on('response', (resp) => {
    if (resp.status() >= 400 && resp.url().includes('/api/')) {
      console.log(`[NET ERR] ${resp.status()} ${resp.url()}`);
    }
  });

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60_000 });

    // ────────────────────────────────────────────────────────────────────
    // CAPTURE_STEPS: edit this block to set up the exact state for the
    // screenshot. Common patterns shown — delete what's not needed.
    //
    // Example: click a button and wait for a panel to appear
    //   await page.locator('button:has-text("Book Now")').first().click();
    //   await page.waitForSelector('[data-testid="booking-panel"]', { timeout: 5_000 });
    //
    // Example: open a modal then capture it
    //   await page.locator('button:has-text("Try On")').first().click();
    //   await page.waitForSelector('[data-testid="tryon-modal"]', { timeout: 5_000 });
    //
    // Example: wait for AI result to settle
    //   await page.waitForTimeout(2_000);
    //
    // For 'before' captures (git-stashed working tree): the navigation here
    // must reach the SAME view as the 'after' capture but with the OLD code
    // rendered. Use identical selectors / steps so the comparison is true.
    // ────────────────────────────────────────────────────────────────────

    await page.waitForSelector('body', { timeout: 60_000 });
    await page.screenshot({ path: outPath, fullPage: true });

    console.log(`OK ${outPath}`);
  } catch (e) {
    console.error(`FAIL ${e.message}`);
    process.exit(2);
  } finally {
    await browser.close();
  }
})();
