import { expect, test } from '@playwright/test';

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44,
  0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01, 0x01,
  0x00, 0xc9, 0xfe, 0x92, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82
]);

test('customer inbox only shows this customer appointment threads', async ({ page }) => {
  await page.goto('/customer/messages');

  await expect(page.getByRole('heading', { name: /messages/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /nailed-it studio/i })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /today 14:00/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /today 16:00/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /tomorrow 15:30/i })).toHaveCount(0);

  await page.goto('/customer/messages/conv-amy');
  await expect(page.getByText(/conversation not found/i)).toBeVisible();
});

test('mocked AI upload books once and opens the appointment thread', async ({ page }) => {
  await mockRecognition(page, 0.86);

  await page.goto('/customer/booking');
  await page
    .getByLabel(/choose nail reference photo/i)
    .setInputFiles({ buffer: pngBytes, mimeType: 'image/png', name: 'mock-nails.png' });

  await page.getByRole('button', { name: /smart recognition/i }).click();
  await expect(page.getByRole('dialog', { name: /ai recognition result/i })).toBeVisible();
  await page.getByRole('button', { name: /close/i }).click();

  await page.getByRole('link', { name: /next: choose time/i }).click();
  await expect(page).toHaveURL(/\/customer\/booking\/confirm$/);
  await page.getByRole('button', { name: /10:00 .* mei chen/i }).click();

  const confirmButton = page.getByRole('button', { name: /confirm appointment/i });
  await confirmButton.click();

  await expect(page.getByRole('status')).toContainText(/confirmed with mei chen/i);
  await expect(page.getByRole('button', { name: /appointment confirmed/i })).toBeDisabled();

  await page.getByRole('link', { name: /open booking messages/i }).click();
  await expect(page.getByRole('heading', { name: /nailed-it studio/i })).toBeVisible();
  await expect(page.getByText(/appointment is confirmed with mei chen/i)).toBeVisible();

  await page.goto('/customer/messages');
  await expect(page.getByRole('link', { name: /today 10:00/i })).toHaveCount(1);

  await page.goto('/customer/profile');
  await expect(page.getByText(/custom ai reference/i)).toBeVisible();
});

test('mocked low-confidence AI upload routes the booking to review', async ({ page }) => {
  await mockRecognition(page, 0.61);

  await page.goto('/customer/booking');
  await page
    .getByLabel(/choose nail reference photo/i)
    .setInputFiles({ buffer: pngBytes, mimeType: 'image/png', name: 'unclear-nails.png' });

  await page.getByRole('button', { name: /smart recognition/i }).click();
  await expect(page.getByRole('dialog', { name: /ai recognition result/i })).toBeVisible();
  await page.getByRole('button', { name: /close/i }).click();

  await page.getByRole('link', { name: /next: choose time/i }).click();
  await page.getByRole('button', { name: /10:00 .* mei chen/i }).click();
  await page.getByRole('button', { name: /confirm appointment/i }).click();

  await expect(page.getByRole('status')).toContainText(/pending review with mei chen/i);
  await expect(page.getByRole('button', { name: /pending review/i })).toBeDisabled();
  await page.getByRole('link', { name: /open booking messages/i }).click();
  await expect(page.getByText(/pending merchant review with mei chen/i)).toBeVisible();
});

async function mockRecognition(page: import('@playwright/test').Page, confidence: number) {
  await page.route('**/api/ai/recognize-nail-style', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        recognition: {
          selection: {
            addons: ['rhinestone'],
            baseServices: ['extension', 'builderGel'],
            nailShape: 'almond',
            otherNotes: 'Mocked Playwright recognition for a pink cat-eye reference.',
            styles: ['catEye']
          },
          meta: {
            aiSuggestedQuote: {
              duration: 0,
              price: 0,
              source: 'ai_suggestion'
            },
            confidence
          }
        }
      },
      status: 200
    });
  });
}
