'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AssetForm from '@/components/assets/asset-form';
import Guard from '@/components/auth-guard';
import { api, type AuthUser } from '@/lib/api';
import { capsFor, normalizeRole, type AppRole } from '@/lib/roles';

export default function NewAssetPage() {
  const router = useRouter();

  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const caps = useMemo(() => capsFor(role), [role]);
  const canCreateAsset = caps.editInventory;

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        setError(null);

        const res = await api.get('/api/auth/me');
        if (!active) return;

        const user = res.data as AuthUser;
        const normalizedRole = normalizeRole(user.role);

        if (typeof window !== 'undefined') {
          if (normalizedRole) {
            localStorage.setItem('user_role', normalizedRole);
          } else {
            localStorage.removeItem('user_role');
          }
        }

        setRole(normalizedRole);
      } catch (err) {
        console.error('Error validando usuario en creación de activo:', err);

        if (!active) return;

        setRole(null);
        setError('No se pudo validar la sesión del usuario.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadMe();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    if (role === 'CONDUCTOR') {
      router.replace('/routes');
      return;
    }

    if (!canCreateAsset) {
      router.replace('/assets');
    }
  }, [loading, role, canCreateAsset, router]);

  return (
    <Guard>
      {loading ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-300">
          Verificando permisos…
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600 dark:bg-slate-900">
          {error}
        </div>
      ) : !canCreateAsset ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          No tienes permisos para crear activos.
        </div>
      ) : (
        <section className="space-y-3">
          <h1 className="text-xl font-semibold">Nuevo Activo</h1>
          <AssetForm />
        </section>
      )}
    </Guard>
  );
}