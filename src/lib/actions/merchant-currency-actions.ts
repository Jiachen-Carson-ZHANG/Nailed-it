'use server';

import { getRepositories } from '@/lib/repositories';
import { demoMerchantId } from '@/mock/merchants';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, type Currency } from '@/data/currency-store';

export async function getMerchantCurrencyAction(): Promise<Currency> {
  const merchant = await getRepositories().merchants.getById(demoMerchantId);
  const raw = merchant?.currency ?? DEFAULT_CURRENCY;
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(raw)
    ? (raw as Currency)
    : DEFAULT_CURRENCY;
}

export async function updateMerchantCurrencyAction(currency: Currency): Promise<void> {
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  await getRepositories().merchants.updateCurrency(demoMerchantId, currency);
}
