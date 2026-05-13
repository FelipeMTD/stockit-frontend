'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import Guard from '@/components/auth-guard';
import { useRoute } from '@/lib/hooks';
import { api } from '@/lib/api';
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
  const sigPart = [...parts].reverse().find((part) => part.includes('[STEP:1/2]'));
  const auditPart = [...parts].reverse().find((part) => part.includes('[STEP:2/2]'));

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

function getDisplayStatus(status?: string | null) {
  const raw = String(status || '').trim().toUpperCase();

  if (!raw) return 'PROGRAMADA';

  if (raw.includes('PENDING_REVIEW') || raw.includes('1/2')) {
    return 'PENDING_REVIEW';
  }

  if (raw.includes('COMPLETED') || raw.includes('2/2') || raw.includes('COMPLETADA')) {
    return 'COMPLETED';
  }

  return raw;
}

function getStatusLabel(status: string) {
  if (status === 'PENDING_REVIEW') return 'COMPLETADA 1/2';
  if (status === 'COMPLETED') return 'COMPLETADA 2/2';

  return status.replace(/_/g, ' ');
}

function getStatusClass(status: string) {
  if (status === 'PENDING_REVIEW') {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }

  if (status === 'COMPLETED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useRoute(id);

  const [role, setRole] = useState<AppRole | null>(null);
  const [roleReady, setRoleReady] = useState(false);

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

  useEffect(() => {
    const storedRole = getStoredRole();

    setRole(storedRole);
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

  const displayStatus = getDisplayStatus(route?.status);
  const isPendingReview = displayStatus === 'PENDING_REVIEW';
  const isCompletedFinal = displayStatus === 'COMPLETED';

  const sigData = useMemo(
    () => parseSignatureNotes(route?.notes || ''),
    [route?.notes],
  );

  const allItems = useMemo(() => {
    const items = route?.stop?.items;

    return Array.isArray(items) ? items : [];
  }, [route?.stop?.items]);

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

    if (isConductor && !isPendingReview && !isCompletedFinal) {
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
    isPendingReview,
    isCompletedFinal,
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

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleComplete1_2 = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isConductor) {
      return alert('Solo el conductor asignado puede finalizar la gestión 1/2.');
    }

    if (!whoSigns.trim() || !signerId.trim() || !relation || !email.trim()) {
      return alert('Debe completar todos los datos de quien recibe, incluyendo el correo.');
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

      router.replace('/routes');
    } catch (error: any) {
      alert(error?.response?.data?.error ?? 'Error al guardar gestión.');
      setSaving(false);
    }
  };

  const handleFinalClose = async () => {
    if (!canEditRoutes || isConductor) {
      return alert('No tienes permisos para auditar y cerrar esta ruta.');
    }

    setSaving(true);

    try {
      const auditNotes = `[STEP:2/2] | AuditFinal: ${collectedAssetIds.join(',')}`;

      await api.patch(`/api/routes/${id}`, {
        status: 'COMPLETED',
        notes: [route?.notes || '', auditNotes].filter(Boolean).join(' || '),
        collectedAssetIds,
      });

      router.replace('/routes');
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
        <div className="p-10 text-center font-poppins font-bold animate-pulse text-slate-400 uppercase tracking-widest">
          Validando plataforma...
        </div>
      </Guard>
    );
  }

  if (!canViewRoutes) {
    return (
      <Guard>
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          No tienes permisos para ver rutas.
        </div>
      </Guard>
    );
  }

  return (
    <Guard>
      <div className="mx-auto max-w-5xl space-y-6 font-poppins text-slate-900 pb-20 pt-4 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 uppercase">
              {route?.code || `RUTA-${route?.routeNumber || id}`}
            </h1>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">
              Gestión logística
            </p>
          </div>

          <div
            className={`w-fit rounded-full border px-5 py-2 text-[10px] font-black uppercase shadow-sm ${getStatusClass(
              displayStatus,
            )}`}
          >
            {getStatusLabel(displayStatus)}
          </div>
        </div>

        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-3 mb-5">
            Información del paciente oficial
          </h2>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Titular
              </p>
              <p className="text-sm font-bold text-slate-800 uppercase">
                {route?.contact || '—'}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Documento
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {route?.contactDoc || '—'}
              </p>
            </div>

            <div className="sm:col-span-2 border-t border-slate-100 pt-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                Dirección exacta
              </p>
              <p className="text-lg font-bold text-sky-950 uppercase leading-tight">
                {route?.address || '—'}
              </p>
            </div>
          </div>
        </section>

        {!isConductor && !isPendingReview && !isCompletedFinal && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-3 mb-4">
              Equipos programados para esta ruta
            </h2>

            <div className="grid gap-3">
              {allItems.map((item: any) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0"
                >
                  <span className="text-sm font-bold text-slate-700">
                    {item.asset?.tag || 'S/N'}
                    <span className="text-xs font-medium text-slate-500 uppercase ml-1">
                      • {item.asset?.name || 'EQUIPO NO IDENTIFICADO'}
                    </span>
                  </span>

                  <span
                    className={`text-[9px] font-black uppercase px-2 py-1 rounded border shadow-sm ${
                      item.action === 'DELIVER'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {item.action === 'DELIVER' ? 'A ENTREGAR' : 'A RECOGER'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {isPendingReview && sigData && (
          <section className="bg-sky-50 border border-sky-100 rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-sky-900 uppercase tracking-widest border-b border-sky-200 pb-2">
              Reporte de gestión en calle
            </h2>

            <div className="grid gap-3">
              {allItems.map((item: any) => {
                const assetId = item.asset?.id;
                const wasReported = sigData.driverAssets.includes(assetId);

                return (
                  <div
                    key={item.id}
                    className="flex justify-between items-center py-2 border-b border-sky-200/50 last:border-0"
                  >
                    <span
                      className={`text-sm ${
                        wasReported
                          ? 'font-bold text-slate-700'
                          : 'text-slate-400 line-through'
                      }`}
                    >
                      {item.asset?.tag} - {item.asset?.name}
                    </span>

                    <span
                      className={`text-[9px] font-black px-2 py-1 rounded ${
                        wasReported
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {wasReported ? 'CONFIRMADO' : 'OMITIDO'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {isConductor && !isPendingReview && !isCompletedFinal && (
          <form onSubmit={handleComplete1_2} className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">
                1. Validación de equipos
              </h2>

              <div className="space-y-3">
                {allItems.map((item: any) => {
                  const assetId = item.asset?.id;
                  const isChecked = collectedAssetIds.includes(assetId);

                  return (
                    <label
                      key={item.id}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        isChecked
                          ? 'border-sky-600 bg-sky-50 shadow-sm'
                          : 'border-slate-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                          checked={isChecked}
                          onChange={(event) =>
                            toggleCollectedAsset(assetId, event.target.checked)
                          }
                        />

                        <div className="flex flex-col">
                          <span
                            className={`font-bold text-sm ${
                              !isChecked ? 'text-slate-400 line-through' : ''
                            }`}
                          >
                            {item.asset?.tag}
                          </span>

                          <span className="text-[10px] uppercase text-slate-500">
                            {item.asset?.name}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded ${
                          item.action === 'DELIVER'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.action === 'DELIVER' ? 'Entrega' : 'Recogida'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase border-b pb-3 tracking-widest">
                2. Registro de recepción obligatorio
              </h2>

              <div className="grid gap-5 sm:grid-cols-2">
                <input
                  required
                  inputMode="text"
                  className="w-full border-b-2 p-3 text-sm outline-none focus:border-sky-600 bg-slate-50 uppercase font-bold"
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
                  className="w-full border-b-2 p-3 text-sm outline-none focus:border-sky-600 bg-slate-50"
                  placeholder="Cédula / Documento"
                  value={signerId}
                  onChange={(event) =>
                    setSignerId(event.target.value.replace(/\D/g, ''))
                  }
                />

                <select
                  required
                  className="w-full border-b-2 p-3 text-sm bg-slate-50 focus:border-sky-600 outline-none"
                  value={relation}
                  onChange={(event) => setRelation(event.target.value)}
                >
                  <option value="">Vínculo / Parentesco...</option>

                  {RELATIONS.map((relationItem) => (
                    <option key={relationItem} value={relationItem}>
                      {relationItem}
                    </option>
                  ))}
                </select>

                <input
                  required
                  type="email"
                  className="w-full border-b-2 p-3 text-sm outline-none focus:border-sky-600 bg-slate-50"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />

                <div className="grid gap-1.5 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex justify-between">
                    Foto / evidencia adicional

                    {photoPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview(null);
                          setPhotoFile(null);
                        }}
                        className="text-rose-500 underline"
                      >
                        Borrar foto
                      </button>
                    )}
                  </label>

                  {!photoPreview ? (
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      onChange={handlePhotoChange}
                      className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm bg-slate-50 cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-sky-100 file:text-sky-700 file:px-3 file:py-1.5 file:text-xs file:font-bold"
                    />
                  ) : (
                    <div className="relative w-fit">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoPreview}
                        alt="Evidencia"
                        className="h-32 object-cover border-4 border-slate-200 rounded-xl shadow-sm"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <div className="flex justify-between mb-3">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                    Firma digital obligatoria
                  </label>

                  {hasSignature && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[10px] font-bold text-rose-600 uppercase underline"
                    >
                      Borrar firma
                    </button>
                  )}
                </div>

                <div className="relative overflow-hidden rounded-xl border-2 border-slate-300 bg-slate-100 p-2 shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={300}
                    className="w-full h-52 cursor-crosshair touch-none bg-white rounded shadow-sm"
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
                className="w-full bg-sky-600 text-white py-4 rounded-xl font-bold uppercase text-xs tracking-[0.2em] shadow-lg hover:bg-sky-700 transition-all active:scale-95 disabled:opacity-60"
              >
                {saving ? 'ENVIANDO...' : 'FINALIZAR GESTIÓN 1/2'}
              </button>
            </div>
          </form>
        )}

        {isPendingReview && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2">
                Receptor físico
              </h2>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <p className="text-lg font-black text-slate-800 uppercase">
                  {sigData?.name || '—'}
                </p>

                <p className="text-xs font-bold uppercase text-slate-500">
                  {sigData?.relation || '—'} • CC: {sigData?.id || '—'}
                </p>

                {sigData?.email && sigData.email !== '—' && (
                  <p className="text-[11px] font-bold text-sky-700 lowercase mt-1 bg-sky-100/50 w-fit px-2 py-0.5 rounded border border-sky-200">
                    {sigData.email}
                  </p>
                )}

                {sigData?.signatureData && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                      Firma capturada:
                    </p>

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sigData.signatureData}
                      alt="Firma del receptor"
                      className="h-24 bg-white border border-slate-200 rounded-lg p-2 shadow-sm"
                    />
                  </div>
                )}

                {sigData?.photoData && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                      Evidencia fotográfica:
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
                        className="h-32 object-cover border-4 border-white shadow-md rounded-xl hover:scale-105 transition-transform cursor-pointer"
                      />
                    </a>
                  </div>
                )}
              </div>
            </section>

            {!isConductor && canEditRoutes && (
              <section className="bg-sky-50 border-2 border-sky-100 rounded-xl p-6 shadow-sm sticky top-24 space-y-6">
                <h2 className="text-xs font-bold text-sky-800 uppercase border-b border-sky-200 pb-2 tracking-widest">
                  Validación de bodega
                </h2>

                <p className="text-[11px] font-bold text-sky-700/80 uppercase leading-relaxed">
                  Marca los activos que llegaron físicamente a bodega para
                  actualizar inventario y cerrar la ruta.
                </p>

                <div className="space-y-3">
                  {allItems.map((item: any) => {
                    const assetId = item.asset?.id;
                    const isChecked = collectedAssetIds.includes(assetId);

                    return (
                      <label
                        key={item.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all bg-white cursor-pointer ${
                          isChecked
                            ? 'border-sky-600 ring-2 ring-sky-50 shadow-md'
                            : 'border-slate-100 opacity-60 shadow-inner'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-slate-300 text-sky-700"
                          checked={isChecked}
                          onChange={(event) =>
                            toggleCollectedAsset(assetId, event.target.checked)
                          }
                        />

                        <div className="flex flex-col text-sm font-bold">
                          <span>{item.asset?.tag}</span>
                          <span className="text-[10px] text-slate-500 uppercase">
                            {item.asset?.name}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <button
                  onClick={handleFinalClose}
                  disabled={saving}
                  className="w-full bg-slate-900 text-white py-5 rounded-xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-black active:scale-95 transition-all disabled:opacity-60"
                >
                  {saving ? 'CERRANDO...' : 'AUDITAR Y CERRAR RUTA'}
                </button>
              </section>
            )}
          </div>
        )}

        {isCompletedFinal && sigData && (
          <section className="bg-white rounded-2xl border border-emerald-100 shadow-2xl overflow-hidden animate-in fade-in duration-500">
            <div className="bg-emerald-600 p-6 text-white flex items-center justify-between shadow-lg">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tighter">
                  Servicio finalizado
                </h2>

                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                  Ruta cerrada
                </p>
              </div>

              <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center text-xs font-black">
                OK
              </div>
            </div>

            <div className="p-8 grid md:grid-cols-2 gap-10 bg-slate-50/50">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                  Comprobante de recepción
                </h3>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      Paciente titular
                    </p>

                    <p className="text-sm font-bold text-slate-700 uppercase">
                      {route?.contact || '—'}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-1">
                      Quien recibió
                    </p>

                    <p className="text-xl font-black text-slate-800 uppercase">
                      {sigData.name}
                    </p>

                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                      {sigData.relation} • CC: {sigData.id}
                    </p>

                    {sigData.email && sigData.email !== '—' && (
                      <p className="text-xs font-bold text-emerald-600 lowercase mt-1 bg-emerald-50 w-fit px-2 py-0.5 rounded border border-emerald-200">
                        {sigData.email}
                      </p>
                    )}
                  </div>

                  {sigData.signatureData && (
                    <div className="mt-5 pt-4 border-t border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                        Firma de conformidad:
                      </p>

                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sigData.signatureData}
                        alt="Firma final"
                        className="h-20 object-contain"
                      />
                    </div>
                  )}

                  {sigData.photoData && (
                    <div className="mt-5 pt-4 border-t border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                        Evidencia fotográfica:
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
                          className="h-24 object-cover border-4 border-white shadow-sm rounded-xl cursor-pointer"
                        />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                  Inventario consolidado
                </h3>

                <div className="grid gap-2">
                  {allItems.map((item: any) => {
                    const assetId = item.asset?.id;
                    const wasFinalized = sigData.finalAssets.includes(assetId);

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                          wasFinalized
                            ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                            : 'bg-white border-slate-100 opacity-60'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span
                            className={`text-sm font-bold ${
                              !wasFinalized
                                ? 'text-slate-400 line-through'
                                : 'text-slate-800'
                            }`}
                          >
                            {item.asset?.tag}
                            <span className="text-xs font-medium text-slate-500 uppercase ml-1">
                              • {item.asset?.name}
                            </span>
                          </span>

                          <span className="text-[9px] font-black uppercase text-slate-500 mt-0.5">
                            {item.action === 'DELIVER'
                              ? 'Entregado'
                              : 'Recogido'}
                          </span>
                        </div>

                        <span
                          className={`flex items-center justify-center px-3 py-1 text-xs font-bold rounded-lg border shadow-sm ${
                            wasFinalized
                              ? 'bg-emerald-500 text-white border-emerald-600'
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                        >
                          {wasFinalized ? 'CONFIRMADO' : 'OMITIDO'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </Guard>
  );
}