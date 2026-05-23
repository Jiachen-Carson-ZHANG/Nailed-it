import Link from 'next/link';

type TopBarProps = {
  subtitle?: string;
  title?: string;
};

export function TopBar({ subtitle, title = 'Nailed-it' }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar-inner">
        <Link className="top-brand" href="/">
          {title}
        </Link>
        {subtitle ? <p className="top-subtitle">{subtitle}</p> : null}
      </div>
    </header>
  );
}
