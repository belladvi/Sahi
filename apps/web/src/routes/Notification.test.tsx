import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import type { NotificationView } from '@sahi/shared';

const navigate = vi.fn();
let params: { id?: string } = {};
vi.mock('react-router', () => ({ useNavigate: () => navigate, useParams: () => params }));

const getMyNotification = vi.fn();
const getOpsNotification = vi.fn();
const retryOpsNotification = vi.fn();
vi.mock('../lib/notifications', () => ({
  getMyNotification: () => getMyNotification(),
  getOpsNotification: (id: string) => getOpsNotification(id),
  retryOpsNotification: (id: string, force?: boolean) => retryOpsNotification(id, force),
}));

const { Notification } = await import('./Notification');

const base: NotificationView = {
  status: 'sent', channel: 'whatsapp', attempts: 1, maxAttempts: 3, providerRef: 'mock-wa-x',
  failureReason: null, fssaiNumber: '12345678901234', businessName: 'Riya’s Kitchen',
  phoneMasked: '•••• •••• 10', certificateUrl: '/api/storage/object?key=k&exp=9&sig=a',
  sentAt: '2026-09-05T00:00:00.000Z', lastAttemptAt: '2026-09-05T00:00:00.000Z',
  exhausted: false, canRetry: false, canForceRetry: false, demo: true,
};
const sent = base;
const failedRetryable: NotificationView = { ...base, status: 'failed', failureReason: 'provider_error', attempts: 1, canRetry: true, providerRef: null };
const failedExhausted: NotificationView = { ...base, status: 'failed', failureReason: 'provider_error', attempts: 3, exhausted: true, canRetry: false, canForceRetry: true, providerRef: null };

describe('Screen 19 — resilient states (demo)', () => {
  beforeEach(() => {
    navigate.mockReset();
    getMyNotification.mockReset();
    getOpsNotification.mockReset();
    retryOpsNotification.mockReset();
    params = {};
  });
  afterEach(() => cleanup());

  it('baker success: demo label, FSSAI number, secure certificate link — no retry', async () => {
    getMyNotification.mockResolvedValue({ kind: 'ok', view: sent });
    render(<Notification />);
    await waitFor(() => expect(screen.getByText('12345678901234')).toBeInTheDocument());
    expect(screen.getByText(/Demo preview — no WhatsApp message was sent\./i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /certificate/i })).toHaveAttribute('href', sent.certificateUrl);
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('temporary load error: shows an error with a working Try again (never stuck loading)', async () => {
    getMyNotification.mockResolvedValueOnce({ kind: 'error' }).mockResolvedValueOnce({ kind: 'ok', view: sent });
    render(<Notification />);
    await waitFor(() => expect(screen.getByText(/Couldn’t load this notification/i)).toBeInTheDocument());
    expect(screen.queryByText('Loading…')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByText('Sent')).toBeInTheDocument());
  });

  it('missing: shows the no-notification state', async () => {
    getMyNotification.mockResolvedValue({ kind: 'missing' });
    render(<Notification />);
    await waitFor(() => expect(screen.getByText(/No licence-ready notification yet/i)).toBeInTheDocument());
  });

  it('baker failure: shows failure but NO retry action', async () => {
    getMyNotification.mockResolvedValue({ kind: 'ok', view: failedRetryable });
    render(<Notification />);
    await waitFor(() => expect(screen.getByText(/Delivery failed/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('ops retry success: updates to sent', async () => {
    params = { id: 'app1' };
    getOpsNotification.mockResolvedValue({ kind: 'ok', view: failedRetryable });
    retryOpsNotification.mockResolvedValue({ kind: 'ok', view: sent });
    render(<Notification />);
    fireEvent.click(await screen.findByRole('button', { name: /retry delivery/i }));
    await waitFor(() => expect(retryOpsNotification).toHaveBeenCalledWith('app1', false));
    await waitFor(() => expect(screen.getByText('Sent')).toBeInTheDocument());
  });

  it('ops retry error: button is not left stuck in Retrying', async () => {
    params = { id: 'app1' };
    getOpsNotification.mockResolvedValue({ kind: 'ok', view: failedRetryable });
    retryOpsNotification.mockResolvedValue({ kind: 'error' });
    render(<Notification />);
    fireEvent.click(await screen.findByRole('button', { name: /retry delivery/i }));
    await waitFor(() => expect(screen.getByText(/Retry didn’t go through/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry delivery/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /retrying/i })).toBeNull();
  });

  it('ops exhausted: only a force retry is offered, and it passes force=true', async () => {
    params = { id: 'app1' };
    getOpsNotification.mockResolvedValue({ kind: 'ok', view: failedExhausted });
    retryOpsNotification.mockResolvedValue({ kind: 'ok', view: sent });
    render(<Notification />);
    const force = await screen.findByRole('button', { name: /retry anyway/i });
    expect(screen.queryByRole('button', { name: /^retry delivery$/i })).toBeNull();
    fireEvent.click(force);
    await waitFor(() => expect(retryOpsNotification).toHaveBeenCalledWith('app1', true));
  });
});
