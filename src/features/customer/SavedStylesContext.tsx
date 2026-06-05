'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'nailed-it:saved-styles';

type SavedStylesContextValue = {
  savedIds: Set<string>;
  toggle: (id: string) => void;
  isSaved: (id: string) => boolean;
};

const SavedStylesContext = createContext<SavedStylesContextValue | null>(null);

export function SavedStylesProvider({ children }: { children: React.ReactNode }) {
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...savedIds]));
  }, [savedIds]);

  const toggle = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  return (
    <SavedStylesContext.Provider value={{ savedIds, toggle, isSaved }}>
      {children}
    </SavedStylesContext.Provider>
  );
}

export function useSavedStyles() {
  const ctx = useContext(SavedStylesContext);
  if (!ctx) throw new Error('useSavedStyles must be used inside SavedStylesProvider');
  return ctx;
}
