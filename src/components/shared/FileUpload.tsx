import React, { useRef, useState, useCallback } from 'react';
import clsx from 'clsx';
import { UploadCloud, FileCheck2, XCircle } from 'lucide-react';

interface FileUploadProps {
  onUpload: (file: File) => void;
  accept?: string[];
  label?: string;
  disabled?: boolean;
  maxSizeMB?: number;
}

const DEFAULT_ACCEPT = ['.csv', '.xlsx', '.json'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({
  onUpload,
  accept = DEFAULT_ACCEPT,
  label = 'Upload file',
  disabled = false,
  maxSizeMB = 20,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptAttr = accept.join(',');
  const maxBytes = maxSizeMB * 1024 * 1024;

  const processFile = useCallback(
    (file: File) => {
      setError(null);

      // Validate extension
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!accept.includes(ext)) {
        setError(`Unsupported file type "${ext}". Accepted: ${accept.join(', ')}`);
        return;
      }

      // Validate size
      if (file.size > maxBytes) {
        setError(`File exceeds ${maxSizeMB} MB limit (${formatBytes(file.size)}).`);
        return;
      }

      setSelectedFile(file);
      onUpload(file);
    },
    [accept, maxBytes, maxSizeMB, onUpload],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input value so same file can be re-uploaded
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <p className="text-xs font-medium text-slate-600">{label}</p>
      )}

      {/* Hidden native input */}
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled}
        aria-label={label}
      />

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${label} drop zone`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick();
        }}
        className={clsx(
          'relative flex flex-col items-center justify-center gap-3',
          'rounded-xl border-2 border-dashed px-6 py-8',
          'transition-colors cursor-pointer select-none',
          disabled && 'cursor-not-allowed opacity-50',
          dragging
            ? 'border-indigo-500 bg-indigo-50'
            : selectedFile
            ? 'border-green-400 bg-green-50'
            : error
            ? 'border-red-400 bg-red-50'
            : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50',
        )}
      >
        {selectedFile ? (
          <>
            <FileCheck2 className="h-8 w-8 text-green-500" aria-hidden="true" />
            <div className="text-center">
              <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
              <p className="text-xs text-green-600 mt-0.5">{formatBytes(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
              aria-label="Remove file"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <UploadCloud
              className={clsx(
                'h-8 w-8',
                dragging ? 'text-indigo-500' : 'text-slate-400',
              )}
              aria-hidden="true"
            />
            <div className="text-center">
              <p className={clsx('text-sm font-medium', dragging ? 'text-indigo-700' : 'text-slate-600')}>
                {dragging ? 'Drop file here' : 'Drag & drop or click to browse'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {accept.join(', ')} &middot; max {maxSizeMB} MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600" role="alert">
          <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
