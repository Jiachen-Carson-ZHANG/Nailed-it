import Link from 'next/link';

type PriceEstimateBarProps = {
  actionHref: string;
  actionLabel: string;
  duration: number;
  onAction?: () => void;
  price: number;
};

export function PriceEstimateBar({
  actionHref,
  actionLabel,
  duration,
  onAction,
  price
}: PriceEstimateBarProps) {
  return (
    <aside className="estimate-bar">
      <div className="estimate-bar-copy">
        <span>Live estimate</span>
        <strong>SGD {price}</strong>
        <p>{duration} min based on the editable recognition result</p>
      </div>
      <Link className="button button-primary" href={actionHref} onClick={onAction}>
        {actionLabel}
      </Link>
    </aside>
  );
}
