'use client';

import { useEffect, useState } from 'react';

type ToastProps = {
  message: string;
  duration?: number;
};

export function Toast({ message, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    setFading(false);

    const fadeTimer = setTimeout(() => setFading(true), duration);
    const hideTimer = setTimeout(() => setVisible(false), duration + 400);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [message, duration]);

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      className={`toast${fading ? ' toast-fade-out' : ''}`}
      role="status"
    >
      {message}
    </div>
  );
}
