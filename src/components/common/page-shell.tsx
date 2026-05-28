import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
  return (
    <section
      className={cn(
        'mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 py-4 sm:px-4 lg:px-6 lg:py-6',
        className,
      )}
    >
      {children}
    </section>
  );
}
