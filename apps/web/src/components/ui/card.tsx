import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('border-line bg-surface rounded-xl border p-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('font-display text-ink text-[15px] font-semibold', className)} {...props} />;
}
