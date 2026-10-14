import { api } from './client';

export interface ProductLookupResult {
  found: boolean;
  productName: string | null;
  brand: string | null;
  categoryGuess: string | null;
}

export interface AlternativeSuggestion {
  type: string;
  text: string;
  estimatedKgCo2e: number | null;
}

export interface ProductEstimateResult {
  category: string;
  estimatedKgCo2e: number;
  factorSource: string | null;
  alternativeSuggestion: AlternativeSuggestion;
}

export async function lookupProduct(barcode: string): Promise<ProductLookupResult> {
  return api.post<ProductLookupResult>('/api/products/lookup', { barcode });
}

export async function estimateEmbodiedCarbon(
  category: string,
  quantity: number,
  productName?: string
): Promise<ProductEstimateResult> {
  return api.post<ProductEstimateResult>('/api/products/estimate', { category, quantity, productName });
}
