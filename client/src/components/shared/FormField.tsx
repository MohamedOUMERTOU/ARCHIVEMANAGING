import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Libellé + champ + message d'erreur, reliés par id pour les lecteurs d'écran (aria-describedby côté champ). */
export function FormField({ id, label, error, hint, required, className, children }: FormFieldProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ''}`}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger">
            {' '}
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && <p className="text-muted text-xs">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-danger text-[13px]">
          {error}
        </p>
      )}
    </div>
  );
}
