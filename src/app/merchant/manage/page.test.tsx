'use client';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import MerchantManagePage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/manage'
}));

vi.mock('@/components/ui/Toast', () => ({
  Toast: ({ message }: { message: string }) => message ? <div role="status">{message}</div> : null,
}));

describe('MerchantManagePage', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('renders the pricing panels and saves changes to the DB', async () => {
    render(<MerchantManagePage />);

    // Default panel renders.
    expect(screen.getByRole('heading', { name: '基础服务' })).toBeInTheDocument();

    // Edit the base service price, then save from the preview panel (prices persist to merchant_pricing).
    const priceInput = await screen.findByLabelText(/基础护理服务 单价/i);
    fireEvent.change(priceInput, { target: { value: '12' } });

    fireEvent.click(screen.getByRole('button', { name: '确认预览' }));
    fireEvent.click(screen.getByRole('button', { name: /保存价格表/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/价格表已更新/i);
  });
});
