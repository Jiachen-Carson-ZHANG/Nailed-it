'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

type ResetLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

export function ResetLink({ href, className, children }: ResetLinkProps) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    router.push(`${href}?t=${Date.now()}`);
  }

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
