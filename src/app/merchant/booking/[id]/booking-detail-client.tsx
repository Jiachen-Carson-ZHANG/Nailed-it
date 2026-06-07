'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import type { Booking } from '@/domain/nail';
import { getMerchantMessagesPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import { formatDuration, formatStatusLabel } from '@/i18n/format';
import { listMerchantBookingViewsAction, setBookingStatusAction } from '@/lib/actions/booking-actions';
import { uploadMerchantStyleAction } from '@/lib/actions/merchant-style-actions';

type MerchantBookingDetailClientProps = {
  id: string;
};

const bookingDetailCopy = {
  'zh-CN': {
    loadingTitle: '正在加载预约',
    loadingBody: '正在获取预约详情。',
    notFoundTitle: '未找到预约',
    notFoundBody: '当前会话中找不到该预约。',
    technician: '技师',
    status: '状态',
    updateStatus: '更新预约状态',
    confirm: '确认预约',
    cancelBooking: '取消预约',
    markCompleted: '标记完成',
    uploadingPhoto: '正在上传成品照…',
    terminal: (status: string) => `此预约已${status}，无法再更改。`,
    openMessages: '打开消息对话',
    backToCalendar: '← 返回日历',
    completionError: '成品照保存失败，请重试。',
  },
  en: {
    loadingTitle: 'Loading booking',
    loadingBody: 'Fetching the appointment from the booking service.',
    notFoundTitle: 'Booking not found',
    notFoundBody: 'The selected appointment is not available in the current booking session.',
    technician: 'Technician',
    status: 'Status',
    updateStatus: 'Update booking status',
    confirm: 'Confirm',
    cancelBooking: 'Cancel booking',
    markCompleted: 'Mark completed',
    uploadingPhoto: 'Uploading photo…',
    terminal: (status: string) => `This booking is ${status} — no further changes.`,
    openMessages: 'Open message thread',
    backToCalendar: '← Back to calendar',
    completionError: 'Could not save the finished design.',
  },
} as const;

// A booking moves forward through its lifecycle; it can't jump arbitrarily (e.g. straight to completed,
// or back to pending). Each state only offers its valid next steps; completed/cancelled are terminal.
const nextActions: Record<Booking['status'], Booking['status'][]> = {
  pending_review: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function MerchantBookingDetailClient({ id }: MerchantBookingDetailClientProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const copy = bookingDetailCopy[language];
  const completionInputRef = useRef<HTMLInputElement>(null);
  const [booking, setBooking] = useState<Booking | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Booking['status'] | undefined>(undefined);
  const [isCompleting, setIsCompleting] = useState(false);
  const [message, setMessage] = useState('');

  const actionLabel: Record<Booking['status'], string> = {
    pending_review: copy.confirm,
    confirmed: copy.confirm,
    completed: copy.markCompleted,
    cancelled: copy.cancelBooking,
  };

  useEffect(() => {
    let active = true;
    listMerchantBookingViewsAction()
      .then((rows) => {
        if (!active) return;
        const found = rows.find((item) => item.id === id);
        setBooking(found);
        setStatus(found?.status);
      })
      .catch(() => {
        /* leave undefined → not-found state */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="page-heading">
        <LoadingState title={copy.loadingTitle} body={copy.loadingBody} />
      </section>
    );
  }

  if (!booking) {
    return (
      <section className="page-heading">
        <EmptyState body={copy.notFoundBody} title={copy.notFoundTitle} />
      </section>
    );
  }

  const conversationId = booking.conversationId;
  const currentStatus = status ?? booking.status;
  const statusLabel = formatStatusLabel({ status: currentStatus, language });

  async function changeStatus(option: Booking['status']) {
    if (option === 'completed') {
      completionInputRef.current?.click();
      return;
    }
    setStatus(option);
    setMessage('');
    await setBookingStatusAction(id, option);
  }

  async function handleCompletionPhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const image = input.files?.[0];
    input.value = '';
    if (!image) return;

    setIsCompleting(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.set('image', image);
      formData.set('source', 'completed_booking');
      if (booking?.styleTitle.trim()) {
        formData.set('title', booking.styleTitle.trim());
      }
      const draft = await uploadMerchantStyleAction(formData);
      setStatus('completed');
      await setBookingStatusAction(id, 'completed');
      router.push(`/merchant/styles/${draft.id}/review`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.completionError);
      setIsCompleting(false);
    }
  }

  return (
    <section className="booking-detail">
      <input
        ref={completionInputRef}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        aria-hidden="true"
        capture="environment"
        hidden
        type="file"
        onChange={handleCompletionPhoto}
      />
      <img alt={booking.styleTitle} src={booking.styleImageUrl} />
      <div className="booking-detail-copy">
        <h1>{booking.customerName}</h1>
        <p>
          {booking.date} · {booking.time} · {formatDuration({ minutes: booking.quote.duration, language })}
        </p>
        <p>SGD {booking.quote.price}</p>
      </div>
      <p>{booking.styleTitle}</p>
      <p>{booking.notes}</p>
      <p>{copy.technician}: {booking.technician.name}</p>
      <p>{copy.status}: {statusLabel}</p>
      {message ? <p className="helper-copy" role="alert">{message}</p> : null}
      {nextActions[currentStatus].length > 0 ? (
        <div className="booking-step-actions" aria-label={copy.updateStatus}>
          {nextActions[currentStatus].map((option) => (
            <button
              key={option}
              type="button"
              className={`button button-default ${option === 'cancelled' ? 'button-ghost merchant-style-delete' : 'button-primary'}`}
              disabled={isCompleting}
              onClick={() => changeStatus(option)}
            >
              {option === 'completed' && isCompleting ? copy.uploadingPhoto : actionLabel[option]}
            </button>
          ))}
        </div>
      ) : (
        <p className="helper-copy">{copy.terminal(statusLabel)}</p>
      )}
      {conversationId ? (
        <Link className="button button-secondary button-block" href={getMerchantMessagesPath(conversationId)}>
          {copy.openMessages}
        </Link>
      ) : null}
      <Link className="detail-back-link" href="/merchant/calendar">
        {copy.backToCalendar}
      </Link>
    </section>
  );
}
