import { api } from './client';

export interface BillData {
  id: string; userId: string; blobUrl: string; originalFilename: string;
  contentType: string; sizeBytes: number; status: string;
  billingMonth: string | null; unitsConsumed: number | null;
  billAmount: number | null; currency: string; createdAt: string;
}

export async function uploadBill(file: File): Promise<BillData> {
  const formData = new FormData();
  formData.append('file', file);
  return api.upload<BillData>('/api/bills/upload', formData);
}

export async function getBills(): Promise<BillData[]> {
  return api.get<BillData[]>('/api/bills');
}

export async function getBill(id: string): Promise<BillData> {
  return api.get<BillData>(`/api/bills/${id}`);
}

export async function correctBill(id: string, data: {
  billingMonth?: string; unitsConsumed?: number; billAmount?: number;
}): Promise<BillData> {
  return api.put<BillData>(`/api/bills/${id}/correct`, data);
}
