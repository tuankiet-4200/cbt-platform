import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  depth?: number;
  disabled?: boolean;
}

export function SelectField({
  value,
  options,
  onChange,
  placeholder = 'Select option',
  disabled,
  className,
  buttonClassName,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);
  const isDisabled = disabled || options.length === 0;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        id={id}
        type="button"
        className={cn(
          'flex h-10 w-full items-center justify-between gap-3 rounded-md border border-neutral-300 bg-white px-3 text-left text-sm text-neutral-900 shadow-sm transition',
          'hover:border-neutral-400 hover:bg-neutral-50',
          'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/15',
          isDisabled && 'cursor-not-allowed bg-neutral-50 text-neutral-400 hover:border-neutral-300 hover:bg-neutral-50',
          open && 'border-primary-500 ring-2 ring-primary-500/15',
          buttonClassName,
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isDisabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn('truncate', !selected && 'text-neutral-400')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-neutral-400 transition', open && 'rotate-180 text-primary-600')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl shadow-neutral-900/12">
          <div className="max-h-72 overflow-y-auto p-1">
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value || '__empty'}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={option.disabled}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition',
                    active ? 'bg-primary-50 text-primary-700' : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950',
                    option.disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent',
                  )}
                  onClick={() => {
                    if (option.disabled) return;
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    {active && <Check className="h-4 w-4" />}
                  </span>
                  <span className="relative min-w-0 flex-1" style={{ paddingLeft: `${(option.depth ?? 0) * 1.05}rem` }}>
                    {(option.depth ?? 0) > 0 && (
                      <span className="absolute left-0 top-0 h-full w-3 border-l border-neutral-200 before:absolute before:left-0 before:top-1/2 before:h-px before:w-3 before:bg-neutral-200" />
                    )}
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description && <span className="mt-0.5 block text-xs text-neutral-500">{option.description}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
