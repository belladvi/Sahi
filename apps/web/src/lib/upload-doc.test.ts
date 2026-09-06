import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveDocuments, uploadDoc } from './upload-doc';

describe('document request application scope', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sahi_draft_token', 'chosen-token');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends the current draft token when requesting an upload and saving references', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ key: 'applications/app1/photo/x.jpg', upload: { url: '/signed-put', method: 'PUT', headers: { 'content-type': 'image/jpeg' } } }) })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    await uploadDoc('photo', new Blob([new Uint8Array([0xff, 0xd8, 0xff])]), 'image/jpeg', 'jpg');
    await saveDocuments({ photoKey: 'applications/app1/photo/x.jpg' });

    expect(fetchMock.mock.calls[0]![1].headers).toMatchObject({ 'x-draft-token': 'chosen-token' });
    expect(fetchMock.mock.calls[2]![1].headers).toMatchObject({ 'x-draft-token': 'chosen-token' });
  });
});
