'use client';

import { useRef, useState, type DragEvent } from 'react';
import { FileText, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/format';

interface ResumeDropzoneProps {
  file: File | null;
  error: string | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
}

const ACCEPT =
  '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function ResumeDropzone({ file, error, onFileSelect, onRemove }: ResumeDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) onFileSelect(dropped);
  }

  return (
    <div className="flex flex-col gap-3">
      {file ? (
        <div className="animate-fade-up flex items-center gap-4 rounded-2xl border border-border bg-white p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50">
            <FileText className="h-6 w-6 text-rose-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{file.name}</p>
            <p className="text-sm text-muted-foreground">{formatFileSize(file.size)} · Ready to analyze</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove resume"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex min-h-[240px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isDragging
              ? 'scale-[1.01] border-brand-500 bg-brand-50'
              : 'border-slate-300 bg-slate-50/70 hover:border-brand-500 hover:bg-brand-50/50',
          )}
        >
          <span
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm transition-transform duration-200',
              isDragging && '-translate-y-1',
            )}
          >
            <UploadCloud className="h-7 w-7 text-brand-600" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-medium text-foreground">Drag your resume here</p>
            <p className="text-sm text-muted-foreground">
              or <span className="font-semibold text-brand-600 underline underline-offset-4">browse files</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">PDF or DOCX, up to 5 MB</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) onFileSelect(selected);
          event.target.value = '';
        }}
      />
      {error ? (
        <p role="alert" className="text-sm font-medium text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
