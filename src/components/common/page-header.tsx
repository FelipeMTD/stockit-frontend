// src/components/common/page-header.tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('px-1', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#1B3859]">
              {eyebrow}
            </p>
          )}

          <h1 className="truncate text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
            {title}
          </h1>

          {description && (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}