// src/app/assets/import/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { toast } from 'sonner';
import Guard from '@/components/auth-guard';
import { capsFor, normalizeRole, type AppRole } from '@/lib/roles';

type BulkResult = {
  created: number;
  updated: number;
  errors: { row: number; tag?: string; error: string }[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '';

export default function ImportAssetsPage() {
  const router = useRouter();

  const [role, setRole] = useState<AppRole | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const caps = useMemo(() => capsFor(role), [role]);
  const canImportAssets = caps.editInventory;

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        setRoleError(null);

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
      } catch (error) {
        console.error('Error validando usuario en importación:', error);

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

    if (!canImportAssets) {
      router.replace('/assets');
    }
  }, [checkingRole, role, canImportAssets, router]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canImportAssets) {
      toast.error('No tienes permisos para importar activos.');
      return;
    }

    if (!file) {
      toast.error('Selecciona un archivo CSV o JSON.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const { data } = await api.post<BulkResult>('/api/assets/import', fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResult(data);

      toast.success(
        `Proceso completado: ${data.created} creado(s), ${data.updated} actualizado(s).`,
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.error ?? 'No se pudo importar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Guard>
      {checkingRole ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-300">
          Verificando permisos…
        </div>
      ) : roleError ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600 dark:bg-slate-900">
          {roleError}
        </div>
      ) : !canImportAssets ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          No tienes permisos para importar activos.
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold">Importar activos</h1>

            <a
              className="text-sm underline"
              href={`${API_BASE}/api/assets/import/template`}
              target="_blank"
              rel="noreferrer"
            >
              Descargar plantilla
            </a>
          </div>

          <div className="border rounded-xl bg-white dark:bg-slate-900 p-4 space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Sube un <b>CSV</b> con las columnas en <b>español</b>.
              Si el código del activo ya existe, el registro se actualizará.
              Si no existe, se creará un activo nuevo.
            </p>

            <div className="rounded-lg border bg-slate-50 dark:bg-slate-800/40 p-3 text-xs leading-5 text-slate-700 dark:text-slate-300">
              <div className="font-semibold mb-1">
                Columnas soportadas:
              </div>

              <code>
                tag, nombre, serie, marca, modelo, categoria_codigo,
                categoria_nombre, ubicacion_nombre, fecha_compra,
                costo_compra, tipo_adquisicion, proveedor, numero_factura,
                codigo_invima, nivel_riesgo, garantia_hasta, estado_operativo,
                estado_vida, sede_codigo, bodega_asignada, notas
              </code>

              <div className="mt-2">
                <b>Valores válidos</b>:

                <ul className="list-disc ml-5 mt-1">
                  <li>
                    <b>estado_operativo</b>: EN_BODEGA, ASIGNADO,
                    EN_REPARACION, PERDIDO, BAJA
                  </li>
                  <li>
                    <b>estado_vida</b>: ACTIVO, INACTIVO, RETIRADO
                  </li>
                  <li>
                    <b>tipo_adquisicion</b>: COMPRA, ARRIENDO, DONACION,
                    INTERNO, OTRO
                  </li>
                  <li>
                    <b>nivel_riesgo</b>: BAJO, MEDIO, ALTO, CRITICO
                  </li>
                  <li>
                    Fechas en formato YYYY-MM-DD, ejemplo: 2025-10-23
                  </li>
                </ul>
              </div>
            </div>

            <form
              onSubmit={onSubmit}
              className="flex flex-col sm:flex-row gap-3 items-start"
            >
              <input
                type="file"
                accept=".csv,text/csv,application/json,.json"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="text-sm"
              />

              <button
                type="submit"
                disabled={loading || !file}
                className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? 'Importando…' : 'Subir archivo'}
              </button>
            </form>
          </div>

          {result && (
            <div className="border rounded-xl bg-white dark:bg-slate-900 p-4">
              <h2 className="font-medium mb-2">Resultado</h2>

              <p className="text-sm">
                <b>{result.created}</b> creado(s),{' '}
                <b>{result.updated}</b> actualizado(s)
              </p>

              {result.errors.length > 0 && (
                <div className="mt-3">
                  <h3 className="font-medium text-sm">Errores</h3>

                  <div className="max-h-64 overflow-y-auto mt-2 border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr>
                          <th className="text-left px-3 py-2">Fila</th>
                          <th className="text-left px-3 py-2">Tag</th>
                          <th className="text-left px-3 py-2">Error</th>
                        </tr>
                      </thead>

                      <tbody>
                        {result.errors.map((item, index) => (
                          <tr key={`${item.row}-${index}`} className="border-t">
                            <td className="px-3 py-1">{item.row}</td>
                            <td className="px-3 py-1">{item.tag || '—'}</td>
                            <td className="px-3 py-1">{item.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </Guard>
  );
}