'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import Guard from '@/components/auth-guard';
import { PageShell } from '@/components/common/page-shell';
import { SectionCard } from '@/components/common/section-card';
import AssetForm, {
  type AssetFormPayload,
} from '@/components/assets/asset-form';
import { api, type Asset } from '@/lib/api';

export default function NewAssetPage() {
  const router = useRouter();

  const create = useMutation({
    mutationFn: async (data: AssetFormPayload) =>
      (await api.post<Asset>('/api/assets', data)).data,
  });

  async function handleSubmit(payload: AssetFormPayload) {
    try {
      const asset = await create.mutateAsync(payload);

      toast.success('Activo creado correctamente');
      router.replace(`/assets/${asset.id}`);
    } catch (error: any) {
      console.error('Error creando activo:', error?.response?.data ?? error);

      toast.error(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          'No se pudo crear el activo',
      );
    }
  }

  return (
    <Guard>
      <PageShell>
        <SectionCard
          title="Crear activo"
          contentClassName="p-0"
          actions={
            <button
              type="button"
              onClick={() => router.push('/assets')}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-[#1B3859] transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
          }
        >
          <AssetForm
            mode="create"
            isSubmitting={create.isPending}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/assets')}
          />
        </SectionCard>
      </PageShell>
    </Guard>
  );
}