import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Bouton compact de la barre d'outils de l'aperçu (icône seule : `label` obligatoire). */
export function ToolButton({
  label,
  pressed,
  className,
  children,
  ...props
}: ComponentProps<'button'> & { label: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        'border-line-strong bg-surface text-ink-soft hover:bg-bg hover:text-ink inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-[13px] font-medium',
        'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0',
        pressed && 'border-primary/40 bg-primary-soft text-primary-strong hover:bg-primary-soft',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ToolSeparator() {
  return <span aria-hidden="true" className="bg-line mx-1 h-5 w-px shrink-0" />;
}

/** Barre d'outils : rôle ARIA et retour à la ligne sur les écrans étroits. */
export function Toolbar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className="border-line flex flex-wrap items-center gap-1 border-b px-3 py-2"
    >
      {children}
    </div>
  );
}
