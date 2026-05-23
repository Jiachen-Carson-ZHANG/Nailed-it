#!/usr/bin/env python3
"""Simple Playwright capture for the record-patch skill.

For simple captures: load a URL, wait for a selector to appear, screenshot the
full page, save to a path. For multi-step captures (upload PDF, click button,
expand modal, then snap), use the template at references/playwright-template.js
and write a one-off script in /tmp/ instead.

Usage:
  python3 capture.py --url http://localhost:3001/?tab=parser \
                     --wait-for "text=Validation Results" \
                     --out docs/screenshots/2026-05-22-val-e16-after.png

Args:
  --url        Page URL (required)
  --wait-for   Playwright locator to await before capturing (required).
               Examples: "text=Validation Results", ".validation-card", "[data-testid='proceed-btn']"
  --out        Output PNG path (required). Will be created at this exact path.
  --viewport   "WIDTHxHEIGHT" — defaults to 1440x900
  --full-page  flag to capture the full scrollable page (default: visible viewport only)
  --timeout    ms to wait for the selector before failing (default: 30000)

Exits non-zero with a one-line error if anything goes wrong (selector never
appeared, page failed to load, etc). Caller (the skill) should treat non-zero
as a hard failure and surface it to the user, not retry blindly.

Requires Playwright installed at /tmp/node_modules/playwright. Run
  cd /tmp && npm install playwright && npx playwright install chromium
if missing.
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

NODE_MODULES = "/tmp/node_modules"

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--wait-for", required=True, help="Playwright locator to await")
    parser.add_argument("--out", required=True, help="Output PNG path")
    parser.add_argument("--viewport", default="1440x900")
    parser.add_argument("--full-page", action="store_true")
    parser.add_argument("--timeout", type=int, default=30000)
    args = parser.parse_args()

    if not Path(f"{NODE_MODULES}/playwright").exists():
        print(f"ERROR: Playwright not found at {NODE_MODULES}/playwright.", file=sys.stderr)
        print(f"Install once with: cd /tmp && npm install playwright && npx playwright install chromium", file=sys.stderr)
        sys.exit(2)

    try:
        w, h = args.viewport.lower().split("x")
        width, height = int(w), int(h)
    except ValueError:
        print(f"ERROR: --viewport must be 'WIDTHxHEIGHT', got {args.viewport!r}", file=sys.stderr)
        sys.exit(2)

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)

    # Inline Node script so we don't ship a separate .js file for this simple case.
    script = f"""
const {{ chromium }} = require('{NODE_MODULES}/playwright');
(async () => {{
  const browser = await chromium.launch({{ headless: true }});
  const ctx = await browser.newContext({{ viewport: {{ width: {width}, height: {height} }} }});
  const page = await ctx.newPage();
  try {{
    await page.goto({args.url!r}, {{ waitUntil: 'networkidle', timeout: {args.timeout} }});
    await page.waitForSelector({args.wait_for!r}, {{ timeout: {args.timeout} }});
    await page.screenshot({{ path: {args.out!r}, fullPage: {'true' if args.full_page else 'false'} }});
    console.log('OK ' + {args.out!r});
  }} catch (e) {{
    console.error('FAIL ' + e.message);
    process.exit(3);
  }} finally {{
    await browser.close();
  }}
}})();
"""

    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    if proc.returncode != 0:
        print(f"ERROR: capture failed.\nstdout: {proc.stdout}\nstderr: {proc.stderr}", file=sys.stderr)
        sys.exit(proc.returncode or 1)

    out_path = Path(args.out)
    if not out_path.exists() or out_path.stat().st_size < 1024:
        print(f"ERROR: output file is missing or smaller than 1KB: {args.out}", file=sys.stderr)
        sys.exit(4)

    print(f"OK {args.out} ({out_path.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
