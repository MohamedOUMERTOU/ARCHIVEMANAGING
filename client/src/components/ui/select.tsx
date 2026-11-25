import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Liste déroulante native : accessible au clavier et lisible par les lecteurs d'écran sans effort. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'border-line-strong bg-surface text-ink h-10 w-full min-w-0 rounded-lg border px-2.5 text-sm',
        'focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-2 focus-visible:outline-none',
        'aria-invalid:border-danger disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
