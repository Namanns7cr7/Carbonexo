import { describe, it, expect, vi, afterEach } from 'vitest';
import { uploadBill, getBills, getBill, correctBill } from './bills';

function stubFetch(payload: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: true, status: 200, statusText: 'OK', json: async () => payload,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('bills API helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uploadBill posts multipart FormData (no JSON content-type)', async () => {
    const fetchMock = stubFetch({ id: 'b1', status: 'PROCESSING' });
    const file = new Blob(['%PDF-1'], { type: 'application/pdf' }) as unknown as File;

    const res = await uploadBill(file);

    expect(res.id).toBe('b1');
    const opts = (fetchMock.mock.calls[0] as any)[1] as RequestInit;
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeInstanceOf(FormData);
    // FormData uploads must NOT carry a JSON content-type header
    expect((opts.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/bills/upload');
  });

  it('getBills reads the bills list', async () => {
    const fetchMock = stubFetch([{ id: 'b1' }]);
    const res = await getBills();
    expect(res).toHaveLength(1);
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/bills');
  });

  it('getBill reads a single bill by id', async () => {
    const fetchMock = stubFetch({ id: 'b9' });
    const res = await getBill('b9');
    expect(res.id).toBe('b9');
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/bills/b9');
  });

  it('correctBill PUTs the corrected fields', async () => {
    const fetchMock = stubFetch({ id: 'b1', unitsConsumed: 320 });
    await correctBill('b1', { unitsConsumed: 320, billAmount: 1450 });
    const opts = (fetchMock.mock.calls[0] as any)[1] as RequestInit;
    expect(opts.method).toBe('PUT');
    expect(opts.body).toContain('320');
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/bills/b1/correct');
  });
});
