'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import Guard from '@/components/auth-guard';
import { api, type AuthUser } from '@/lib/api';
import { capsFor, normalizeRole, type AppRole } from '@/lib/roles';

type AttachmentType = 'SOPORTE_BAJA' | 'FACTURA_COMPRA';

type Attachment = {
  id: string;
  assetId: string;
  type: AttachmentType;
  fileName: string;
  path: string;
  size: number;
  mime: string;
  createdAt: string;
};

function formatBytes(value?: number) {
  if (!value && value !== 0) return '—';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = value === 0 ? 0 : Math.floor(Math.log(value) / Math.log(1024));

  return `${(value / Math.pow(1024, index)).toFixed(1)} ${units[index]}`;
}

function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    ''
  ).replace(/\/+$/, '');
}

export default function AssetAttachmentsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [role, setRole] = useState<AppRole | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<AttachmentType>('FACTURA_COMPRA');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const caps = useMemo(() => capsFor(role), [role]);

  const canViewAsset = caps.viewInventory;
  const canManageAttachments = caps.editInventory;

  const API_BASE = getApiBase();

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
        console.error('Error validando permisos para anexos:', error);

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

    if (!canViewAsset) {
      router.replace('/assets');
    }
  }, [checkingRole, role, canViewAsset, router]);

  const listQ = useQuery({
    queryKey: ['asset-attachments', id],
    enabled: !!id && !checkingRole && canViewAsset,
    queryFn: async () => {
      const res = await api.get<{ items: Attachment[] }>(
        `/api/assets/${id}/attachments`,
      );

      return res.data;
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!canManageAttachments) {
        throw new Error('No tienes permisos para subir anexos.');
      }

      if (!file) {
        throw new Error('Selecciona un PDF o imagen.');
      }

      const allowedMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
      ];

      if (!allowedMimeTypes.includes(file.type)) {
        throw new Error('Solo se permite PDF, JPG, PNG o WEBP.');
      }

      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);

      const res = await api.post(`/api/assets/${id}/attachments`, fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return res.data as Attachment;
    },
    onSuccess: () => {
      toast.success('Anexo cargado');

      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      qc.invalidateQueries({
        queryKey: ['asset-attachments', id],
      });
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ??
          error?.message ??
          'No se pudo cargar el anexo.',
      );
    },
  });

  const remove = useMutation({
    mutationFn: async (attachmentId: string) => {
      if (!canManageAttachments) {
        throw new Error('No tienes permisos para eliminar anexos.');
      }

      await api.delete(`/api/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      toast.success('Anexo eliminado');

      qc.invalidateQueries({
        queryKey: ['asset-attachments', id],
      });
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ??
          error?.message ??
          'No se pudo eliminar el anexo.',
      );
    },
  });

  const total = listQ.data?.items?.length ?? 0;

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
      ) : !canViewAsset ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          No tienes permisos para ver anexos de activos.
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold">Anexos</h1>

            <Link
              href={`/assets/${id}`}
              className="text-sm rounded-lg border px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              ← Volver al activo
            </Link>
          </div>

          {canManageAttachments && (
            <div className="rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-3">
              <h2 className="font-medium">Nuevo anexo</h2>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <label className="text-sm">Tipo de anexo</label>

                  <select
                    value={type}
                    onChange={(event) =>
                      setType(event.target.value as AttachmentType)
                    }
                    className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                  >
                    <option value="FACTURA_COMPRA">Factura de compra</option>
                    <option value="SOPORTE_BAJA">Soporte de baja</option>
                  </select>
                </div>

                <div className="grid gap-1.5 sm:col-span-2">
                  <label className="text-sm">Archivo</label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(event) =>
                      setFile(event.target.files?.[0] ?? null)
                    }
                    className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                  />

                  <p className="text-xs text-slate-500">
                    Formatos permitidos: PDF, JPG, PNG o WEBP.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => upload.mutate()}
                  disabled={upload.isPending || !file}
                  className="rounded-xl bg-sky-700 text-white px-4 py-2 text-sm hover:bg-sky-800 disabled:opacity-60"
                >
                  {upload.isPending ? 'Cargando…' : 'Subir anexo'}
                </button>
              </div>
            </div>
          )}

          {!canManageAttachments && (
            <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Tienes acceso de solo lectura a los anexos. No puedes subir ni eliminar archivos.
            </div>
          )}

          <div className="rounded-xl border bg-white dark:bg-slate-900">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-medium">Archivos ({total})</h2>
            </div>

            <div className="p-4">
              {listQ.isLoading ? (
                <div className="text-sm text-slate-500">Cargando…</div>
              ) : total === 0 ? (
                <div className="text-sm text-slate-500">Sin anexos aún.</div>
              ) : (
                <ul className="space-y-3">
                  {listQ.data!.items.map((attachment) => {
                    const downloadUrl = API_BASE
                      ? `${API_BASE}/api/attachments/${attachment.id}/download`
                      : `/api/attachments/${attachment.id}/download`;

                    return (
                      <li
                        key={attachment.id}
                        className="rounded-lg border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {attachment.type === 'SOPORTE_BAJA'
                              ? 'Soporte de baja'
                              : 'Factura de compra'}
                          </div>

                          <div
                            className="text-xs text-slate-500 truncate max-w-[520px]"
                            title={`${attachment.fileName} • ${
                              attachment.mime || 'archivo'
                            } • ${formatBytes(attachment.size)}`}
                          >
                            {attachment.fileName} —{' '}
                            {new Date(attachment.createdAt).toLocaleString(
                              'es-CO',
                            )}{' '}
                            — {formatBytes(attachment.size)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={downloadUrl}
                            download={attachment.fileName || 'archivo'}
                            rel="noopener"
                            className="text-sm rounded-lg border px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            Descargar
                          </a>

                          {canManageAttachments && (
                            <button
                              onClick={() => {
                                const ok = confirm('¿Eliminar este anexo?');

                                if (!ok) return;

                                remove.mutate(attachment.id);
                              }}
                              disabled={remove.isPending}
                              className="text-sm rounded-lg bg-rose-600 text-white px-3 py-1.5 hover:opacity-95 disabled:opacity-60"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </Guard>
  );
}