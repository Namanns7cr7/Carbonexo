'use client';

import { useState, type DragEvent } from 'react';
import { uploadBill, type BillData } from '@/lib/api/bills';

interface BillUploadProps {
  onUploadSuccess: (bill: BillData) => void;
}

export function BillUpload({ onUploadSuccess }: BillUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Supported formats: PDF, PNG, JPG, JPEG');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size too large. Max allowed is 10 MB');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await uploadBill(file);
      onUploadSuccess(result);
    } catch (err: any) {
      setError(err.message || 'Failed to upload and scan bill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <label
        htmlFor="bill-file-input"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-[20px] border-2 border-dashed p-6 text-center transition-all ${
          dragActive
            ? 'border-lime bg-lime-soft/30'
            : 'border-border bg-surface hover:border-lime/60 hover:bg-surface2'
        }`}
      >
        <input
          id="bill-file-input"
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleChange}
          disabled={loading}
          aria-label="Upload electricity bill file"
        />
        <div className="flex flex-col items-center gap-2">
          {loading ? (
            <>
              <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-lime" />
              <p className="text-sm font-bold text-text">Uploading & analyzing bill with AI...</p>
              <p className="text-xs text-muted">This may take a moment</p>
            </>
          ) : (
            <>
              <span className="text-4xl">📄</span>
              <p className="text-sm font-bold text-text">
                Drag & drop your electricity bill, or <span className="text-lime-deep underline">browse</span>
              </p>
              <p className="text-xs text-muted">Supports PDF, PNG, JPG, JPEG up to 10MB</p>
            </>
          )}
        </div>
      </label>

      {error && (
        <div className="mt-3 rounded-xl bg-blue-soft/20 border border-blue/30 px-4 py-3 text-xs font-semibold text-blue text-center">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
