import { expect, test } from '@playwright/test';

async function forceScrollableContent(page: import('@playwright/test').Page) {
  await page.locator('.mobile-content').evaluate((node) => {
    const filler = document.createElement('div');
    filler.setAttribute('data-testid', 'desktop-scroll-filler');
    filler.style.height = '2000px';
    filler.style.width = '100%';
    filler.style.pointerEvents = 'none';
    node.appendChild(filler);
  });
}

async function getShellMetrics(page: import('@playwright/test').Page) {
  const shell = await page.locator('.mobile-shell').boundingBox();
  const tab = await page.locator('.bottom-tab-bar').boundingBox();

  if (!shell) {
    throw new Error('Expected .mobile-shell to be visible');
  }

  return {
    height: shell.height,
    width: shell.width,
    ratio: shell.height / shell.width,
    shellBottom: shell.y + shell.height,
    tabBottom: tab ? tab.y + tab.height : null,
  };
}

test('desktop customer pages use a height-fitted phone shell and scroll inside mobile content', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/customer/booking');

  await expect(page.locator('.mobile-shell')).toBeVisible();
  await expect(page.locator('.mobile-content')).toBeVisible();

  const metrics = await getShellMetrics(page);
  expect(metrics.ratio).toBeGreaterThan(2.12);
  expect(metrics.ratio).toBeLessThan(2.2);
  expect(metrics.tabBottom).not.toBeNull();
  expect(Math.abs(metrics.shellBottom - Number(metrics.tabBottom))).toBeLessThan(4);

  const overflowY = await page
    .locator('.mobile-content')
    .evaluate((node) => getComputedStyle(node).overflowY);
  expect(overflowY).toBe('auto');

  await forceScrollableContent(page);
  await page.locator('.mobile-content').evaluate((node) => {
    node.scrollTop = 420;
  });

  const scrollState = await page.evaluate(() => ({
    contentScrollTop:
      (document.querySelector('.mobile-content') as HTMLElement | null)?.scrollTop ?? -1,
    windowScrollY: window.scrollY,
  }));

  expect(scrollState.contentScrollTop).toBeGreaterThan(0);
  expect(scrollState.windowScrollY).toBe(0);
});

test('landing page keeps its existing full-page layout on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '少沟通，多成交' })).toBeVisible();
  await expect(page.locator('.mobile-shell')).toHaveCount(0);
});
