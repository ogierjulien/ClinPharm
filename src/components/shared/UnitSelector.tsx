import React from 'react';
import * as Select from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';
import * as Label from '@radix-ui/react-label';

interface UnitOption {
  value: string;
  label: string;
}

interface UnitSelectorProps {
  value: string;
  onChange: (unit: string) => void;
  options: UnitOption[];
  label?: string;
  id?: string;
  disabled?: boolean;
}

export default function UnitSelector({
  value,
  onChange,
  options,
  label,
  id,
  disabled = false,
}: UnitSelectorProps) {
  const inputId = id ?? `unit-selector-${label?.replace(/\s+/g, '-').toLowerCase() ?? 'default'}`;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <Label.Root
          htmlFor={inputId}
          className="text-xs font-medium text-slate-600"
        >
          {label}
        </Label.Root>
      )}

      <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger
          id={inputId}
          className={clsx(
            'inline-flex items-center justify-between gap-1.5',
            'rounded border border-slate-300 bg-white px-2.5 py-1.5',
            'text-xs font-mono text-slate-700',
            'hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
            'data-[state=open]:border-indigo-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'min-w-[7rem]',
          )}
          aria-label={label ?? 'Select unit'}
        >
          <Select.Value />
          <Select.Icon asChild>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className={clsx(
              'z-50 min-w-[8rem] overflow-hidden rounded-lg border border-slate-200',
              'bg-white shadow-lg',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            )}
            position="popper"
            sideOffset={4}
          >
            <Select.Viewport className="p-1">
              {options.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className={clsx(
                    'relative flex cursor-default select-none items-center rounded',
                    'px-2 py-1.5 pl-7 text-xs font-mono text-slate-700',
                    'hover:bg-indigo-50 hover:text-indigo-900',
                    'focus:bg-indigo-50 focus:text-indigo-900 focus:outline-none',
                    'data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-900',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  )}
                >
                  <Select.ItemIndicator className="absolute left-1.5 flex h-4 w-4 items-center justify-center">
                    <Check className="h-3 w-3 text-indigo-600" />
                  </Select.ItemIndicator>
                  <Select.ItemText>{opt.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
