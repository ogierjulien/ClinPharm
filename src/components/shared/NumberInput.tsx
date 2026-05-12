import React, { useId } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Label from '@radix-ui/react-label';
import { HelpCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface NumberInputProps {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  error?: string;
  tooltip?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function NumberInput({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 'any' as unknown as number,
  required = false,
  error,
  tooltip,
  disabled = false,
  placeholder,
  className,
}: NumberInputProps) {
  const uid = useId();
  const inputId = `num-input-${uid}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || raw === '-') {
      onChange(undefined);
      return;
    }
    const parsed = parseFloat(raw);
    onChange(isNaN(parsed) ? undefined : parsed);
  };

  const hasError = Boolean(error);

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className={clsx('flex flex-col gap-1', className)}>
        {/* Label row */}
        <div className="flex items-center gap-1">
          <Label.Root
            htmlFor={inputId}
            className={clsx(
              'text-xs font-medium',
              hasError ? 'text-red-600' : 'text-slate-600',
            )}
          >
            {label}
            {required && <span className="ml-0.5 text-red-500">*</span>}
          </Label.Root>

          {tooltip && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  className="text-slate-400 hover:text-indigo-500 transition-colors focus:outline-none"
                  tabIndex={-1}
                  aria-label={`Help for ${label}`}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className={clsx(
                    'z-50 max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2',
                    'text-xs text-slate-600 shadow-lg',
                    'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
                    'data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0',
                    'data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95',
                  )}
                  sideOffset={4}
                >
                  {tooltip}
                  <Tooltip.Arrow className="fill-white" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
        </div>

        {/* Input row */}
        <div className="flex items-stretch">
          <input
            id={inputId}
            type="number"
            value={value === undefined ? '' : value}
            onChange={handleChange}
            min={min}
            max={max}
            step={step}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${inputId}-error` : undefined}
            className={clsx(
              'flex-1 min-w-0 rounded-l text-sm px-3 py-1.5 border bg-white',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              unit ? 'rounded-r-none border-r-0' : 'rounded',
              hasError
                ? 'border-red-400 focus:ring-red-400 text-red-800 placeholder-red-300'
                : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 placeholder-slate-400',
              disabled && 'cursor-not-allowed bg-slate-100 text-slate-500',
            )}
          />
          {unit && (
            <span
              className={clsx(
                'inline-flex items-center rounded-r border px-2.5',
                'text-xs font-mono bg-slate-50 text-slate-500 whitespace-nowrap',
                hasError ? 'border-red-400' : 'border-slate-300',
                disabled && 'opacity-50',
              )}
            >
              {unit}
            </span>
          )}
        </div>

        {/* Error message */}
        {hasError && (
          <div
            id={`${inputId}-error`}
            className="flex items-center gap-1 text-xs text-red-600"
            role="alert"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
}
