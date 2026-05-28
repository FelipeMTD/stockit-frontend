'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Edit3,
  Eye,
  FileText,
  ImageIcon,
  Loader2,
  MapPin,
  Paperclip,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Wrench,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import Guard from '@/components/auth-guard';
import { PageShell } from '@/components/common/page-shell';
import { SectionCard } from '@/components/common/section-card';
import { api, type AuthUser } from '@/lib/api';
import { useAsset, useAssetMovements } from '@/lib/asset-hooks';
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

type PreviewFile = {
  url: string;
  name: string;
  isImage: boolean;
  objectUrl?: boolean;
};

function formatBytes(value?: number) {
  if (!value && value !== 0) return '—';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = value === 0 ? 0 : Math.floor(Math.log(value) / Math.log(1024));

  return `${(value / Math.pow(1024, index)).toFixed(1)} ${units[index]}`;
}

function fDate(value?: string | Date | null) {
  if (!value) return '—';

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-CO');
}

function fDateTime(value?: string | Date | null) {
  if (!value) return '—';

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-CO');
}

function formatCurrency(value?: number | null) {
  if (value == null) return '—';

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function translateMovement(type?: string) {
  const map: Record<string, string> = {
    ASSIGN: 'Entrega',
    RETURN: 'Recogida',
    TRANSFER: 'Traslado',
    STOCK_IN: 'Ingreso inicial',
    STOCK_OUT: 'Salida de inventario',
    MAINTENANCE_OUT: 'Salida a mantenimiento',
    MAINTENANCE_IN: 'Regreso de mantenimiento',
  };

  return map[String(type || '')] || String(type || 'Movimiento');
}

function translateStatus(status?: string | null) {
  const map: Record<string, string> = {
    IN_STOCK: 'En bodega',
    ASSIGNED: 'Asignado',
    IN_REPAIR: 'En reparación',
    LOST: 'Perdido',
    DISPOSED: 'De baja',
  };

  return map[String(status || '')] || String(status || '—');
}

function translateLifeState(status?: string | null) {
  const map: Record<string, string> = {
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    RETIRED: 'Retirado',
  };

  return map[String(status || '')] || String(status || '—');
}

function getApiBase() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    'http://localhost:4000';

  return raw.replace(/\/+$/, '');
}

function InfoItem({
  label,
  value,
  strong,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>

      <div
        className={[
          'mt-1 text-sm leading-6 text-slate-700',
          strong ? 'font-semibold text-[#111827]' : '',
        ].join(' ')}
      >
        {value || '—'}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const value = String(status || '');

  const className =
    value === 'IN_STOCK'
      ? 'border-[#54BF5B]/30 bg-[#54BF5B]/10 text-[#16803A]'
      : value === 'ASSIGNED'
        ? 'border-[#3C9CD1]/30 bg-[#3C9CD1]/10 text-[#1B3859]'
        : value === 'IN_REPAIR'
          ? 'border-[#A7C349]/40 bg-[#A7C349]/15 text-[#5D711D]'
          : value === 'LOST' || value === 'DISPOSED'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <span
      className={[
        'inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold',
        className,
      ].join(' ')}
    >
      {translateStatus(value)}
    </span>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export default function AssetDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const router = useRouter();

  const backToAssets = () => {
    let from = '';

    if (typeof window !== 'undefined') {
      from = new URLSearchParams(window.location.search).get('from') ?? '';
    }

    if (from && from.startsWith('/assets')) {
      router.push(from);
      return;
    }

    router.push('/assets');
  };

  const qc = useQueryClient();

  const { data: asset, isLoading, error } = useAsset(id);
  const { data: movementsData, isLoading: loadingMovements } =
    useAssetMovements(id);

  const movements = movementsData?.items || [];

  const [selectedMovement, setSelectedMovement] = useState<any | null>(null);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [attType, setAttType] = useState<AttachmentType>('FACTURA_COMPRA');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [role, setRole] = useState<AppRole | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  const caps = useMemo(() => capsFor(role), [role]);

  const canViewAsset = caps.viewInventory;
  const canEditAsset = caps.editInventory;
  const canManageAttachments = caps.editInventory;
  const canDeleteAsset = role === 'SUPER_ADMIN' || role === 'ACTIVOS_FIJOS';

  const API_BASE = getApiBase();

  const getSecureUrl = (rawPath: string) => {
    if (!rawPath) return '';

    let clean = rawPath;

    if (clean.startsWith('http')) {
      try {
        clean = new URL(clean).pathname;
      } catch {
        // Se conserva el valor original.
      }
    }

    const uploadIndex = clean.indexOf('/uploads/');

    if (uploadIndex !== -1) {
      clean = clean.substring(uploadIndex);
    }

    return encodeURI(`${API_BASE}/${clean.replace(/^\/+/, '')}`);
  };

  const toAbsoluteApiUrl = (url?: string | null) => {
    if (!url) return '';

    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
  };

  const getMovementHandoverId = (movement: any) => {
    if (movement?.handover?.id) return movement.handover.id;

    const reference = String(movement?.reference || '').trim();

    if (reference.startsWith('H:')) {
      return reference.replace('H:', '').trim();
    }

    const notes = String(movement?.notes || '').trim();

    const match = notes.match(
      /Generada desde Entregas y Recogidas ([a-zA-Z0-9_-]+)/i,
    );

    return match?.[1]?.trim() || null;
  };

  const getMovementComodatoUrl = (movement: any) => {
    if (movement?.handover?.comodatoUrl) {
      return movement.handover.comodatoUrl;
    }

    const handoverId = getMovementHandoverId(movement);

    if (!handoverId) return null;

    return `/api/handover/${handoverId}/comodato?inline=1`;
  };

  const getMovementComodatoDownloadUrl = (movement: any) => {
    if (movement?.handover?.comodatoDownloadUrl) {
      return movement.handover.comodatoDownloadUrl;
    }

    const handoverId = getMovementHandoverId(movement);

    if (!handoverId) return null;

    return `/api/handover/${handoverId}/comodato`;
  };

  const handlePreviewApiFile = async (url: string, name: string) => {
    try {
      if (previewFile?.objectUrl) {
        window.URL.revokeObjectURL(previewFile.url);
      }

      const res = await api.get(url, {
        responseType: 'blob',
      });

      const mime = res.headers?.['content-type'] || 'application/pdf';

      const blob = new Blob([res.data], {
        type: mime,
      });

      const objectUrl = window.URL.createObjectURL(blob);

      setPreviewFile({
        url: objectUrl,
        name,
        isImage: mime.startsWith('image/'),
        objectUrl: true,
      });
    } catch (err: any) {
      console.error(
        'Error abriendo archivo del trámite:',
        err?.response ?? err,
      );

      toast.error(
        err?.response?.data?.error ||
          err?.message ||
          'No se pudo abrir el archivo.',
      );
    }
  };

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
      } catch (err) {
        console.error('Error validando usuario en detalle de activo:', err);

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

  useEffect(() => {
    return () => {
      if (previewFile?.objectUrl) {
        window.URL.revokeObjectURL(previewFile.url);
      }
    };
  }, [previewFile]);

  const listAttachmentsQ = useQuery({
    queryKey: ['asset-attachments', id],
    queryFn: async () =>
      (await api.get<{ items: Attachment[] }>(`/api/assets/${id}/attachments`))
        .data,
    enabled: !!id,
  });

  const uploadAttachment = useMutation({
    mutationFn: async () => {
      if (!canManageAttachments) {
        throw new Error('No tienes permisos para subir anexos.');
      }

      if (!file) {
        throw new Error('Selecciona un documento PDF o imagen.');
      }

      const formData = new FormData();

      formData.append('file', file);
      formData.append('type', attType);

      const res = await api.post(`/api/assets/${id}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return res.data as Attachment;
    },
    onSuccess: () => {
      toast.success('Anexo cargado exitosamente');

      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      qc.invalidateQueries({
        queryKey: ['asset-attachments', id],
      });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.error ??
          err?.message ??
          'Error al cargar el anexo.',
      );
    },
  });

  const removeAttachment = useMutation({
    mutationFn: async (attachmentId: string) => {
      if (!canManageAttachments) {
        throw new Error('No tienes permisos para eliminar anexos.');
      }

      return api.delete(`/api/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      toast.success('Anexo eliminado');

      qc.invalidateQueries({
        queryKey: ['asset-attachments', id],
      });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.error ??
          err?.message ??
          'Error al eliminar el anexo.',
      );
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async () => {
      if (!canDeleteAsset) {
        throw new Error('No tienes permisos para eliminar activos.');
      }

      return api.delete(`/api/assets/${id}`);
    },
    onSuccess: () => {
      toast.success('Activo eliminado exitosamente');
      router.push('/assets');
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.error ??
          err?.message ??
          'Error al eliminar el activo. Es posible que tenga movimientos asociados.',
      );
    },
  });

  const handlePreview = async (attachment: Attachment) => {
    try {
      if (previewFile?.objectUrl) {
        window.URL.revokeObjectURL(previewFile.url);
      }

      const res = await api.get(`/api/attachments/${attachment.id}/download`, {
        params: {
          inline: '1',
        },
        responseType: 'blob',
      });

      const mime =
        attachment.mime ||
        res.headers?.['content-type'] ||
        'application/octet-stream';

      const blob = new Blob([res.data], {
        type: mime,
      });

      const objectUrl = window.URL.createObjectURL(blob);

      setPreviewFile({
        url: objectUrl,
        name: attachment.fileName,
        isImage: mime.startsWith('image/'),
        objectUrl: true,
      });
    } catch (err: any) {
      console.error('Error abriendo anexo:', err?.response ?? err);

      toast.error(
        err?.response?.data?.error ||
          err?.message ||
          'No se pudo abrir el anexo.',
      );
    }
  };

  const handleClosePreview = () => {
    if (previewFile?.objectUrl) {
      window.URL.revokeObjectURL(previewFile.url);
    }

    setPreviewFile(null);
  };

  const handleDeleteAsset = () => {
    if (!canDeleteAsset) {
      toast.error('No tienes permisos para eliminar activos.');
      return;
    }

    const ok = confirm(
      `¿Estás seguro de eliminar el activo ${asset?.tag}? Esta acción no se puede deshacer.`,
    );

    if (ok) {
      deleteAssetMutation.mutate();
    }
  };

  const attachments = listAttachmentsQ.data?.items || [];

  if (checkingRole || isLoading) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando activo…
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

  if (!canViewAsset) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <p className="text-sm text-slate-600">
              No tienes permisos para ver inventario.
            </p>
          </SectionCard>
        </PageShell>
      </Guard>
    );
  }

  if (error || !asset) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <p className="text-sm font-medium text-red-600">
              Error al cargar el activo.
            </p>
          </SectionCard>
        </PageShell>
      </Guard>
    );
  }

  const status = String(asset.status || 'IN_STOCK');
  const lifeState = String(asset.lifeState || 'ACTIVE');
  const photoUrl = asset.photoUrl || '';

  return (
    <Guard>
      <PageShell>
        <SectionCard contentClassName="p-0">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt={asset.name || asset.tag || 'Activo'}
                    className="h-16 w-16 shrink-0 rounded-2xl border border-slate-200 bg-white object-cover shadow-sm"
                  />
                ) : (
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}

                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-[#111827]">
                    {asset.tag || 'Activo'}
                  </h1>

                  <p className="mt-1 truncate text-sm font-medium text-slate-600">
                    {asset.name || 'Sin nombre'}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusPill status={status} />

                    <span className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600">
                      {translateLifeState(lifeState)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
                <button
                  type="button"
                  onClick={backToAssets}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-[#1B3859] transition hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </button>

                {canEditAsset && (
                  <Link
                    href={`/assets/${id}/edit`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132B45]"
                  >
                    <Edit3 className="h-4 w-4" />
                    Editar
                  </Link>
                )}

                {canDeleteAsset && (
                  <button
                    type="button"
                    onClick={handleDeleteAsset}
                    disabled={deleteAssetMutation.isPending}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteAssetMutation.isPending ? 'Eliminando…' : 'Eliminar'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6 p-4 sm:p-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>

                  <h2 className="text-sm font-semibold text-[#1B3859]">
                    Identificación
                  </h2>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <InfoItem label="Código / Tag" value={asset.tag} strong />
                  <InfoItem label="Categoría" value={asset.category?.name} />
                  <InfoItem label="Serial" value={asset.serial} />
                  <InfoItem label="Invima" value={asset.invimaCode} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#54BF5B]/10 text-[#16803A]">
                    <MapPin className="h-5 w-5" />
                  </div>

                  <h2 className="text-sm font-semibold text-[#1B3859]">
                    Ubicación y custodia
                  </h2>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <InfoItem label="Sede" value={asset.site?.name} />
                  <InfoItem
                    label="Ubicación actual"
                    value={
                      asset.currentLocation?.name ||
                      asset.assignedWarehouse?.name ||
                      '—'
                    }
                  />
                  <InfoItem
                    label="Bodega asignada"
                    value={asset.assignedWarehouse?.name}
                  />
                  <InfoItem
                    label="Custodio"
                    value={
                      asset.currentCustodian?.fullName ? (
                        <span>
                          {asset.currentCustodian.fullName}
                          {asset.currentCustodian.documentId && (
                            <span className="block text-xs text-slate-500">
                              Documento: {asset.currentCustodian.documentId}
                            </span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )
                    }
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
                    <FileText className="h-5 w-5" />
                  </div>

                  <h2 className="text-sm font-semibold text-[#1B3859]">
                    Datos técnicos y compra
                  </h2>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <InfoItem label="Marca" value={asset.brand} />
                  <InfoItem label="Modelo" value={asset.model} />
                  <InfoItem label="Proveedor" value={asset.supplierName} />
                  <InfoItem label="Factura" value={asset.invoiceNumber} />
                  <InfoItem
                    label="Tipo adquisición"
                    value={asset.acquisitionType}
                  />
                  <InfoItem
                    label="Valor"
                    value={formatCurrency(asset.purchaseCost)}
                    strong
                  />
                  <InfoItem
                    label="Fecha compra"
                    value={fDate(asset.purchaseDate)}
                  />
                  <InfoItem
                    label="Garantía hasta"
                    value={fDate(asset.warrantyUntil)}
                  />
                  <InfoItem label="Nivel riesgo" value={asset.riskLevel} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#A7C349]/15 text-[#5D711D]">
                    <Wrench className="h-5 w-5" />
                  </div>

                  <h2 className="text-sm font-semibold text-[#1B3859]">
                    Mantenimiento y observaciones
                  </h2>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <InfoItem
                    label="Frecuencia"
                    value={asset.maintenanceFrequency || 'NO_APLICA'}
                  />
                  <InfoItem
                    label="Estado vida útil"
                    value={translateLifeState(lifeState)}
                  />
                </div>

                {asset.notes && (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Notas
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {asset.notes}
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
                    <CalendarDays className="h-5 w-5" />
                  </div>

                  <h2 className="text-sm font-semibold text-[#1B3859]">
                    Historial de movimientos
                  </h2>
                </div>

                {loadingMovements ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando historial…
                  </div>
                ) : movements.length === 0 ? (
                  <EmptyState>
                    No hay movimientos registrados para este activo.
                  </EmptyState>
                ) : (
                  <div className="space-y-3">
                    {movements.map((movement: any) => {
                      const handover = movement.handover;
                      const comodatoUrl = getMovementComodatoUrl(movement);
                      const comodatoDownloadUrl =
                        getMovementComodatoDownloadUrl(movement);
                      const handoverId = getMovementHandoverId(movement);

                      return (
                        <article
                          key={movement.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-[#3C9CD1]/40 hover:bg-[#3C9CD1]/5"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedMovement(movement)}
                            className="w-full text-left"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-[#111827]">
                                  {translateMovement(movement.type)}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  Registrado por:{' '}
                                  {movement.createdBy?.name ||
                                    movement.createdBy?.email ||
                                    'Sistema'}
                                </p>
                              </div>

                              <p className="text-xs font-medium text-slate-500">
                                {fDateTime(movement.createdAt)}
                              </p>
                            </div>

                            <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                              {movement.fromPerson?.fullName && (
                                <span>
                                  Desde:{' '}
                                  <b className="text-slate-800">
                                    {movement.fromPerson.fullName}
                                  </b>
                                </span>
                              )}

                              {movement.toPerson?.fullName && (
                                <span>
                                  Hacia:{' '}
                                  <b className="text-slate-800">
                                    {movement.toPerson.fullName}
                                  </b>
                                </span>
                              )}

                              {movement.fromLocation?.name && (
                                <span>
                                  Origen:{' '}
                                  <b className="text-slate-800">
                                    {movement.fromLocation.name}
                                  </b>
                                </span>
                              )}

                              {movement.toLocation?.name && (
                                <span>
                                  Destino:{' '}
                                  <b className="text-slate-800">
                                    {movement.toLocation.name}
                                  </b>
                                </span>
                              )}

                              {handover?.person?.fullName && (
                                <span>
                                  Paciente / custodio:{' '}
                                  <b className="text-slate-800">
                                    {handover.person.fullName}
                                  </b>
                                </span>
                              )}

                              {handover?.relation && (
                                <span>
                                  Relación:{' '}
                                  <b className="text-slate-800">
                                    {handover.relation}
                                  </b>
                                </span>
                              )}
                            </div>
                          </button>

                          {(comodatoUrl || comodatoDownloadUrl) && (
                            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                              {comodatoUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePreviewApiFile(
                                      comodatoUrl,
                                      `Comodato_${handoverId || movement.id}.pdf`,
                                    )
                                  }
                                  className="inline-flex h-9 items-center justify-center rounded-xl bg-[#1B3859] px-3 text-xs font-semibold text-white transition hover:bg-[#132B45]"
                                >
                                  Ver comodato
                                </button>
                              )}

                              {comodatoDownloadUrl && (
                                <a
                                  href={toAbsoluteApiUrl(comodatoDownloadUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#1B3859] transition hover:bg-slate-50"
                                >
                                  Descargar comodato
                                </a>
                              )}

                              {handover?.attachmentUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePreviewApiFile(
                                      handover.attachmentUrl,
                                      handover.attachmentName ||
                                        'Soporte adicional',
                                    )
                                  }
                                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#1B3859] transition hover:bg-slate-50"
                                >
                                  Ver soporte
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <aside className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 lg:border-l lg:border-t-0">
              <div className="sticky top-36 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-[#1B3859]">
                    Resumen
                  </p>

                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    <p>
                      Estado:{' '}
                      <b className="text-slate-800">
                        {translateStatus(status)}
                      </b>
                    </p>

                    <p>
                      Vida útil:{' '}
                      <b className="text-slate-800">
                        {translateLifeState(lifeState)}
                      </b>
                    </p>

                    <p>
                      Movimientos:{' '}
                      <b className="text-slate-800">{movements.length}</b>
                    </p>

                    <p>
                      Anexos:{' '}
                      <b className="text-slate-800">{attachments.length}</b>
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
                      <Paperclip className="h-5 w-5" />
                    </div>

                    <p className="text-sm font-semibold text-[#1B3859]">
                      Anexos
                    </p>
                  </div>

                  {canManageAttachments && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <select
                        value={attType}
                        onChange={(event) =>
                          setAttType(event.target.value as AttachmentType)
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                      >
                        <option value="FACTURA_COMPRA">
                          Factura de compra
                        </option>
                        <option value="SOPORTE_BAJA">Soporte de baja</option>
                      </select>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(event) =>
                          setFile(event.target.files?.[0] ?? null)
                        }
                        className="mt-2 block w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                      />

                      <button
                        type="button"
                        onClick={() => uploadAttachment.mutate()}
                        disabled={uploadAttachment.isPending || !file}
                        className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white transition hover:bg-[#132B45] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {uploadAttachment.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Subiendo…
                          </>
                        ) : (
                          <>
                            <UploadCloud className="h-4 w-4" />
                            Subir anexo
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <div className="mt-4 space-y-2">
                    {listAttachmentsQ.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando anexos…
                      </div>
                    ) : attachments.length === 0 ? (
                      <EmptyState>Sin anexos cargados.</EmptyState>
                    ) : (
                      attachments.map((attachment) => {
                        const downloadUrl = getSecureUrl(attachment.path);

                        return (
                          <div
                            key={attachment.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <p
                              className="truncate text-sm font-semibold text-[#111827]"
                              title={attachment.fileName}
                            >
                              {attachment.fileName}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {attachment.type} · {formatBytes(attachment.size)}{' '}
                              · {fDate(attachment.createdAt)}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handlePreview(attachment)}
                                className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#1B3859] transition hover:bg-slate-50"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Ver
                              </button>

                              <a
                                href={downloadUrl}
                                download={attachment.fileName}
                                className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#1B3859] transition hover:bg-slate-50"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Descargar
                              </a>

                              {canManageAttachments && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const ok = confirm(
                                      '¿Eliminar este documento anexo?',
                                    );

                                    if (ok) {
                                      removeAttachment.mutate(attachment.id);
                                    }
                                  }}
                                  disabled={removeAttachment.isPending}
                                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </SectionCard>

        {selectedMovement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-3 py-6 backdrop-blur-sm">
            <div className="max-h-[90dvh] w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#1B3859]">
                    Detalle del movimiento
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {translateMovement(selectedMovement.type)} ·{' '}
                    {fDateTime(selectedMovement.createdAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMovement(null)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[calc(90dvh-88px)] space-y-3 overflow-y-auto px-5 py-5">
                <InfoItem
                  label="Tipo"
                  value={translateMovement(selectedMovement.type)}
                />
                <InfoItem
                  label="Referencia"
                  value={selectedMovement.reference}
                />
                <InfoItem
                  label="Registrado por"
                  value={
                    selectedMovement.createdBy?.name ||
                    selectedMovement.createdBy?.email ||
                    'Sistema'
                  }
                />
                <InfoItem
                  label="Notas"
                  value={
                    selectedMovement.notes ? (
                      <span className="whitespace-pre-wrap">
                        {selectedMovement.notes}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />

                {(() => {
                  const handover = selectedMovement?.handover;
                  const comodatoUrl = getMovementComodatoUrl(selectedMovement);
                  const comodatoDownloadUrl =
                    getMovementComodatoDownloadUrl(selectedMovement);
                  const handoverId = getMovementHandoverId(selectedMovement);

                  if (!handover && !comodatoUrl) return null;

                  return (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-[#1B3859]">
                        Comodato y relación del trámite
                      </p>

                      <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                        <InfoItem
                          label="Paciente / custodio"
                          value={
                            handover?.person?.fullName ? (
                              <span>
                                {handover.person.fullName}
                                {handover.person.documentId && (
                                  <span className="block text-xs text-slate-500">
                                    Documento: {handover.person.documentId}
                                  </span>
                                )}
                              </span>
                            ) : (
                              '—'
                            )
                          }
                        />

                        <InfoItem
                          label="Firmante"
                          value={
                            handover?.signerName ? (
                              <span>
                                {handover.signerName}
                                {handover.signerId && (
                                  <span className="block text-xs text-slate-500">
                                    ID: {handover.signerId}
                                  </span>
                                )}
                              </span>
                            ) : (
                              '—'
                            )
                          }
                        />

                        <InfoItem
                          label="Relación"
                          value={handover?.relation || '—'}
                        />

                        <InfoItem
                          label="Motivo"
                          value={handover?.reason || '—'}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {comodatoUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              handlePreviewApiFile(
                                comodatoUrl,
                                `Comodato_${
                                  handoverId || selectedMovement.id
                                }.pdf`,
                              )
                            }
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white transition hover:bg-[#132B45]"
                          >
                            <Eye className="h-4 w-4" />
                            Ver comodato
                          </button>
                        )}

                        {comodatoDownloadUrl && (
                          <a
                            href={toAbsoluteApiUrl(comodatoDownloadUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#1B3859] transition hover:bg-slate-50"
                          >
                            <Download className="h-4 w-4" />
                            Descargar comodato
                          </a>
                        )}

                        {handover?.attachmentUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              handlePreviewApiFile(
                                handover.attachmentUrl,
                                handover.attachmentName || 'Soporte adicional',
                              )
                            }
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#1B3859] transition hover:bg-slate-50"
                          >
                            <Paperclip className="h-4 w-4" />
                            Ver soporte adicional
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {previewFile && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-3 py-6 backdrop-blur-sm">
            <div className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <p className="truncate text-sm font-semibold text-[#1B3859]">
                  {previewFile.name}
                </p>

                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                  aria-label="Cerrar vista previa"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3">
                {previewFile.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="mx-auto max-h-[78dvh] rounded-2xl object-contain"
                  />
                ) : (
                  <iframe
                    src={previewFile.url}
                    title={previewFile.name}
                    className="h-[78dvh] w-full rounded-2xl border border-slate-200 bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </Guard>
  );
}
