'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Loader2,
  MapPin,
  PackageCheck,
  PenLine,
  PlayCircle,
  RotateCcw,
  Save,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react';

import Guard from '@/components/auth-guard';
import { PageShell } from '@/components/common/page-shell';
import { SectionCard } from '@/components/common/section-card';
import { api } from '@/lib/api';
import { useRoute } from '@/lib/hooks';
import { capsFor, normalizeRole, type AppRole } from '@/lib/roles';

type SignatureInfo = {
  name: string;
  id: string;
  relation: string;
  email: string;
  signatureData: string | null;
  photoData: string | null;
  driverAssets: string[];
  finalAssets: string[];
};

const RELATIONS = [
  'PACIENTE',
  'FAMILIAR',
  'CUIDADOR',
  'HIJO/A',
  'PADRE/MADRE',
  'OTRO',
];

function parseSignatureNotes(notes: string): SignatureInfo | null {
  if (!notes) return null;

  const parts = notes.split(' || ');
  const sigPart = [...parts]
    .reverse()
    .find((part) => part.includes('[STEP:1/2]'));
  const auditPart = [...parts]
    .reverse()
    .find((part) => part.includes('[STEP:2/2]'));

  if (!sigPart) return null;

  const extract = (str: string, key: string) => {
    const search = `${key}:`;
    const start = str.indexOf(search);

    if (start === -1) return '';

    const end = str.indexOf('|', start);

    return (end === -1
      ? str.slice(start + search.length)
      : str.slice(start + search.length, end)
    ).trim();
  };

  const driverAssetsStr = extract(sigPart, 'Activos');

  const driverAssets = driverAssetsStr
    ? driverAssetsStr
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const auditAssetsStr = auditPart ? extract(auditPart, 'AuditFinal') : null;

  const finalAssets =
    auditAssetsStr !== null
      ? auditAssetsStr
        ? auditAssetsStr
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : []
      : driverAssets;

  return {
    name: extract(sigPart, 'Firma') || '—',
    id: extract(sigPart, 'ID') || '—',
    relation: extract(sigPart, 'Parentesco') || '—',
    email: extract(sigPart, 'Email') || '—',
    signatureData: extract(sigPart, 'FirmaImagenDataURL') || null,
    photoData: extract(sigPart, 'Evidencia') || null,
    driverAssets,
    finalAssets,
  };
}

function getApiBase() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    'http://localhost:4000';

  return raw.replace(/\/+$/, '');
}

function getStoredRole(): AppRole | null {
  if (typeof window === 'undefined') return null;

  return normalizeRole(localStorage.getItem('user_role'));
}

function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null;

  return (
    localStorage.getItem('user_id') ||
    localStorage.getItem('userId') ||
    localStorage.getItem('id')
  );
}

function getStoredUserName(): string | null {
  if (typeof window === 'undefined') return null;

  return (
    localStorage.getItem('user_name') ||
    localStorage.getItem('userName') ||
    localStorage.getItem('name')
  );
}

function getActorLabel({
  isConductor,
  canFinalAudit,
  canEditRoutes,
}: {
  isConductor: boolean;
  canFinalAudit: boolean;
  canEditRoutes: boolean;
}) {
  if (isConductor) return 'Vista conductor';
  if (canFinalAudit) return 'Vista auditor / creador';
  if (canEditRoutes) return 'Vista administrativa';
  return 'Vista consulta';
}

function getDisplayStatus(status?: string | null) {
  const raw = String(status || '').trim().toUpperCase();

  if (!raw) return 'SCHEDULED';

  if (raw.includes('PENDING_REVIEW') || raw.includes('1/2')) {
    return 'PENDING_REVIEW';
  }

  if (
    raw.includes('COMPLETED') ||
    raw.includes('2/2') ||
    raw.includes('COMPLETADA')
  ) {
    return 'COMPLETED';
  }

  if (raw.includes('IN_PROGRESS') || raw.includes('CURSO')) {
    return 'IN_PROGRESS';
  }

  if (raw.includes('CANCELLED') || raw.includes('CANCELADA')) {
    return 'CANCELLED';
  }

  if (raw.includes('SCHEDULED') || raw.includes('PROGRAMADA')) {
    return 'SCHEDULED';
  }

  return raw;
}

function getStatusLabel(status: string) {
  if (status === 'PENDING_REVIEW') return 'Completada 1/2';
  if (status === 'COMPLETED') return 'Completada 2/2';
  if (status === 'IN_PROGRESS') return 'En curso';
  if (status === 'SCHEDULED') return 'Programada';
  if (status === 'CANCELLED') return 'Cancelada';

  return status.replace(/_/g, ' ');
}

function getStatusClass(status: string) {
  if (status === 'PENDING_REVIEW') {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }

  if (status === 'COMPLETED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (status === 'IN_PROGRESS') {
    return 'border-blue-200 bg-blue-50 text-blue-800';
  }

  if (status === 'CANCELLED') {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }

  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function formatRouteType(type?: string | null) {
  const raw = String(type || '').toUpperCase();

  if (raw.includes('DELIVERY') || raw.includes('ENTREGA')) return 'Entrega';
  if (raw.includes('PICKUP') || raw.includes('RECOGIDA')) return 'Recogida';
  if (raw.includes('MIXED') || raw.includes('MIXTA')) return 'Mixta';

  return type || 'Ruta';
}

function formatItemAction(action?: string | null) {
  const raw = String(action || '').toUpperCase();

  if (raw === 'DELIVER') return 'Entregar';
  if (raw === 'PICKUP') return 'Recoger';

  return action || 'Gestionar';
}

function itemActionClass(action?: string | null) {
  const raw = String(action || '').toUpperCase();

  if (raw === 'DELIVER') {
    return 'border-[#3C9CD1]/30 bg-[#3C9CD1]/10 text-[#1B3859]';
  }

  if (raw === 'PICKUP') {
    return 'border-[#54BF5B]/30 bg-[#54BF5B]/10 text-[#16803A]';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function fDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function AssetRow({
  item,
  checked,
  disabled,
  onChange,
}: {
  item: any;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const asset = item?.asset;
  const action = item?.action;

  return (
    <label
      className={[
        'flex items-start justify-between gap-3 rounded-2xl border p-4 transition',
        disabled
          ? checked
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-slate-200 bg-slate-50 opacity-60'
          : checked
            ? 'border-[#3C9CD1]/50 bg-[#3C9CD1]/10 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-start gap-3">
        {!disabled && (
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 rounded border-slate-300 text-[#1B3859] focus:ring-[#3C9CD1]"
            checked={checked}
            onChange={(event) => onChange?.(event.target.checked)}
          />
        )}

        <div className="min-w-0">
          <p
            className={[
              'truncate text-sm font-bold',
              checked ? 'text-[#111827]' : 'text-slate-500',
            ].join(' ')}
            title={asset?.tag || ''}
          >
            {asset?.tag || 'S/N'}
          </p>

          <p
            className={[
              'mt-0.5 truncate text-xs font-medium uppercase',
              checked ? 'text-slate-600' : 'text-slate-400',
            ].join(' ')}
            title={asset?.name || ''}
          >
            {asset?.name || 'Equipo no identificado'}
          </p>
        </div>
      </div>

      <span
        className={[
          'inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-[11px] font-bold',
          itemActionClass(action),
        ].join(' ')}
      >
        {formatItemAction(action)}
      </span>
    </label>
  );
}

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useRoute(id);

  const [role, setRole] = useState<AppRole | null>(null);
  const [roleReady, setRoleReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const [initialized, setInitialized] = useState(false);
  const [collectedAssetIds, setCollectedAssetIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [whoSigns, setWhoSigns] = useState('');
  const [signerId, setSignerId] = useState('');
  const [relation, setRelation] = useState('');
  const [email, setEmail] = useState('');

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const API_BASE = getApiBase();

  const getBackToRoutesUrl = () => {
  if (typeof window === 'undefined') return '/routes';

  const from = new URLSearchParams(window.location.search).get('from') ?? '';

  if (from && from.startsWith('/routes')) {
    return from;
  }

  return '/routes';
};

const backToRoutes = () => {
  router.push(getBackToRoutesUrl());
};

  useEffect(() => {
    const storedRole = getStoredRole();

    setRole(storedRole);
    setUserId(getStoredUserId());
    setUserName(getStoredUserName());
    setRoleReady(true);
  }, []);

  const caps = useMemo(() => capsFor(role), [role]);

  const canViewRoutes = caps.viewRoutes;
  const canEditRoutes = caps.editRoutes;
  const isConductor = role === 'CONDUCTOR';

  useEffect(() => {
    if (!roleReady) return;

    if (!canViewRoutes) {
      router.replace('/assets');
    }
  }, [roleReady, canViewRoutes, router]);

  const route = data as any;

  const displayStatus = getDisplayStatus(route?.rawStatus || route?.status);
  const isScheduled = displayStatus === 'SCHEDULED';
  const isInProgress = displayStatus === 'IN_PROGRESS';
  const isPendingReview = displayStatus === 'PENDING_REVIEW';
  const isCompletedFinal = displayStatus === 'COMPLETED';

  const isRouteCreator =
    !!userId && !!route?.createdById && route.createdById === userId;

  const isSuperAdmin = role === 'SUPER_ADMIN';

  const canFinalAudit =
    canEditRoutes && !isConductor && (isSuperAdmin || isRouteCreator);

  const canStartRoute = isConductor && isScheduled;

  const canDriverManage = isConductor && isInProgress;

  const actorLabel = getActorLabel({
    isConductor,
    canFinalAudit,
    canEditRoutes,
  });

  const sigData = useMemo(
    () => parseSignatureNotes(route?.notes || ''),
    [route?.notes],
  );

  const allItems = useMemo(() => {
    const items = route?.stop?.items;

    return Array.isArray(items) ? items : [];
  }, [route?.stop?.items]);

  const assetCount = allItems.length;

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

  useEffect(() => {
    if (!route?.stop?.items || !roleReady || initialized) return;

    if (isConductor && isInProgress) {
      setCollectedAssetIds(
        route.stop.items
          .map((item: any) => item.asset?.id)
          .filter(Boolean),
      );

      setInitialized(true);
      return;
    }

    if (isPendingReview && sigData) {
      setCollectedAssetIds(sigData.driverAssets);
      setInitialized(true);
    }
  }, [
    route?.stop?.items,
    roleReady,
    initialized,
    isConductor,
    isInProgress,
    isPendingReview,
    sigData,
  ]);

  const getCoordinates = (event: any) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (event: any) => {
    if (event.cancelable) event.preventDefault();

    isDrawing.current = true;

    const { x, y } = getCoordinates(event);
    const ctx = canvasRef.current?.getContext('2d');

    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0f172a';
    }
  };

  const draw = (event: any) => {
    if (event.cancelable) event.preventDefault();

    if (!isDrawing.current) return;

    const { x, y } = getCoordinates(event);
    const ctx = canvasRef.current?.getContext('2d');

    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedMimeTypes.includes(file.type)) {
      alert('Solo se permiten imágenes JPG, PNG o WEBP.');
      event.target.value = '';
      return;
    }

    setPhotoFile(file);

    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      setPhotoPreview(readerEvent.target?.result as string);
    };

    reader.readAsDataURL(file);
  };

  const handleStartRoute = async () => {
    if (!isConductor) {
      return alert('Solo el conductor asignado puede iniciar la ruta.');
    }

    if (!isScheduled) {
      return alert('Solo se puede iniciar una ruta programada.');
    }

    setSaving(true);

    try {
      const startNotes = [
        route?.notes || '',
        `[STEP:START] | InicioRuta: ${new Date().toISOString()} | Usuario: ${
          userName || 'CONDUCTOR'
        }`,
      ]
        .filter(Boolean)
        .join(' || ');

      await api.patch(`/api/routes/${id}`, {
        status: 'IN_PROGRESS',
        notes: startNotes,
      });

      window.location.reload();
    } catch (error: any) {
      alert(error?.response?.data?.error ?? 'No se pudo iniciar la ruta.');
      setSaving(false);
    }
  };

  const handleComplete1_2 = async (event: FormEvent) => {
    event.preventDefault();

    if (!isConductor) {
      return alert('Solo el conductor asignado puede finalizar la gestión 1/2.');
    }

    if (!isInProgress) {
      return alert('Primero debes iniciar la ruta.');
    }

    if (!whoSigns.trim() || !signerId.trim() || !relation || !email.trim()) {
      return alert(
        'Debe completar todos los datos de quien recibe, incluyendo el correo.',
      );
    }

    if (!hasSignature || !canvasRef.current) {
      return alert('Debe proporcionar la firma digital para continuar.');
    }

    setSaving(true);

    try {
      const signatureBase64 = canvasRef.current.toDataURL('image/png');

      const detailNotes = [
        '[STEP:1/2]',
        `Firma: ${whoSigns.trim()}`,
        `ID: ${signerId.trim()}`,
        `Parentesco: ${relation}`,
        `Email: ${email.trim()}`,
        `Activos: ${collectedAssetIds.join(',')}`,
        `FirmaImagenDataURL: ${signatureBase64}`,
      ].join(' | ');

      const finalNotes = [route?.notes || '', detailNotes]
        .filter(Boolean)
        .join(' || ');

      const formData = new FormData();

      formData.append('status', 'PENDING_REVIEW');
      formData.append('notes', finalNotes);
      formData.append('collectedAssetIds', JSON.stringify(collectedAssetIds));

      if (photoFile) {
        formData.append('photo', photoFile);
      }

      await api.patch(`/api/routes/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      router.replace(getBackToRoutesUrl());
    } catch (error: any) {
      alert(error?.response?.data?.error ?? 'Error al guardar gestión.');
      setSaving(false);
    }
  };

  const handleFinalClose = async () => {
    if (!canFinalAudit) {
      return alert(
        'Solo el creador de la ruta o un SUPER_ADMIN puede auditar y cerrar 2/2.',
      );
    }

    setSaving(true);

    try {
      const auditNotes = `[STEP:2/2] | AuditFinal: ${collectedAssetIds.join(
        ',',
      )}`;

      await api.patch(`/api/routes/${id}`, {
        status: 'COMPLETED',
        notes: [route?.notes || '', auditNotes].filter(Boolean).join(' || '),
        collectedAssetIds,
      });

      router.replace(getBackToRoutesUrl());
    } catch (error: any) {
      alert(error?.response?.data?.error ?? 'Error al cerrar ruta.');
      setSaving(false);
    }
  };

  const toggleCollectedAsset = (assetId: string, checked: boolean) => {
    setCollectedAssetIds((prev) => {
      if (checked) {
        if (prev.includes(assetId)) return prev;
        return [...prev, assetId];
      }

      return prev.filter((idItem) => idItem !== assetId);
    });
  };

  if (isLoading || !data || !roleReady) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando ruta…
            </div>
          </SectionCard>
        </PageShell>
      </Guard>
    );
  }

  if (!canViewRoutes) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <p className="text-sm text-slate-600">
              No tienes permisos para ver rutas.
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
          title={route?.code || `RUTA-${route?.routeNumber || id}`}
          contentClassName="p-0"
          actions={
            <button
              type="button"
              onClick={backToRoutes}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-[#1B3859] transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
          }
        >
          <div className="space-y-6 p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <InfoItem
                label="Estado"
                value={
                  <span
                    className={[
                      'inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold',
                      getStatusClass(displayStatus),
                    ].join(' ')}
                  >
                    {getStatusLabel(displayStatus)}
                  </span>
                }
              />

              <InfoItem
                label="Tipo"
                value={formatRouteType(route?.rawType || route?.type)}
              />

              <InfoItem
                label="Fecha programada"
                value={fDateTime(route?.scheduledDate || route?.date)}
              />

              <InfoItem
                label="Activos"
                value={`${assetCount} activo${assetCount === 1 ? '' : 's'}`}
              />

              <InfoItem label="Creada por" value={route?.createdByName || '—'} />

              <InfoItem
                label="Vista"
                value={
                  <span className="inline-flex h-7 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700">
                    {actorLabel}
                  </span>
                }
              />
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
                  <User className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-[#1B3859]">
                    Paciente / contacto
                  </h2>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <InfoItem label="Titular" value={route?.contact || '—'} />
                <InfoItem label="Documento" value={route?.contactDoc || '—'} />
                <InfoItem label="Teléfono" value={route?.contactPhone || '—'} />
                <InfoItem
                  label="Conductor asignado"
                  value={
                    <span>
                      {route?.driverName ||
                        (isConductor ? 'Asignada a ti' : 'Sin asignar')}

                      {route?.driverEmail && (
                        <span className="mt-0.5 block text-xs font-medium text-slate-500">
                          {route.driverEmail}
                        </span>
                      )}
                    </span>
                  }
                />
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <MapPin className="h-4 w-4" />
                  Dirección
                </p>
                <p className="mt-2 text-base font-bold text-[#111827]">
                  {route?.address || '—'}
                </p>
              </div>
            </section>

            {!isConductor && !isPendingReview && !isCompletedFinal && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-4 flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#54BF5B]/10 text-[#16803A]">
                    <PackageCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-sm font-semibold text-[#1B3859]">
                      Equipos programados
                    </h2>
                  </div>
                </div>

                <div className="grid gap-2">
                  {allItems.map((item: any) => (
                    <AssetRow key={item.id} item={item} checked disabled />
                  ))}
                </div>
              </section>
            )}

            {canStartRoute && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-amber-800">
                      <PlayCircle className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-sm font-semibold text-amber-900">
                        Ruta programada
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-amber-800">
                        Debes iniciar la ruta antes de registrar entrega,
                        recogida, firma o evidencia.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartRoute}
                    disabled={saving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#132B45] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Iniciando…
                      </>
                    ) : (
                      <>
                        <Truck className="h-4 w-4" />
                        Iniciar ruta
                      </>
                    )}
                  </button>
                </div>
              </section>
            )}

            {isPendingReview && sigData && (
              <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:p-5">
                <div className="mb-4 flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-sky-800">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-sm font-semibold text-sky-900">
                      Reporte de gestión en calle
                    </h2>
                    <p className="mt-1 text-xs text-sky-700">
                      Validación inicial realizada por el conductor.
                    </p>
                  </div>
                </div>

                <div className="grid gap-2">
                  {allItems.map((item: any) => {
                    const assetId = item.asset?.id;
                    const wasReported = sigData.driverAssets.includes(assetId);

                    return (
                      <AssetRow
                        key={item.id}
                        item={item}
                        checked={wasReported}
                        disabled
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {canDriverManage && (
              <form
                onSubmit={handleComplete1_2}
                className="grid gap-6 lg:grid-cols-[1fr_380px]"
              >
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
                      <ClipboardList className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-sm font-semibold text-[#1B3859]">
                        Validación de equipos
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Desmarca los activos que no fueron entregados o
                        recogidos.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {allItems.map((item: any) => {
                      const assetId = item.asset?.id;
                      const isChecked = collectedAssetIds.includes(assetId);

                      return (
                        <AssetRow
                          key={item.id}
                          item={item}
                          checked={isChecked}
                          onChange={(checked) =>
                            toggleCollectedAsset(assetId, checked)
                          }
                        />
                      );
                    })}
                  </div>
                </section>

                <aside className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#54BF5B]/10 text-[#16803A]">
                      <FileSignature className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-sm font-semibold text-[#1B3859]">
                        Recepción y firma
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Datos de quien recibe o entrega físicamente.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <input
                      required
                      inputMode="text"
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold uppercase text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                      placeholder="Nombre completo quien firma"
                      value={whoSigns}
                      onChange={(event) =>
                        setWhoSigns(
                          event.target.value.replace(
                            /[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g,
                            '',
                          ),
                        )
                      }
                    />

                    <input
                      required
                      inputMode="numeric"
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                      placeholder="Cédula / Documento"
                      value={signerId}
                      onChange={(event) =>
                        setSignerId(event.target.value.replace(/\D/g, ''))
                      }
                    />

                    <select
                      required
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                      value={relation}
                      onChange={(event) => setRelation(event.target.value)}
                    >
                      <option value="">Vínculo / Parentesco…</option>

                      {RELATIONS.map((relationItem) => (
                        <option key={relationItem} value={relationItem}>
                          {relationItem}
                        </option>
                      ))}
                    </select>

                    <input
                      required
                      type="email"
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                      placeholder="Correo electrónico"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          <Camera className="h-4 w-4" />
                          Evidencia
                        </label>

                        {photoPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoPreview(null);
                              setPhotoFile(null);
                            }}
                            className="text-xs font-semibold text-rose-600 underline"
                          >
                            Borrar
                          </button>
                        )}
                      </div>

                      {!photoPreview ? (
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          onChange={handlePhotoChange}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#3C9CD1]/10 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#1B3859]"
                        />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photoPreview}
                            alt="Evidencia"
                            className="h-32 w-full rounded-lg object-cover"
                          />
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          <PenLine className="h-4 w-4" />
                          Firma digital
                        </label>

                        {hasSignature && (
                          <button
                            type="button"
                            onClick={clearSignature}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 underline"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Borrar
                          </button>
                        )}
                      </div>

                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-inner">
                        <canvas
                          ref={canvasRef}
                          width={800}
                          height={300}
                          className="h-52 w-full cursor-crosshair touch-none rounded-lg bg-white"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          onTouchCancel={stopDrawing}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#132B45] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Guardando…
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Finalizar gestión 1/2
                        </>
                      )}
                    </button>
                  </div>
                </aside>
              </form>
            )}

            {isPendingReview && (
              <div className="grid gap-6 lg:grid-cols-[1fr_390px]">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-800">
                      <FileSignature className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-sm font-semibold text-[#1B3859]">
                        Receptor físico
                      </h2>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoItem label="Nombre" value={sigData?.name || '—'} />
                    <InfoItem label="Documento" value={sigData?.id || '—'} />
                    <InfoItem label="Relación" value={sigData?.relation || '—'} />
                    <InfoItem label="Correo" value={sigData?.email || '—'} />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {sigData?.signatureData && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Firma capturada
                        </p>

                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={sigData.signatureData}
                          alt="Firma del receptor"
                          className="h-28 rounded-xl border border-slate-200 bg-white object-contain p-2"
                        />
                      </div>
                    )}

                    {sigData?.photoData && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Evidencia fotográfica
                        </p>

                        <a
                          href={getSecureUrl(sigData.photoData)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getSecureUrl(sigData.photoData)}
                            alt="Evidencia"
                            className="h-32 w-full rounded-xl border border-slate-200 bg-white object-cover"
                          />
                        </a>
                      </div>
                    )}
                  </div>
                </section>

                {canFinalAudit && (
                  <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:p-5">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-sky-800">
                        <ShieldCheck className="h-5 w-5" />
                      </div>

                      <div>
                        <h2 className="text-sm font-semibold text-sky-900">
                          Validación de bodega
                        </h2>
                        <p className="mt-1 text-xs text-sky-700">
                          Confirma los activos que llegaron físicamente para
                          cerrar la ruta.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      {allItems.map((item: any) => {
                        const assetId = item.asset?.id;
                        const isChecked = collectedAssetIds.includes(assetId);

                        return (
                          <AssetRow
                            key={item.id}
                            item={item}
                            checked={isChecked}
                            onChange={(checked) =>
                              toggleCollectedAsset(assetId, checked)
                            }
                          />
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={handleFinalClose}
                      disabled={saving}
                      className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#132B45] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Cerrando…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Auditar y cerrar ruta
                        </>
                      )}
                    </button>
                  </section>
                )}

                {!canFinalAudit && !isConductor && canEditRoutes && (
                  <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-amber-800">
                        <ShieldCheck className="h-5 w-5" />
                      </div>

                      <div>
                        <h2 className="text-sm font-semibold text-amber-900">
                          Pendiente de cierre por creador
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-amber-800">
                          La ruta está en Completada 1/2. Solo el creador de la
                          ruta o un SUPER_ADMIN puede cerrar la validación 2/2.
                        </p>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}

            {isCompletedFinal && sigData && (
              <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 bg-emerald-600 p-5 text-white">
                  <div>
                    <h2 className="text-lg font-bold">Servicio finalizado</h2>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-50">
                      Ruta cerrada y auditada
                    </p>
                  </div>

                  <div className="grid h-11 w-11 place-items-center rounded-full bg-white/20">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                </div>

                <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Paciente titular
                      </p>
                      <p className="mt-1 text-sm font-bold uppercase text-slate-800">
                        {route?.contact || '—'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">
                        Quien recibió
                      </p>

                      <p className="mt-1 text-lg font-bold uppercase text-slate-800">
                        {sigData.name}
                      </p>

                      <p className="mt-1 text-xs font-semibold uppercase text-slate-500">
                        {sigData.relation} • CC: {sigData.id}
                      </p>

                      {sigData.email && sigData.email !== '—' && (
                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                          {sigData.email}
                        </p>
                      )}

                      {sigData.signatureData && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Firma
                          </p>

                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={sigData.signatureData}
                            alt="Firma final"
                            className="h-24 rounded-xl border border-slate-200 bg-white object-contain p-2"
                          />
                        </div>
                      )}
                    </div>

                    {sigData.photoData && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Evidencia fotográfica
                        </p>

                        <a
                          href={getSecureUrl(sigData.photoData)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getSecureUrl(sigData.photoData)}
                            alt="Evidencia"
                            className="h-32 w-full rounded-xl border border-slate-200 object-cover"
                          />
                        </a>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Inventario consolidado
                    </p>

                    <div className="grid gap-2">
                      {allItems.map((item: any) => {
                        const assetId = item.asset?.id;
                        const wasFinalized =
                          sigData.finalAssets.includes(assetId);

                        return (
                          <AssetRow
                            key={item.id}
                            item={item}
                            checked={wasFinalized}
                            disabled
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </SectionCard>
      </PageShell>
    </Guard>
  );
}