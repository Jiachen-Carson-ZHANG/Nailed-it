import { render, screen } from '@testing-library/react';
import PrivacyPage from './page';

describe('PrivacyPage', () => {
  it('renders the public MVP privacy policy for reviewer access', () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole('heading', {
        name: 'Privacy Policy'
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/pinterest connection is optional/i)).toBeInTheDocument();
    expect(screen.getByText(/does not collect pinterest passwords/i)).toBeInTheDocument();
    expect(screen.getByText(/stored locally on your device/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'toughcookiezang@gmail.com'
      })
    ).toHaveAttribute('href', 'mailto:toughcookiezang@gmail.com');
    expect(screen.getByRole('link', { name: /back to nailed-it/i })).toHaveAttribute('href', '/');
  });
});
