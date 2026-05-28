import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SectionCardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <div className={cn('stock-card overflow-hidden', className)}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 className="text-base font-semibold text-[var(--stock-blue-dark)]">
                {title}
              </h2>
            )}

            {description && (
              <p className="mt-1 text-sm leading-5 text-slate-500">
                {description}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}

      <div className={cn('p-4 sm:p-5', contentClassName)}>{children}</div>
    </div>
  );
}
