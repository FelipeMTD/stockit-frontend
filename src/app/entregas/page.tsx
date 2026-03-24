'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';
import SignaturePad from '@/components/ui/signature-pad';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Guard from '@/components/auth-guard';

type Person = {
  id: string;
  fullName: string;
  email: string | null;
  documentId?: string | null;
  finalStatus?: string | null;
  inactivityDate?: string | null;
  userType?: string | null; // ya lo agregaste antes
};

type AssetStatus = 'IN_STOCK' | 'ASSIGNED' | string;

type Asset = {
  id: string;
  tag: string;
  name: string;
  status?: AssetStatus;
  currentCustodianId?: string | null;
  currentCustodian?: { id: string; fullName?: string | null } | null;
  category?: { id: string; name?: string | null } | null;
};

type AppUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  documentId?: string | null;
  role?: string | null;
};

type HandoverType = 'ENTREGA' | 'RECOGIDA';
type Relation =
  | 'HIJA' | 'HIJO' | 'MADRE' | 'PADRE' | 'SOBRINA' | 'SOBRINO' | 'HIJASTRO' | 'HIJASTRA'
  | 'HERMANO' | 'HERMANA' | 'TIA' | 'TIO' | 'COLABORADOR' | 'YERNO' | 'NIETO' | 'NIETA'
  | 'CUÑADO' | 'NUERA' | 'PRIMA' | 'PRIMO' | 'ABUELA' | 'PACIENTE' | 'ESPOSO' | 'ESPOSA'
  | 'TUTORA' | 'TUTOR' | 'CUIDADOR' | 'FAMILIAR';

type FormState = {
  type: HandoverType;
  personId: string;
  signerName: string;
  signerId: string;
  relation: Relation;
  email: string;
  phone: string;
  notes: string;
  signatureData: string | null;
  assetIds: string[];
  reason: string;
  homeDelivery: boolean;
  driverId?: string | null;
  scheduledDate: string; // fecha programada (YYYY-MM-DD)
};

const DELIVERY_REASONS = [
  'GARANTIZAR ENFERMERÍA Y CUIDADOR',
  'CAMBIO POR CORRECTIVO',
  'INGRESO COLABORADOR',
  'INVENTARIO INICIAL',
  'CAMBIO DE ACTIVO',
  'ORDENAMIENTO MEDICO',
  'HABILITACIÓN SEDE',
  'SOLICITA COORDINACIÓN',
] as const;

const PICKUP_REASONS = [
  'FALLECIDO',
  'EGRESO BARTHEL',
  'SALIDA DE COLABORADOR',
  'EGRESO ADMINISTRATIVO',
  'DESISTIMIENTO DE ACTIVO',
  'CAMBIO POR CORRECTIVO',
  'NO PERTINENCIA',
  'BAJA DEL ACTIVO',
] as const;

/* ─────────────────────────────────────────────────────────────
   Select simple reutilizable
────────────────────────────────────────────────────────────── */
function SimplePicker<T extends { id: string; fullName?: string | null; email?: string | null }>(props: {
  items: T[];
  value?: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  subtitleOf?: (it: T) => string | null | undefined;
}) {
  const { items, value, onChange, disabled, placeholder = '— Seleccionar —', subtitleOf } = props;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (open) setFilter('');
  }, [open]);

  const selected = useMemo(
    () => items.find((p) => p.id === value) || null,
    [items, value]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p: any) => {
      const name = (p.fullName || '').toLowerCase();
      const mail = (p.email || '').toLowerCase();
      const doc = (p.documentId || '').toLowerCase();
      return name.includes(q) || mail.includes(q) || doc.includes(q);
    });
  }, [items, filter]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        className="w-full rounded-xl border px-3 py-2 text-left text-sm bg-white dark:bg-slate-950 disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (selected.fullName || (selected as any).email || '—') : placeholder}
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full rounded-xl border bg-white dark:bg-slate-950 shadow-lg"
          role="dialog"
        >
          <div className="p-2 border-b">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-3 text-xs text-slate-500">Sin resultados.</div>
            )}
            <ul role="listbox">
              {filtered.map((p: any) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      p.id === value ? 'bg-slate-50 dark:bg-slate-800' : ''
                    }`}
                  >
                    <div className="font-medium truncate">{p.fullName || p.email || '—'}</div>
                    {subtitleOf && (
                      <div className="text-xs text-slate-500 truncate">
                        {subtitleOf(p) || '—'}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-2 border-t flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border px-3 py-1.5 text-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const UserPicker = (props: {
  people: Person;
  value?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
} | any) => (
  <SimplePicker
    items={props.people as any}
    value={props.value}
    onChange={props.onChange}
    disabled={props.disabled}
    placeholder={props.placeholder}
    subtitleOf={(p: any) => {
      const doc = p.documentId || '';
      const tipo = p.userType || '';
      const parts = [doc, tipo].filter(Boolean);
      return parts.length ? parts.join(' - ') : null;
    }}
  />
);

const DriverPicker = (props: {
  drivers: Array<{ id: string; name?: string | null; fullName?: string | null; email?: string | null; documentId?: string | null }>;
  value?: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) => {
  const items = (props.drivers || []).map((u) => {
    const baseName =
      (u.name && u.name.trim()) ||
      (u.fullName && u.fullName.trim()) ||
      (u.email && u.email.trim()) ||
      '';
    const label = [baseName || ''].filter(Boolean).join(' - ');
    return {
      ...u,
      fullName: label,
    };
  }) as any[];

  return (
    <SimplePicker
      items={items}
      value={props.value ?? undefined}
      onChange={props.onChange}
      disabled={props.disabled}
      placeholder={props.placeholder ?? '— Seleccionar conductor —'}
      subtitleOf={(u: any) => u.email || null}
    />
  );
};

type PageSizeOption = 10 | 50 | 100 | 'ALL';

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */
export default function HandoverPage() {
  const qc = useQueryClient();
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    type: 'ENTREGA',
    personId: '',
    signerName: '',
    signerId: '',
    relation: 'PACIENTE',
    email: '',
    phone: '',
    notes: '',
    signatureData: null,
    assetIds: [],
    reason: '',
    homeDelivery: false,
    driverId: null,
    scheduledDate: '',
  });

  const [assetQ, setAssetQ] = useState('');
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);
  const [page, setPage] = useState(1);
  const [showOnlySelected, setShowOnlySelected] = useState(false); // NUEVO

  // Personas (catálogo)
  const peopleQ = useQuery({
    queryKey: ['catalog-persons-for-picker'],
    queryFn: async () => {
      const { data } = await api.get<{ items: Person[] }>('/api/catalog/persons', {
        params: { pageSize: 5000 },
      });
      return data.items ?? [];
    },
  });

  // Conductores (usuarios con rol CONDUCTOR)
  const driversQ = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data } = await api.get<{ items: AppUser[] }>('/api/users/drivers');
      return data.items ?? [];
    },
  });

  // En ENTREGAS ocultar inactivos
  const visiblePeople = useMemo(() => {
    const arr = peopleQ.data ?? [];
    if (form.type !== 'ENTREGA') return arr;
    return arr.filter((p) => {
      const inactiveByDate = !!p.inactivityDate;
      const inactiveByText = (p.finalStatus || '').toLowerCase().includes('inactiv');
      return !inactiveByDate && !inactiveByText;
    });
  }, [peopleQ.data, form.type]);

  // Activos
  const allAssets = useQuery({
    queryKey: ['assets-mini'],
    queryFn: async () =>
      (await api.get<{ items: Asset[] }>('/api/assets', { params: { pageSize: 10000 } })).data.items ?? [],
  });

  const hasCustodian = (a: Asset) => Boolean(a.currentCustodianId) || Boolean(a.currentCustodian?.id);
  const custodianIdOf = (a: Asset) => a.currentCustodianId ?? a.currentCustodian?.id ?? null;
  const isInStock = (a: Asset) => {
    const s = (a.status || '').toUpperCase();
    return s === 'IN_STOCK' || !hasCustodian(a);
  };

  const reasonOptions = useMemo(
    () => (form.type === 'ENTREGA' ? [...DELIVERY_REASONS] : [...PICKUP_REASONS]),
    [form.type]
  );

  const baseVisibleAssets = useMemo(() => {
    const arr = allAssets.data ?? [];
    if (form.type === 'ENTREGA') return arr.filter(isInStock);
    if (!form.personId) return [];
    return arr.filter((a) => custodianIdOf(a) === form.personId);
  }, [allAssets.data, form.type, form.personId]);

  const visibleAssets = useMemo(() => {
    let source = baseVisibleAssets;

    // NUEVO: solo seleccionados
    if (showOnlySelected && form.assetIds.length > 0) {
      const idsSet = new Set(form.assetIds);
      source = source.filter((a) => idsSet.has(a.id));
    }

    const q = assetQ.trim().toLowerCase();
    if (!q) return source;

    return source.filter((a) => {
      const name = (a.name || '').toLowerCase();
      const tag = (a.tag || '').toLowerCase();
      const cat = (a.category?.name || '').toLowerCase();
      return name.includes(q) || tag.includes(q) || (!!cat && cat.includes(q));
    });
  }, [baseVisibleAssets, assetQ, showOnlySelected, form.assetIds]);

  // Reset selección y motivo si cambia tipo o persona
  useEffect(() => {
    setForm((f) => ({ ...f, assetIds: [], reason: '' }));
  }, [form.type, form.personId]);

  // Cuando cambias tipo/persona, quita el filtro "solo seleccionados"
  useEffect(() => {
    setShowOnlySelected(false);
  }, [form.type, form.personId]);

  // Limpiar firma/contacto si es domicilio
  useEffect(() => {
    if (form.homeDelivery) {
      setForm((f) => ({
        ...f,
        signerName: '',
        signerId: '',
        relation: 'PACIENTE',
        email: '',
        phone: '',
        notes: '',
        signatureData: null,
      }));
    }
  }, [form.homeDelivery]);

  // Reset página cuando cambian filtros o tipo
  useEffect(() => {
    setPage(1);
  }, [assetQ, form.type, form.personId, pageSize, showOnlySelected]);

  const totalItems = visibleAssets.length;
  const totalPages =
    pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));

  const paginatedAssets = useMemo(() => {
    if (pageSize === 'ALL') return visibleAssets;
    const start = (page - 1) * pageSize;
    return visibleAssets.slice(start, start + pageSize);
  }, [visibleAssets, page, pageSize]);

  const toggleAsset = (id: string) => {
    setForm((f) => ({
      ...f,
      assetIds: f.assetIds.includes(id) ? f.assetIds.filter((x) => x !== id) : [...f.assetIds, id],
    }));
  };

  function buildPayload(f: FormState) {
    const base: any = {
      type: f.type,
      signerName: f.homeDelivery ? null : f.signerName.trim() || null,
      signerId: f.homeDelivery ? null : f.signerId.trim() || null,
      relation: f.homeDelivery ? null : f.relation,
      email: f.homeDelivery ? null : f.email?.trim() || null,
      phone: f.homeDelivery ? null : f.phone?.trim() || null,
      notes: f.homeDelivery ? null : f.notes?.trim() || null,
      signatureData: f.homeDelivery ? null : f.signatureData || null,
      reason: (f.reason || '').trim() || null,
      homeDelivery: !!f.homeDelivery,
      driverId: f.homeDelivery ? f.driverId || null : null,
      scheduledDate:
        f.type === 'ENTREGA' && f.homeDelivery && f.scheduledDate
          ? f.scheduledDate
          : null,
      items: (f.assetIds || []).map((assetId) => ({ assetId, quantity: 1 })),
    };
    return f.type === 'ENTREGA' ? { ...base, personId: f.personId } : base;
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!form.assetIds.length) throw new Error('Selecciona al menos un equipo');

      const allowedValues = (form.type === 'ENTREGA' ? DELIVERY_REASONS : PICKUP_REASONS) as readonly string[];
      if (!form.reason || !allowedValues.includes(form.reason)) {
        throw new Error(
          `Selecciona un motivo válido para ${form.type === 'ENTREGA' ? 'ENTREGA' : 'RECOGIDA'}`
        );
      }

      if (form.type === 'ENTREGA' && !form.personId) {
        throw new Error('Selecciona el usuario (custodio) para la entrega');
      }
      if (form.type === 'RECOGIDA' && form.personId && baseVisibleAssets.length === 0) {
        throw new Error('Ese usuario no tiene equipos asignados.');
      }

      if (form.homeDelivery && !form.driverId) {
        throw new Error('Selecciona el conductor para la ruta a domicilio');
      }

      if (form.type === 'ENTREGA' && form.homeDelivery && !form.scheduledDate) {
        throw new Error('Selecciona la fecha programada de la ruta a domicilio');
      }

      if (!form.homeDelivery) {
        if (!form.signerName.trim()) throw new Error('Falta el nombre de quien firma');
        if (!form.signerId.trim()) throw new Error('Falta la identificación de quien firma');
        if (!form.relation) throw new Error('Selecciona el parentesco/relación');
        if (!form.signatureData) throw new Error('La firma en pantalla es obligatoria');
      }

      const payload = buildPayload(form);
      const { data } = await api.post('/api/handover', payload);
      return data;
    },
    onSuccess: (resp) => {
      toast.success(form.type === 'ENTREGA' ? 'Entrega registrada' : 'Recogida registrada');

      if (form.homeDelivery) {
        const routeCode = resp?.routeCode ?? resp?.route?.code ?? null;
        const label = routeCode ? `Ruta creada: ${routeCode}` : 'También se creó una ruta programada.';
        toast.info(label, {
          action: { label: 'Ver rutas', onClick: () => router.push('/routes') },
          duration: 6000,
        });
      }

      setForm({
        type: 'ENTREGA',
        personId: '',
        signerName: '',
        signerId: '',
        relation: 'PACIENTE',
        email: '',
        phone: '',
        notes: '',
        signatureData: null,
        assetIds: [],
        reason: '',
        homeDelivery: false,
        driverId: null,
        scheduledDate: '',
      });
      setShowOnlySelected(false);

      qc.invalidateQueries({ queryKey: ['assets-mini'] });
      qc.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (e: any) => {
      const server = e?.response?.data;
      toast.error(server?.error || server?.details?.message || 'No se pudo registrar.');
      console.log('POST /api/handover error:', server || e);
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync();
  };

  return (
    <Guard>
      <section className="space-y-4">
        <h1 className="text-lg font-semibold">Entregas y recogidas</h1>

        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          {/* Columna izquierda */}
          <div className="border rounded-xl bg-white dark:bg-slate-900 p-4 space-y-3">
            <h2 className="font-medium">Datos del movimiento</h2>

            {/* Tipo */}
            <div className="grid gap-1.5">
              <label className="text-sm">Tipo</label>
              <select
                className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as HandoverType })}
              >
                <option value="ENTREGA">Entrega</option>
                <option value="RECOGIDA">Recogida</option>
              </select>
            </div>

            {/* Usuario (custodio) */}
            <div className="grid gap-1.5">
              <label className="text-sm">Usuario (custodio)</label>
              <UserPicker
                people={visiblePeople}
                value={form.personId}
                onChange={(id: string) => setForm({ ...form, personId: id })}
                disabled={peopleQ.isLoading}
                placeholder={peopleQ.isLoading ? 'Cargando…' : '— Seleccionar —'}
              />
              {form.type === 'ENTREGA' && (
                <p className="text-xs text-slate-500">
                  * En entregas, los usuarios inactivos no se muestran.
                </p>
              )}
            </div>

            {/* Motivo */}
            <div className="grid gap-1.5">
              <label className="text-sm">Motivo</label>
              <select
                className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              >
                <option value="">— Seleccionar —</option>
                {reasonOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">El motivo cambia según el tipo seleccionado.</p>
            </div>

            {/* A domicilio */}
            <div className="flex items-center gap-2">
              <input
                id="homeDelivery"
                type="checkbox"
                className="h-4 w-4"
                checked={form.homeDelivery}
                onChange={(e) => setForm({ ...form, homeDelivery: e.target.checked })}
              />
              <label htmlFor="homeDelivery" className="text-sm select-none">
                Crear ruta a domicilio
              </label>
            </div>

            {/* Conductor (solo si domicilio) */}
            {form.homeDelivery && (
              <div className="grid gap-1.5">
                <label className="text-sm">Conductor</label>
                <DriverPicker
                  drivers={driversQ.data ?? []}
                  value={form.driverId ?? null}
                  onChange={(id: string) => setForm({ ...form, driverId: id })}
                  disabled={driversQ.isLoading}
                  placeholder={driversQ.isLoading ? 'Cargando…' : '— Seleccionar conductor —'}
                />
                <p className="text-xs text-slate-500">
                  Selecciona un usuario administrativo con rol de conductor.
                </p>
              </div>
            )}

            {/* Fecha programada (solo Entrega a domicilio) */}
            {form.type === 'ENTREGA' && form.homeDelivery && (
              <div className="grid gap-1.5">
                <label className="text-sm">Fecha programada</label>
                <input
                  type="date"
                  className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                  value={form.scheduledDate}
                  onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                />
                <p className="text-xs text-slate-500">
                  Día en el que se realizará la ruta domiciliaria.
                </p>
              </div>
            )}

            {/* Bloque de firma/contacto (oculto si domicilio) */}
            {!form.homeDelivery && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-sm">Quién firma</label>
                    <input
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.signerName}
                      onChange={(e) => setForm({ ...form, signerName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm">Identificación</label>
                    <input
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.signerId}
                      onChange={(e) => setForm({ ...form, signerId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm">Parentesco</label>
                  <select
                    className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                    value={form.relation}
                    onChange={(e) =>
                      setForm({ ...form, relation: e.target.value as Relation })
                    }
                  >
                    <option value="HIJA">HIJA</option>
                    <option value="HIJO">HIJO</option>
                    <option value="MADRE">MADRE</option>
                    <option value="PADRE">PADRE</option>
                    <option value="SOBRINA">SOBRINA</option>
                    <option value="SOBRINO">SOBRINO</option>
                    <option value="HIJASTRO">HIJASTRO</option>
                    <option value="HIJASTRA">HIJASTRA</option>
                    <option value="HERMANO">HERMANO</option>
                    <option value="HERMANA">HERMANA</option>
                    <option value="TIA">TIA</option>
                    <option value="TIO">TIO</option>
                    <option value="COLABORADOR">COLABORADOR</option>
                    <option value="YERNO">YERNO</option>
                    <option value="NIETO">NIETO</option>
                    <option value="NIETA">NIETA</option>
                    <option value="CUÑADO">CUÑADO</option>
                    <option value="NUERA">NUERA</option>
                    <option value="PRIMA">PRIMA</option>
                    <option value="PRIMO">PRIMO</option>
                    <option value="ABUELA">ABUELA</option>
                    <option value="PACIENTE">PACIENTE</option>
                    <option value="ESPOSO">ESPOSO</option>
                    <option value="ESPOSA">ESPOSA</option>
                    <option value="TUTORA">TUTORA</option>
                    <option value="TUTOR">TUTOR</option>
                    <option value="CUIDADOR">CUIDADOR</option>
                    <option value="FAMILIAR">FAMILIAR</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-sm">Correo</label>
                    <input
                      type="email"
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm">Teléfono</label>
                    <input
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm">Observación</label>
                  <textarea
                    className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm">Firma</label>
                  <SignaturePad
                    value={form.signatureData}
                    onChange={(v) => setForm({ ...form, signatureData: v })}
                  />
                </div>
              </>
            )}

            {form.homeDelivery && (
              <p className="text-xs text-slate-500">
                Esta entrega/recogida será gestionada por ruta a domicilio. Los datos de firma y
                contacto se capturarán durante la visita.
              </p>
            )}
          </div>

          {/* Columna derecha: equipos */}
          <div className="border rounded-xl bg-white dark:bg-slate-900 p-4 space-y-3">
            <h2 className="font-medium">
              Equipos a {form.type === 'ENTREGA' ? 'entregar' : 'recoger'}
            </h2>

            <div className="text-xs text-slate-500">
              {form.type === 'ENTREGA'
                ? 'Se muestran equipos disponibles (en stock o sin custodio).'
                : form.personId
                ? 'Se muestran equipos asignados a ese usuario.'
                : 'Selecciona un usuario para ver sus equipos asignados.'}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 flex-1">
                <input
                  value={assetQ}
                  onChange={(e) => setAssetQ(e.target.value)}
                  placeholder="Buscar equipo por nombre, tag o categoría…"
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                />
                {assetQ && (
                  <button
                    type="button"
                    onClick={() => setAssetQ('')}
                    className="text-xs px-2 py-1 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={showOnlySelected}
                    onChange={(e) => setShowOnlySelected(e.target.checked)}
                    disabled={form.assetIds.length === 0}
                  />
                  <span>Solo seleccionados</span>
                </label>
                <span>Mostrar:</span>
                <select
                  className="rounded-lg border px-2 py-1 text-xs bg-white dark:bg-slate-950"
                  value={pageSize === 'ALL' ? 'ALL' : String(pageSize)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPageSize(
                      v === 'ALL'
                        ? 'ALL'
                        : (parseInt(v, 10) as PageSizeOption)
                    );
                  }}
                >
                  <option value="10">10</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="ALL">Todos</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <div>
                {totalItems === 0
                  ? 'Sin equipos para mostrar.'
                  : pageSize === 'ALL'
                  ? `Mostrando ${totalItems} equipos`
                  : `Mostrando ${
                      totalItems === 0
                        ? 0
                        : Math.min(totalItems, page * (pageSize as number))
                    } de ${totalItems} equipos`}
              </div>
              {totalItems > 0 && pageSize !== 'ALL' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-2 py-1 rounded-lg border disabled:opacity-40"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Anterior
                  </button>
                  <span>
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    className="px-2 py-1 rounded-lg border disabled:opacity-40"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page >= totalPages}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>

            <div className="max-h-[55vh] overflow-y-auto border rounded-xl">
              <ul className="divide-y">
                {paginatedAssets.map((a) => {
                  const checked = form.assetIds.includes(a.id);
                  const computedStatus =
                    (a.status || '').toUpperCase() ||
                    (hasCustodian(a) ? 'ASSIGNED' : 'IN_STOCK');
                  return (
                    <li key={a.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">
                          {a.tag} — {a.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {computedStatus}
                          {a.category?.name ? ` • ${a.category.name}` : ''}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAsset(a.id)}
                        className="h-4 w-4"
                      />
                    </li>
                  );
                })}
                {paginatedAssets.length === 0 && (
                  <li className="p-6 text-sm text-slate-500 text-center">Sin equipos.</li>
                )}
              </ul>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                onClick={submit}
                className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
                disabled={create.isPending}
              >
                {create.isPending ? 'Guardando…' : 'Registrar'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </Guard>
  );
}
