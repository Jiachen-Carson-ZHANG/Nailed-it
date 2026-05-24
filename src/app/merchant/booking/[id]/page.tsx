import { notFound } from 'next/navigation';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { mockBookings } from '@/mock/bookings';

type MerchantBookingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MerchantBookingDetailPage({
  params
}: MerchantBookingDetailPageProps) {
  const { id } = await params;
  const booking = mockBookings.find((item) => item.id === id);

  if (!booking) {
    notFound();
  }

  return (
    <MobileLayout
      brandHref="/merchant/calendar"
      role="merchant"
      showTabs={false}
      subtitle="Review the shared booking snapshot that customers and merchant tools both derive from."
      title="Nailed-it"
    >
      <section className="booking-detail">
        <img alt={booking.styleTitle} src={booking.styleImageUrl} />
        <div className="booking-detail-copy">
          <h1>{booking.customerName}</h1>
          <p>
            {booking.date} · {booking.time} · {booking.quote.duration} min
          </p>
          <p>SGD {booking.quote.price}</p>
        </div>
        <p>{booking.styleTitle}</p>
        <p>{booking.notes}</p>
        <div className="chip-row" aria-label="Booking status">
          {(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const).map(
            (status) => (
              <span
                key={status}
                className={booking.status === status ? 'chip chip-selected' : 'chip'}
              >
                {status}
              </span>
            )
          )}
        </div>
        <Button variant="secondary">Contact customer</Button>
      </section>
    </MobileLayout>
  );
}
