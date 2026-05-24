type MerchantAnalyticsCardProps = {
  title: string;
  value: string;
  detail: string;
};

export function MerchantAnalyticsCard({ detail, title, value }: MerchantAnalyticsCardProps) {
  return (
    <article className="analytics-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
