import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fileFormA, getConfirmView } from './confirm';

describe('Form-A request application scope', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sahi_draft_token', 'chosen-token');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends the current draft token for the confirm read and Form-A mutation', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, status: 'preparing' }) });

    await getConfirmView();
    await fileFormA({ applicantName: 'Riya', businessName: 'Riya’s Kitchen', residentialAddress: 'Bengaluru', phone: '9876543210', email: '', hygieneAccepted: true });

    expect(fetchMock.mock.calls[0]![1].headers).toMatchObject({ 'x-draft-token': 'chosen-token' });
    expect(fetchMock.mock.calls[1]![1].headers).toMatchObject({ 'x-draft-token': 'chosen-token' });
  });
});
