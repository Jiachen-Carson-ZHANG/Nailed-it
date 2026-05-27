type MerchantAnalyticsCardProps = {
  title: string;
  value: string;
  detail?: string;
};

export function MerchantAnalyticsCard({ detail, title, value }: MerchantAnalyticsCardProps) {
  return (
    <article aria-label={detail ?? title} className="analytics-card stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}
