'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import AssetForm from '@/components/assets/asset-form';
import { useRbacSession } from '@/lib/rbac-session';

export default function NewAssetPage() {
  const router = useRouter();

  const { role, caps, isAuthenticated } = useRbacSession();

  const isDriver = role === 'CONDUCTOR';
  const canCreateAsset = caps.editInventory;

  useEffect(() => {
    if (!isAuthenticated) return;

    if (isDriver) {
      router.replace('/routes');
      return;
    }

    if (!canCreateAsset) {
      router.replace('/assets');
    }
  }, [isAuthenticated, isDriver, canCreateAsset, router]);

  if (!isAuthenticated) {
    return (
      <div
        data-testid="new-asset-session-loading"
        className="rounded-xl border bg-white p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-300"
      >
        Verificando sesión…
      </div>
    );
  }

  if (isDriver) {
    return (
      <div
        data-testid="new-asset-driver-redirect"
        className="rounded-xl border bg-white p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-300"
      >
        Redirigiendo a rutas…
      </div>
    );
  }

  if (!canCreateAsset) {
    return (
      <div
        data-testid="new-asset-denied"
        className="rounded-xl border bg-white p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300"
      >
        No tienes permisos para crear activos.
      </div>
    );
  }

  return (
    <section data-testid="new-asset-page" className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold">Nuevo Activo</h1>

        {role && (
          <p className="mt-1 text-xs text-slate-500">
            Rol: {role}
          </p>
        )}
      </div>

      <AssetForm />
    </section>
  );
}