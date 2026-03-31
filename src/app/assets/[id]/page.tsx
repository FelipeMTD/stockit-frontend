'use client';

<<<<<<< HEAD
import { useState } from 'react';
=======
import { useEffect, useState } from 'react';
>>>>>>> d5382373980952035700f47e7de633d588981602
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import StatusBadge from '@/components/ui/status-badge';
import MovementActions from '@/components/assets/movement-actions';
import { toast } from 'sonner';
import { tMovement, tLifeState } from '@/lib/i18n';
import Guard from '@/components/auth-guard';

<<<<<<< HEAD
/* === Tipos === */
type Attachment = {
  id: string;
  type: string;
=======
type Attachment = {
  id: string;
  type: 'SOPORTE_BAJA' | 'FACTURA_COMPRA' | string;
>>>>>>> d5382373980952035700f47e7de633d588981602
  fileName: string;
  path: string;
  size: number;
  mime: string;
  createdAt: string;
};

type Me = {
  id: string;
  email: string;
  mainRole?: string | null;
  role?: string | null;
  roleCode?: string | null;
  currentRole?: { code?: string | null } | null;
  roles?: Array<string | { code?: string | null }>;
};

type ApiAsset = {
  id: string;
  tag: string;
  name: string;
  status: string;
  lifeState?: string | null;
  category?: { id: string; name?: string | null } | null;
  site?: { id: string; name?: string | null } | null;
  assignedWarehouse?: { id: string; name?: string | null } | null;
  currentLocationLabel?: string | null;
  currentLocation?: { id: string; name?: string | null } | null;
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  invimaCode?: string | null;
  purchaseCost?: number | null;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  acquisitionType?: string | null;
  maintenanceFrequency?: 'ANUAL' | 'SEMESTRAL' | 'TRIMESTRAL' | 'NO_APLICA' | null;
  createdAt?: string | null;
  currentCustodian?: {
    fullName?: string | null;
    department?: string | null;
    municipality?: string | null;
    address?: string | null;
    documentId?: string | null;
  } | null;
  attachments?: Attachment[];
};

type MovementRow = {
  id: string;
  type: string;
  createdAt: string;
  fromLocation?: { name: string } | null;
  toLocation?: { name: string } | null;
  toPerson?: { fullName: string } | null;
  reference?: string | null;
  notes?: string | null;
  createdBy?: { name?: string | null; email?: string | null } | null;
};

type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

function extractRole(me?: Me | null): string {
  if (!me) return '';
  if (typeof me.mainRole === 'string' && me.mainRole) return me.mainRole;
  if (typeof me.role === 'string' && me.role) return me.role;
  if (typeof me.roleCode === 'string' && me.roleCode) return me.roleCode;
  if (me.currentRole && typeof me.currentRole.code === 'string' && me.currentRole.code) {
    return me.currentRole.code;
  }
  if (Array.isArray(me.roles) && me.roles.length > 0) {
    const r0 = me.roles[0];
    if (typeof r0 === 'string') return r0;
    if (r0 && typeof (r0 as any).code === 'string') return (r0 as any).code;
  }
  return '';
}

function tAcquisitionType(acq?: string | null): string {
  if (!acq) return '—';
  const key = acq.toUpperCase();
  const map: Record<string, string> = {
    PURCHASE: 'COMPRA',
    LEASE: 'ARRENDAMIENTO',
    DONATION: 'DONACIÓN',
    INTERNAL: 'INTERNA',
    OTHER: 'OTRO',
  };
  return map[key] ?? acq;
}

function tMaintenanceFrequency(v?: ApiAsset['maintenanceFrequency']): string {
  if (!v) return '—';
  const key = String(v).toUpperCase();
  const map: Record<string, string> = {
    ANUAL: 'ANUAL',
    SEMESTRAL: 'SEMESTRAL',
    TRIMESTRAL: 'TRIMESTRAL',
    NO_APLICA: 'NO APLICA',
    'NO APLICA': 'NO APLICA',
  };
  return map[key] ?? v;
}

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '') || '';
<<<<<<< HEAD

  // === ESTADOS PARA MODALES ===
  const [confirmDel, setConfirmDel] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [selectedHandover, setSelectedHandover] = useState<any>(null);
=======
>>>>>>> d5382373980952035700f47e7de633d588981602

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<Me>('/api/auth/me')).data,
  });

  const rawRole = extractRole(meQ.data ?? null);
  const roleUpper = rawRole
    ? rawRole.toString().trim().toUpperCase().replace(/[\s-]+/g, '_')
    : '';
  const canManage = roleUpper === 'SUPER_ADMIN' || roleUpper === 'ACTIVOS_FIJOS';

  const assetQ = useQuery({
    queryKey: ['asset', id],
<<<<<<< HEAD
    queryFn: async () => (await api.get<ApiAsset>(`/api/assets/${id}`)).data,
=======
    queryFn: async () =>
      (await api.get<ApiAsset>(`/api/assets/${id}`)).data,
>>>>>>> d5382373980952035700f47e7de633d588981602
    enabled: !!id,
  });

  const histQ = useQuery({
    queryKey: ['movements', id],
    queryFn: async () =>
      (await api.get<Paginated<MovementRow>>(`/api/movements/by-asset/${id}`, {
        params: { pageSize: 50 },
      })).data,
    enabled: !!id,
  });

  const refetchAll = () => {
    assetQ.refetch();
    histQ.refetch();
  };

<<<<<<< HEAD
  // Función para abrir la vista previa de anexos o soportes
  const openPreview = (url: string, name: string) => {
    const finalUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    setPreviewUrl(finalUrl);
    setPreviewName(name);
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewName(null);
  };

  // Función para abrir detalle de un movimiento
  const openMovementDetail = async (m: MovementRow) => {
    if (m.reference && m.reference.startsWith('H:')) {
      const handoverId = m.reference.replace('H:', '');
      setSelectedHandover({ isLoading: true });
      try {
        const { data } = await api.get(`/api/handover/${handoverId}`);
        setSelectedHandover(data);
      } catch (err) {
        toast.error("No se pudo cargar el detalle de la entrega");
        setSelectedHandover(null);
      }
    } else {
      setSelectedHandover({ 
        isSimple: true, 
        type: m.type, 
        createdAt: m.createdAt, 
        notes: m.notes,
        reference: m.reference,
        createdBy: m.createdBy 
      });
    }
  };

=======
  const [confirmDel, setConfirmDel] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

>>>>>>> d5382373980952035700f47e7de633d588981602
  if (assetQ.isLoading) return <Guard><p className="p-4">Cargando…</p></Guard>;
  if (!assetQ.data) return <Guard><p className="p-4">No encontrado.</p></Guard>;

  const a = assetQ.data;

  const fDate = (d?: string | null) => d ? new Date(d).toLocaleDateString() : '—';
  const fDateTime = (d?: string | null) => d ? new Date(d).toLocaleString() : '—';
  const fMoney = (n?: number | string | null) => n != null ? Number(n).toLocaleString('es-CO') : '—';

  const lifeStatePill = (life?: string | null) => {
    const base = 'px-2 py-1 rounded-lg text-[10px] font-semibold tracking-wide';
    const map: Record<string, string> = {
      ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      INACTIVE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      RETIRED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    };
    const cls = map[life || 'ACTIVE'] || 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    return <span className={`${base} ${cls}`}>{tLifeState(life || undefined)}</span>;
  };

  const custAddr = (cust?: any) => {
    if (!cust) return '';
    const parts = [cust.department, cust.municipality, cust.address].filter(Boolean);
    return parts.join(', ');
  };

  const ubicacionActualTexto = (() => {
    if (a.currentCustodian) {
      const addr = custAddr(a.currentCustodian);
      return addr
        ? `Asignado a: ${a.currentCustodian.fullName} — Dirección: ${addr}`
        : `Asignado a: ${a.currentCustodian.fullName}`;
    }
    if (a.currentLocation) return `Ubicación: ${a.currentLocation.name}`;
    return 'Sin ubicación/custodio';
  })();

  async function handleDelete() {
    try {
      await api.delete(`/api/assets/${id}`);
      toast.success('Activo eliminado');
      router.push('/assets');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo eliminar');
    } finally {
      setConfirmDel(false);
    }
  }

  const attachments: Attachment[] = Array.isArray(a.attachments) ? a.attachments : [];
  const topAttachments = attachments.slice(0, 5);
  const typeLabel = (t: Attachment['type']) => t === 'SOPORTE_BAJA' ? 'Soporte de baja' : 'Factura de compra';
<<<<<<< HEAD
=======

  const openPreview = (att: Attachment) => {
    const url = att.path.startsWith('http') ? att.path : `${API_BASE_URL}${att.path}`;
    setPreviewUrl(url);
    setPreviewName(att.fileName || 'Anexo');
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewName(null);
  };
>>>>>>> d5382373980952035700f47e7de633d588981602

  return (
    <Guard>
      <section className="space-y-4">
        {/* Encabezado */}
        <div className="border rounded-xl bg-white dark:bg-slate-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">
                {a.tag} — {a.name}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {ubicacionActualTexto}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={a.status} />
              {lifeStatePill(a.lifeState)}
            </div>
          </div>

<<<<<<< HEAD
=======
          {/* Acciones (solo SUPER_ADMIN / ACTIVOS_FIJOS) */}
>>>>>>> d5382373980952035700f47e7de633d588981602
          {canManage && (
            <div className="mt-3 flex flex-wrap gap-2">
              <MovementActions assetId={id} currentLocationId={a.currentLocation?.id || null} onDone={refetchAll} />
              <Link
                href={`/assets/${id}/edit`}
                className="px-3 py-2 rounded-lg border text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
<<<<<<< HEAD
=======
                title="Editar activo"
>>>>>>> d5382373980952035700f47e7de633d588981602
              >
                Editar
              </Link>
              <Link
                href={`/assets/${id}/anexos`}
                className="px-3 py-2 rounded-lg border text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
<<<<<<< HEAD
=======
                title="Gestionar anexos"
>>>>>>> d5382373980952035700f47e7de633d588981602
              >
                Anexos
              </Link>
              <button
                onClick={() => setConfirmDel(true)}
                className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm hover:opacity-95"
<<<<<<< HEAD
=======
                title="Eliminar activo"
>>>>>>> d5382373980952035700f47e7de633d588981602
              >
                Eliminar
              </button>
            </div>
          )}
        </div>

<<<<<<< HEAD
        {/* Información Técnica */}
=======
        {/* Información del activo */}
>>>>>>> d5382373980952035700f47e7de633d588981602
        <div className="border rounded-xl bg-white dark:bg-slate-900 p-4">
          <h2 className="font-medium mb-3">Información del activo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-sm">
            <div><span className="text-slate-500">Código:</span> <b>{a.tag}</b></div>
            <div><span className="text-slate-500">Categoría:</span> <b>{a.category?.name ?? '—'}</b></div>
            <div><span className="text-slate-500">Sede:</span> <b>{a.site?.name ?? '—'}</b></div>
            <div><span className="text-slate-500">Bodega asignada:</span> <b>{a.assignedWarehouse?.name ?? '—'}</b></div>
            <div><span className="text-slate-500">Ubicación actual:</span> <b>{a.currentLocationLabel ?? a.currentLocation?.name ?? '—'}</b></div>
            <div><span className="text-slate-500">Frecuencia mantenimiento:</span> <b>{tMaintenanceFrequency(a.maintenanceFrequency ?? null)}</b></div>
            <div><span className="text-slate-500">Marca:</span> <b>{a.brand ?? '—'}</b></div>
            <div><span className="text-slate-500">Modelo:</span> <b>{a.model ?? '—'}</b></div>
            <div><span className="text-slate-500">Serie:</span> <b>{a.serial ?? '—'}</b></div>
            <div><span className="text-slate-500">Proveedor:</span> <b>{a.supplierName ?? '—'}</b></div>
            <div><span className="text-slate-500">Factura:</span> <b>{a.invoiceNumber ?? '—'}</b></div>
            <div><span className="text-slate-500">Invima:</span> <b>{a.invimaCode ?? '—'}</b></div>
            <div><span className="text-slate-500">Valor:</span> <b>{fMoney(a.purchaseCost)}</b></div>
            <div><span className="text-slate-500">Fecha de compra:</span> <b>{fDate(a.purchaseDate ?? null)}</b></div>
            <div><span className="text-slate-500">Garantía hasta:</span> <b>{fDate(a.warrantyUntil ?? null)}</b></div>
            <div><span className="text-slate-500">Tipo de adquisición:</span> <b>{tAcquisitionType(a.acquisitionType)}</b></div>
            <div><span className="text-slate-500">Fecha de ingreso:</span> <b>{fDate(a.createdAt ?? null)}</b></div>
          </div>
        </div>

<<<<<<< HEAD
        {/* Anexos Fijos */}
=======
        {/* Anexos */}
>>>>>>> d5382373980952035700f47e7de633d588981602
        <div className="border rounded-xl bg-white dark:bg-slate-900">
          <div className="px-4 py-3 font-medium border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2>Anexos</h2>
            <Link
              href={`/assets/${id}/anexos`}
              className="text-sm rounded-lg border px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Ver todos / Cargar
            </Link>
          </div>
          <div className="p-4">
            {topAttachments.length === 0 ? (
              <div className="text-sm text-slate-500">Sin anexos.</div>
            ) : (
              <ul className="space-y-3">
                {topAttachments.map((att) => (
                  <li key={att.id} className="rounded-lg border p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{typeLabel(att.type)}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[520px]" title={att.fileName}>
                        {att.fileName} — {new Date(att.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
<<<<<<< HEAD
                        onClick={() => openPreview(att.path, att.fileName)}
=======
                        onClick={() => openPreview(att)}
>>>>>>> d5382373980952035700f47e7de633d588981602
                        className="text-sm rounded-lg border px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Ver
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

<<<<<<< HEAD
        {/* RESTAURADO: Historial en su recuadro con Scroll original */}
        <div className="border rounded-xl bg-white dark:bg-slate-900">
          <h2 className="px-4 py-3 font-medium border-b border-slate-100 dark:border-slate-800">
            Historial de Movimientos
=======
        {/* Historial */}
        <div className="border rounded-xl bg-white dark:bg-slate-900">
          <h2 className="px-4 py-3 font-medium border-b border-slate-100 dark:border-slate-800">
            Historial
>>>>>>> d5382373980952035700f47e7de633d588981602
          </h2>
          <div className="p-4">
            <div className="rounded-lg border bg-white dark:bg-slate-900 max-h-[380px] overflow-auto">
              {histQ.data && histQ.data.items.length > 0 ? (
                <ul className="p-3 space-y-3">
                  {histQ.data.items.map((m: MovementRow) => (
<<<<<<< HEAD
                    <li 
                      key={m.id} 
                      onClick={() => openMovementDetail(m)}
                      className="rounded-lg border p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm group-hover:text-sky-600 transition-colors">
=======
                    <li key={m.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
>>>>>>> d5382373980952035700f47e7de633d588981602
                          {tMovement(m.type)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {fDateTime(m.createdAt)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {m.fromLocation && <>De: {m.fromLocation.name} </>}
                        {m.toLocation && <>→ A: {m.toLocation.name} </>}
                        {m.toPerson && <>→ A: {m.toPerson.fullName} </>}
                        {m.reference && <> — Ref: {m.reference}</>}
                        {m.notes && <> — {m.notes}</>}
                        {m.createdBy && (
                          <> — Registrado por: <b>{m.createdBy.name || m.createdBy.email}</b></>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-8 text-center text-sm text-slate-500">
                  Sin movimientos aún.
                </div>
              )}
            </div>
<<<<<<< HEAD
            <p className="text-xs text-slate-400 mt-2 italic text-center">Haz clic en cualquier movimiento para ver más detalles o evidencias.</p>
          </div>
        </div>

        {/* Modal de Detalle de Movimiento */}
        {selectedHandover && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setSelectedHandover(null)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800 rounded-t-2xl">
                <h3 className="font-bold">Detalle de la Acción</h3>
                <button onClick={() => setSelectedHandover(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">✕</button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                {selectedHandover.isLoading ? (
                  <p className="text-center py-10 text-slate-500">Cargando detalles...</p>
                ) : selectedHandover.isSimple ? (
                  <div className="space-y-2 text-sm">
                    <p><b>Tipo:</b> {tMovement(selectedHandover.type)}</p>
                    <p><b>Notas:</b> {selectedHandover.notes || 'Sin notas'}</p>
                    <p><b>Referencia:</b> {selectedHandover.reference || 'Ninguna'}</p>
                    <p><b>Registrado por:</b> {selectedHandover.createdBy?.name || selectedHandover.createdBy?.email || '—'}</p>
                  </div>
                ) : (
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-4 border-b dark:border-slate-800 pb-4">
                      <div><p className="text-slate-500 text-xs">Tipo</p><p className="font-medium">{selectedHandover.type}</p></div>
                      <div><p className="text-slate-500 text-xs">Fecha</p><p className="font-medium">{new Date(selectedHandover.createdAt).toLocaleString()}</p></div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-bold text-sky-600 uppercase text-xs tracking-widest">Información de Firma</h4>
                      <p><b>Nombre:</b> {selectedHandover.signerName}</p>
                      <p><b>Identificación:</b> {selectedHandover.signerId}</p>
                      <p><b>Parentesco:</b> {selectedHandover.relation}</p>
                      {selectedHandover.reason && <p><b>Motivo:</b> {selectedHandover.reason}</p>}
                      {selectedHandover.notes && <p><b>Notas:</b> {selectedHandover.notes}</p>}
                    </div>

                    {selectedHandover.signatureData && !selectedHandover.signatureData.startsWith('Firma pendiente') && !selectedHandover.signatureData.startsWith('No aplica') && selectedHandover.signatureData !== 'Sin firma' && (
                      <div className="space-y-1">
                        <p className="text-slate-500 text-xs">Firma Digital:</p>
                        <div className="border dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 p-2">
                          {selectedHandover.signatureData.startsWith('data:image') ? (
                             <img src={selectedHandover.signatureData} alt="Firma" className="max-h-32 mx-auto mix-blend-multiply dark:mix-blend-normal dark:invert" />
                          ) : (
                             <p className="text-center italic text-slate-500">{selectedHandover.signatureData}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* RESTAURADO: Soporte Adjunto usa Preview en lugar de Pestaña Nueva */}
                    {selectedHandover.attachmentPath ? (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">📄</span>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Soporte Adjunto</p>
                              <p className="text-xs text-emerald-600 dark:text-emerald-500 truncate max-w-[200px]" title={selectedHandover.attachmentName}>
                                {selectedHandover.attachmentName}
                              </p>
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={() => openPreview(selectedHandover.attachmentPath, selectedHandover.attachmentName || 'Soporte Manual')}
                            className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 shrink-0"
                          >
                            VER ARCHIVO
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No se adjuntó soporte manual para esta acción.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Vista previa de Archivos (Usa z-[60] para sobreponerse al modal de detalles si es necesario) */}
        {previewUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={closePreview}>
=======
          </div>
        </div>

        {/* Modal de vista previa */}
        {previewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closePreview}>
>>>>>>> d5382373980952035700f47e7de633d588981602
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold truncate">
                  {previewName || 'Vista previa de anexo'}
                </h3>
                <button type="button" onClick={closePreview} className="text-xs px-2 py-1 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800">
                  Cerrar
                </button>
              </div>
              <div className="flex-1">
                <iframe src={previewUrl} className="w-full h-full" title="Vista previa PDF" />
              </div>
            </div>
          </div>
        )}

        {/* Modal Eliminar */}
        {canManage && confirmDel && (
<<<<<<< HEAD
          <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-[70]">
=======
          <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50">
>>>>>>> d5382373980952035700f47e7de633d588981602
            <div className="w-full max-w-sm rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-3">
              <h4 className="font-medium">Eliminar activo</h4>
              <p className="text-sm text-slate-600">
                ¿Seguro que deseas eliminar <b>{a.tag} — {a.name}</b>? <br />
                (Se marcará como eliminado)
              </p>
              <div className="flex justify-end gap-2">
                <button className="text-sm px-3 py-2 rounded-lg border" onClick={() => setConfirmDel(false)}>
                  Cancelar
                </button>
                <button className="text-sm px-3 py-2 rounded-lg bg-rose-600 text-white hover:opacity-95" onClick={handleDelete}>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </Guard>
  );
}