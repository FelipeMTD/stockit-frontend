'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import Guard from '@/components/auth-guard';
import { PageShell } from '@/components/common/page-shell';
import { SectionCard } from '@/components/common/section-card';
import AssetForm, {
  type AssetFormPayload,
  type AssetFormValue,
  type MaintenanceFrequency,
} from '@/components/assets/asset-form';
import { api, type AuthUser } from '@/lib/api';
import { useAsset } from '@/lib/asset-hooks';
import { capsFor, normalizeRole, type AppRole } from '@/lib/roles';

function toYYYYMMDD(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

function mapAssetToFormValue(asset: any): Partial<AssetFormValue> {
  const maintenanceFrequency =
    (asset?.maintenanceFrequency as MaintenanceFrequency | null | undefined) ??
    'NO_APLICA';

  return {
    tag: asset?.tag || '',
    name: asset?.name || '',
    serial: asset?.serial || '',
    categoryId: asset?.category?.id || asset?.categoryId || '',
    brand: asset?.brand || '',
    model: asset?.model || '',
    supplierName: asset?.supplierName || '',
    invoiceNumber: asset?.invoiceNumber || '',
    invimaCode: asset?.invimaCode || '',
    purchaseCost: asset?.purchaseCost ?? '',
    purchaseDate: toYYYYMMDD(asset?.purchaseDate),
    warrantyUntil: toYYYYMMDD(asset?.warrantyUntil),
    acquisitionType: asset?.acquisitionType || '',
    riskLevel: asset?.riskLevel || '',
    maintenanceFrequency,
    status: asset?.status || 'IN_STOCK',
    lifeState: asset?.lifeState || 'ACTIVE',
    photoUrl: asset?.photoUrl || '',
    notes: asset?.notes || '',
    siteId: asset?.site?.id || asset?.siteId || '',
    currentLocationId:
      asset?.currentLocation?.id || asset?.currentLocationId || '',
    assignedWarehouseId:
      asset?.assignedWarehouse?.id || asset?.assignedWarehouseId || '',
  };
}

export default function EditAssetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: asset, isLoading } = useAsset(String(id));

  const [role, setRole] = useState<AppRole | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  const caps = useMemo(() => capsFor(role), [role]);
  const canEditAsset = caps.editInventory;

  const update = useMutation({
    mutationFn: async (payload: AssetFormPayload) =>
      api.patch(`/api/assets/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', id] });
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
  });

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        setRoleError(null);

        const res = await api.get('/api/auth/me');
        const raw = res.data as any;
        const user = (raw?.user ?? raw) as AuthUser;
        const normalizedRole = normalizeRole(user.role);

        if (!active) return;

        if (typeof window !== 'undefined') {
          if (normalizedRole) {
            localStorage.setItem('user_role', normalizedRole);
          } else {
            localStorage.removeItem('user_role');
          }
        }

        setRole(normalizedRole);
      } catch (error) {
        console.error('Error validando permisos para editar activo:', error);

        if (!active) return;

        setRole(null);
        setRoleError('No se pudo validar la sesión del usuario.');
      } finally {
        if (active) {
          setCheckingRole(false);
        }
      }
    }

    loadMe();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (checkingRole) return;

    if (role === 'CONDUCTOR') {
      router.replace('/routes');
      return;
    }

    if (!canEditAsset) {
      router.replace(`/assets/${id}`);
    }
  }, [checkingRole, role, canEditAsset, router, id]);

  async function handleSubmit(payload: AssetFormPayload) {
    if (!canEditAsset) {
      toast.error('No tienes permisos para editar activos.');
      return;
    }

    try {
      await update.mutateAsync(payload);

      toast.success('Activo actualizado con éxito');
      router.push(`/assets/${id}`);
    } catch (error: any) {
      console.error('Error actualizando activo:', error?.response?.data ?? error);

      toast.error(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          'No se pudo actualizar el activo',
      );
    }
  }

  if (checkingRole || isLoading) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando permisos y cargando activo…
            </div>
          </SectionCard>
        </PageShell>
      </Guard>
    );
  }

  if (roleError) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <p className="text-sm font-medium text-red-600">{roleError}</p>
          </SectionCard>
        </PageShell>
      </Guard>
    );
  }

  if (!asset) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <p className="text-sm text-slate-600">Activo no encontrado.</p>
          </SectionCard>
        </PageShell>
      </Guard>
    );
  }

  if (!canEditAsset) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <p className="text-sm text-slate-600">
              No tienes permisos para editar activos.
            </p>
          </SectionCard>
        </PageShell>
      </Guard>
    );
  }

  return (
    <Guard>
      <PageShell>
        <SectionCard
          title="Editar activo"
          contentClassName="p-0"
          actions={
            <button
              type="button"
              onClick={() => router.push(`/assets/${id}`)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-[#1B3859] transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
          }
        >
          <AssetForm
            mode="edit"
            initialValue={mapAssetToFormValue(asset)}
            isSubmitting={update.isPending}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/assets/${id}`)}
          />
        </SectionCard>
      </PageShell>
    </Guard>
  );
}