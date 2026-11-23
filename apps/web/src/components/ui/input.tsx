import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'border-line-strong bg-surface text-ink placeholder:text-muted h-11 w-full rounded-lg border px-3 text-[15px]',
        'focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-2 focus-visible:outline-none',
        'aria-invalid:border-danger aria-invalid:ring-danger/20 disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
