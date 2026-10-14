import { describe, it, expect, vi, afterEach } from 'vitest';
import { lookupProduct, estimateEmbodiedCarbon } from './products';

function stubFetch(payload: unknown, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => payload,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('products API helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lookupProduct posts the barcode and returns parsed data', async () => {
    const data = { found: true, productName: 'Choco Bar', brand: 'YumCo', categoryGuess: 'packaged_food' };
    const fetchMock = stubFetch(data);

    const res = await lookupProduct('737628064502');

    expect(res).toEqual(data);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/api/products/lookup');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual({ barcode: '737628064502' });
  });

  it('lookupProduct surfaces a not-found result', async () => {
    const data = { found: false, productName: null, brand: null, categoryGuess: null };
    stubFetch(data);

    const res = await lookupProduct('000000000000');

    expect(res.found).toBe(false);
  });

  it('estimateEmbodiedCarbon posts category/quantity/productName and returns parsed data', async () => {
    const data = {
      category: 'electronics',
      estimatedKgCo2e: 170,
      factorSource: 'Representative default',
      alternativeSuggestion: { type: 'seed_alternative', text: 'Consider refurbished…', estimatedKgCo2e: 30 },
    };
    const fetchMock = stubFetch(data);

    const res = await estimateEmbodiedCarbon('electronics', 2, 'Phone');

    expect(res).toEqual(data);
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({
      category: 'electronics',
      quantity: 2,
      productName: 'Phone',
    });
  });

  it('estimateEmbodiedCarbon omits productName when not provided', async () => {
    const data = {
      category: 'books',
      estimatedKgCo2e: 2.5,
      factorSource: 'Representative default',
      alternativeSuggestion: { type: 'seed_alternative', text: 'Go secondhand…', estimatedKgCo2e: 0.3 },
    };
    const fetchMock = stubFetch(data);

    await estimateEmbodiedCarbon('books', 1);

    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(options.body as string).productName).toBeUndefined();
  });
});
