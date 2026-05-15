'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { useRbacSession } from '@/lib/rbac-session';

type BulkResult = {
  created: number;
  updated: number;
  errors: { row: number; tag?: string; error: string }[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '';

export default function ImportAssetsPage() {
  const router = useRouter();

  const { role, caps, isAuthenticated } = useRbacSession();

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const isDriver = role === 'CONDUCTOR';
  const canImportAssets = caps.editInventory;

  useEffect(() => {
    if (!isAuthenticated) return;

    if (isDriver) {
      router.replace('/routes');
      return;
    }

    if (!canImportAssets) {
      router.replace('/assets');
    }
  }, [isAuthenticated, isDriver, canImportAssets, router]);

  const onSubmit = async (event: FormEvent) => {
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

  if (!isAuthenticated) {
    return (
      <div
        data-testid="import-assets-session-loading"
        className="rounded-xl border bg-white p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-300"
      >
        Verificando sesión…
      </div>
    );
  }

  if (isDriver) {
    return (
      <div
        data-testid="import-assets-driver-redirect"
        className="rounded-xl border bg-white p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-300"
      >
        Redirigiendo a rutas…
      </div>
    );
  }

  if (!canImportAssets) {
    return (
      <div
        data-testid="import-assets-denied"
        className="rounded-xl border bg-white p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300"
      >
        No tienes permisos para importar activos.
      </div>
    );
  }

  return (
    <section data-testid="import-assets-page" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Importar activos</h1>

          {role && (
            <p className="mt-1 text-xs text-slate-500">
              Rol: {role}
            </p>
          )}
        </div>

        <a
          className="text-sm underline"
          href={`${API_BASE}/api/assets/import/template`}
          target="_blank"
          rel="noreferrer"
        >
          Descargar plantilla
        </a>
      </div>

      <div className="space-y-3 rounded-xl border bg-white p-4 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Sube un <b>CSV</b> con las columnas en <b>español</b>. Si el código
          del activo ya existe, el registro se actualizará. Si no existe, se
          creará un activo nuevo.
        </p>

        <div className="rounded-lg border bg-slate-50 p-3 text-xs leading-5 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
          <div className="mb-1 font-semibold">Columnas soportadas:</div>

          <code>
            tag, nombre, serie, marca, modelo, categoria_codigo,
            categoria_nombre, ubicacion_nombre, fecha_compra, costo_compra,
            tipo_adquisicion, proveedor, numero_factura, codigo_invima,
            nivel_riesgo, garantia_hasta, estado_operativo, estado_vida,
            sede_codigo, bodega_asignada, notas
          </code>

          <div className="mt-2">
            <b>Valores válidos</b>:

            <ul className="ml-5 mt-1 list-disc">
              <li>
                <b>estado_operativo</b>: EN_BODEGA, ASIGNADO, EN_REPARACION,
                PERDIDO, BAJA
              </li>
              <li>
                <b>estado_vida</b>: ACTIVO, INACTIVO, RETIRADO
              </li>
              <li>
                <b>tipo_adquisicion</b>: COMPRA, ARRIENDO, DONACION, INTERNO,
                OTRO
              </li>
              <li>
                <b>nivel_riesgo</b>: BAJO, MEDIO, ALTO, CRITICO
              </li>
              <li>Fechas en formato YYYY-MM-DD, ejemplo: 2025-10-23</li>
            </ul>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col items-start gap-3 sm:flex-row"
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
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? 'Importando…' : 'Subir archivo'}
          </button>
        </form>
      </div>

      {result && (
        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <h2 className="mb-2 font-medium">Resultado</h2>

          <p className="text-sm">
            <b>{result.created}</b> creado(s), <b>{result.updated}</b>{' '}
            actualizado(s)
          </p>

          {result.errors.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-medium">Errores</h3>

              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left">Fila</th>
                      <th className="px-3 py-2 text-left">Tag</th>
                      <th className="px-3 py-2 text-left">Error</th>
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
  );
}