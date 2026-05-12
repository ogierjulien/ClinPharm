import React from 'react';
import clsx from 'clsx';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function LoadingSpinner({
  label,
  size = 'md',
  className,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-[3px]',
  };

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3 p-8',
        className,
      )}
    >
      <div
        className={clsx(
          'rounded-full border-slate-200 border-t-indigo-600 animate-spin',
          sizeClasses[size],
        )}
        role="status"
        aria-label={label ?? 'Loading'}
      />
      {label && (
        <p className="text-sm text-slate-500 font-medium">{label}</p>
      )}
    </div>
  );
}
