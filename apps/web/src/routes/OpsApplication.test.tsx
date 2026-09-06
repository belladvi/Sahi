import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ id: 'app1' }),
}));

const getOpsApplication = vi.fn();
vi.mock('../lib/ops', () => ({
  getOpsApplication: (id: string) => getOpsApplication(id),
  transitionApplication: vi.fn(),
  uploadCertificate: vi.fn(),
  publishApplication: vi.fn(),
}));

const getOpsNotification = vi.fn();
vi.mock('../lib/notifications', () => ({ getOpsNotification: (id: string) => getOpsNotification(id) }));

const { OpsApplication } = await import('./OpsApplication');

const approvedApp = {
  id: 'app1',
  status: 'approved' as const,
  applicantName: 'Riya',
  businessName: 'Riya’s Kitchen',
  category: 'Manufacturer',
  subCategory: 'Bakery & Confectionery',
  products: ['cakes'],
  description: 'home cakes',
  premises: 'own',
  residentialAddress: 'BLR',
  phone: '+91••••••5678',
  email: 'riya@example.com',
  fssaiNumber: '12345678901234',
  documents: [],
  events: [],
};

describe('OpsApplication — Screen 19 entry link', () => {
  beforeEach(() => {
    navigate.mockReset();
    getOpsApplication.mockReset();
    getOpsNotification.mockReset();
    getOpsNotification.mockResolvedValue({ kind: 'missing' });
  });
  afterEach(() => cleanup());

  it('shows "View notification" only when a demo notification exists', async () => {
    getOpsApplication.mockResolvedValue(approvedApp);
    getOpsNotification.mockResolvedValue({ kind: 'ok', view: { status: 'sent' } });
    render(<OpsApplication />);
    const link = await screen.findByText(/View notification/);
    expect(link).toBeInTheDocument();
    link.closest('button')!.click();
    expect(navigate).toHaveBeenCalledWith('/ops/app1/notification');
  });

  it('hides "View notification" when none exists (feature off / pre-approval)', async () => {
    getOpsApplication.mockResolvedValue(approvedApp);
    getOpsNotification.mockResolvedValue({ kind: 'missing' });
    render(<OpsApplication />);
    await waitFor(() => expect(screen.getByText('Published · live')).toBeInTheDocument());
    expect(screen.queryByText(/View notification/)).not.toBeInTheDocument();
  });

  it('renders main content even when the optional notification probe fails', async () => {
    getOpsApplication.mockResolvedValue(approvedApp);
    getOpsNotification.mockResolvedValue({ kind: 'error' }); // probe failed
    render(<OpsApplication />);
    await waitFor(() => expect(screen.getByText('Published · live')).toBeInTheDocument());
    expect(screen.queryByText(/View notification/)).not.toBeInTheDocument();
  });

  it('shows a recoverable error (not a permanent spinner) when the load fails', async () => {
    getOpsApplication.mockRejectedValue(new Error('5xx'));
    render(<OpsApplication />);
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });
});
