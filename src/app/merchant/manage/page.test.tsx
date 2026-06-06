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

  it('renders pricing sections and shows a toast after saving changes', async () => {
    render(<MerchantManagePage />);

    expect(screen.getByRole('heading', { name: /设置单价与时长/i })).toBeInTheDocument();

    const priceInput = await screen.findByLabelText(/基础护理服务 单价/i);
    fireEvent.change(priceInput, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /保存价格表/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/价格表已保存到数据库/i);
  });
});
