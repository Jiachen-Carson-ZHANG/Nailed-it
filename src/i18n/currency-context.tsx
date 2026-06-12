'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { loadCurrency, DEFAULT_CURRENCY, type Currency } from '@/data/currency-store';
import { getMerchantCurrencyAction } from '@/lib/actions/merchant-currency-actions';

type CurrencyContextValue = { currency: Currency };

const CurrencyContext = createContext<CurrencyContextValue>({ currency: DEFAULT_CURRENCY });

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(loadCurrency);

  useEffect(() => {
    getMerchantCurrencyAction()
      .then((c) => {
        setCurrency(c);
      })
      .catch(() => {
        setCurrency(loadCurrency());
      });
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
