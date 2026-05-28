'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import Guard from '@/components/auth-guard';
import { PageShell } from '@/components/common/page-shell';
import { SectionCard } from '@/components/common/section-card';

export default function AssetAttachmentsRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (!id) return;

    router.replace(`/assets/${id}`);
  }, [id, router]);

  return (
    <Guard>
      <PageShell>
        <SectionCard>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirigiendo a los anexos del activo…
          </div>
        </SectionCard>
      </PageShell>
    </Guard>
  );
}