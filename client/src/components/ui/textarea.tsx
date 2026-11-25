import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'border-line-strong bg-surface text-ink placeholder:text-muted min-h-20 w-full rounded-lg border px-3 py-2 text-sm',
        'focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-2 focus-visible:outline-none',
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}
