'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import Guard from '@/components/auth-guard';
import SignaturePad from '@/components/ui/signature-pad';
import { api } from '@/lib/api';
import { normalizeRole, type AppRole } from '@/lib/roles';

type Person = {
  id: string;
  fullName: string;
  email: string | null;
  phone?: string | null;
  documentId?: string | null;
  finalStatus?: string | null;
  inactivityDate?: string | null;
  userType?: string | null;
  type?: string | null;
};

type Asset = {
  id: string;
  tag: string;
  name: string;
  status?: string | null;
  currentCustodianId?: string | null;
  currentCustodian?: {
    id: string;
    fullName?: string | null;
  } | null;
  category?: {
    id: string;
    name?: string | null;
  } | null;
};

type AppUser = {
  id: string;
  name?: string | null;
  fullName?: string | null;
  email?: string | null;
  documentId?: string | null;
  role?: string | null;
};

type HandoverItem = {
  id: string;
  quantity: number;
  asset?: Asset | null;
};

type Handover = {
  id: string;
  type: HandoverType;
  createdAt: string;
  signerName?: string | null;
  signerId?: string | null;
  relation?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  reason?: string | null;
  signatureData?: string | null;
  attachmentPath?: string | null;
  person?: Person | null;
  items?: HandoverItem[];
  createdBy?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

type HandoverType = 'ENTREGA' | 'RECOGIDA';

type Relation =
  | 'HIJA'
  | 'HIJO'
  | 'MADRE'
  | 'PADRE'
  | 'SOBRINA'
  | 'SOBRINO'
  | 'HIJASTRO'
  | 'HIJASTRA'
  | 'HERMANO'
  | 'HERMANA'
  | 'TIA'
  | 'TIO'
  | 'COLABORADOR'
  | 'YERNO'
  | 'NIETO'
  | 'NIETA'
  | 'CUÑADO'
  | 'NUERA'
  | 'PRIMA'
  | 'PRIMO'
  | 'ABUELA'
  | 'PACIENTE'
  | 'ESPOSO'
  | 'ESPOSA'
  | 'TUTORA'
  | 'TUTOR'
  | 'CUIDADOR'
  | 'FAMILIAR';

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
  driverId: string | null;
  scheduledDate: string;
};

type PageSizeOption = 10 | 50 | 100 | 'ALL';

const RELATIONS: Relation[] = [
  'HIJA',
  'HIJO',
  'MADRE',
  'PADRE',
  'SOBRINA',
  'SOBRINO',
  'HIJASTRO',
  'HIJASTRA',
  'HERMANO',
  'HERMANA',
  'TIA',
  'TIO',
  'COLABORADOR',
  'YERNO',
  'NIETO',
  'NIETA',
  'CUÑADO',
  'NUERA',
  'PRIMA',
  'PRIMO',
  'ABUELA',
  'PACIENTE',
  'ESPOSO',
  'ESPOSA',
  'TUTORA',
  'TUTOR',
  'CUIDADOR',
  'FAMILIAR',
];

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

function canUseHandoverRole(role: AppRole | null) {
  return role === 'SUPER_ADMIN' || role === 'ACTIVOS_FIJOS' || role === 'INVENTARIO';
}

function emptyForm(): FormState {
  return {
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
  };
}

function normalizeFinalStatus(value?: string | null) {
  const normalized = String(value || '').trim().toUpperCase();

  if (
    normalized === 'INACTIVO' ||
    normalized === 'INACTIVE' ||
    normalized === '0' ||
    normalized.includes('INACT')
  ) {
    return 'INACTIVO';
  }

  return 'ACTIVO';
}

function isActivePerson(person: Person) {
  if (person.inactivityDate) return false;
  return normalizeFinalStatus(person.finalStatus) === 'ACTIVO';
}

function assetSearchMatch(asset: Asset, q: string) {
  const term = q.trim().toLowerCase();

  if (!term) return true;

  return (
    String(asset.tag || '').toLowerCase().includes(term) ||
    String(asset.name || '').toLowerCase().includes(term) ||
    String(asset.category?.name || '').toLowerCase().includes(term)
  );
}

function getSecureUrl(rawPath: string) {
  if (!rawPath) return '';

  let clean = rawPath;

  if (clean.startsWith('http')) {
    try {
      clean = new URL(clean).pathname;
    } catch {
      // Conserva el valor original.
    }
  }

  const uploadIndex = clean.indexOf('/uploads/');

  if (uploadIndex !== -1) {
    clean = clean.substring(uploadIndex);
  }

  return encodeURI(`${getApiBase()}/${clean.replace(/^\/+/, '')}`);
}

function SimplePicker<T extends { id: string; fullName?: string | null; email?: string | null; documentId?: string | null }>(props: {
  items: T[];
  value?: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  subtitleOf?: (item: T) => string | null | undefined;
}) {
  const {
    items,
    value,
    onChange,
    disabled,
    placeholder = '— Seleccionar —',
    subtitleOf,
  } = props;

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (open) setFilter('');
  }, [open]);

  const selected = useMemo(
    () => items.find((item) => item.id === value) || null,
    [items, value],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();

    if (!q) return items;

    return items.filter((item) => {
      const name = String(item.fullName || '').toLowerCase();
      const email = String(item.email || '').toLowerCase();
      const doc = String(item.documentId || '').toLowerCase();

      return name.includes(q) || email.includes(q) || doc.includes(q);
    });
  }, [items, filter]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((state) => !state)}
        className="w-full rounded-xl border px-3 py-2 text-left text-sm bg-white dark:bg-slate-950 disabled:opacity-60 focus:border-sky-600 outline-none"
      >
        {selected ? selected.fullName || selected.email || '—' : placeholder}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border bg-white dark:bg-slate-950 shadow-xl">
          <div className="p-2 border-b">
            <input
              autoFocus
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 outline-none focus:border-sky-600"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-3 text-xs text-slate-500">Sin resultados.</div>
            )}

            <ul>
              {filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      item.id === value ? 'bg-sky-50 dark:bg-slate-800' : ''
                    }`}
                  >
                    <div className="font-medium truncate">
                      {item.fullName || item.email || '—'}
                    </div>

                    {subtitleOf && (
                      <div className="text-[10px] text-slate-500 truncate mt-0.5 font-bold uppercase">
                        {subtitleOf(item) || '—'}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-2 border-t flex justify-end bg-slate-50 rounded-b-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border bg-white px-4 py-1.5 text-xs font-bold shadow-sm hover:bg-slate-100"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserPicker(props: {
  people: Person[];
  value?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <SimplePicker
      items={props.people}
      value={props.value}
      onChange={props.onChange}
      disabled={props.disabled}
      placeholder={props.placeholder}
      subtitleOf={(person) =>
        [person.documentId || '', person.userType || person.type || '']
          .filter(Boolean)
          .join(' - ') || null
      }
    />
  );
}

function DriverPicker(props: {
  drivers: AppUser[];
  value?: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const items = (props.drivers || []).map((user) => {
    const baseName =
      user.name?.trim() ||
      user.fullName?.trim() ||
      user.email?.trim() ||
      '';

    return {
      ...user,
      fullName: baseName,
    };
  });

  return (
    <SimplePicker
      items={items}
      value={props.value ?? undefined}
      onChange={props.onChange}
      disabled={props.disabled}
      placeholder={props.placeholder ?? '— Seleccionar conductor —'}
      subtitleOf={(user) => user.email || null}
    />
  );
}

export default function HandoverPage() {
  const qc = useQueryClient();
  const router = useRouter();

  const [role, setRole] = useState<AppRole | null>(null);
  const [roleReady, setRoleReady] = useState(false);

  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [selectedHandover, setSelectedHandover] = useState<Handover | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [assetQ, setAssetQ] = useState('');
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);
  const [page, setPage] = useState(1);
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(Date.now());

  useEffect(() => {
    setRole(getStoredRole());
    setRoleReady(true);
  }, []);

  const canUseHandover = canUseHandoverRole(role);

  useEffect(() => {
    if (!roleReady) return;

    if (!canUseHandover) {
      router.replace('/assets');
    }
  }, [roleReady, canUseHandover, router]);

  const peopleQ = useQuery<Person[]>({
    queryKey: ['catalog-persons-for-picker'],
    enabled: roleReady && canUseHandover,
    queryFn: async (): Promise<Person[]> => {
      const res = await api.get<{ items: Person[] }>('/api/catalog/persons', {
        params: {
          pageSize: 5000,
        },
      });

      return res.data.items ?? [];
    },
  });

  const driversQ = useQuery<AppUser[]>({
    queryKey: ['drivers-for-handover'],
    enabled: roleReady && canUseHandover,
    queryFn: async (): Promise<AppUser[]> => {
      const res = await api.get<{ items: AppUser[] }>('/api/users/drivers');

      return res.data.items ?? [];
    },
  });

  const availableAssetsQ = useQuery<Asset[]>({
    queryKey: ['handover-available-assets', assetQ],
    enabled: roleReady && canUseHandover && form.type === 'ENTREGA',
    queryFn: async (): Promise<Asset[]> => {
      const res = await api.get<{ items: Asset[] }>('/api/handover/available-assets', {
        params: {
          pageSize: 5000,
          q: assetQ.trim() || undefined,
        },
      });

      return res.data.items ?? [];
    },
  });

  const assignedAssetsQ = useQuery<Asset[]>({
    queryKey: ['handover-assets-by-person', form.personId],
    enabled:
      roleReady &&
      canUseHandover &&
      form.type === 'RECOGIDA' &&
      Boolean(form.personId),
    queryFn: async (): Promise<Asset[]> => {
      const res = await api.get<{ items: Asset[] }>(
        `/api/handover/assets-by-person/${form.personId}`,
      );

      return res.data.items ?? [];
    },
  });

  const handoversQ = useQuery<Handover[]>({
    queryKey: ['handovers-history'],
    enabled: roleReady && canUseHandover,
    queryFn: async (): Promise<Handover[]> => {
      const res = await api.get<{ items: Handover[] }>('/api/handover', {
        params: {
          pageSize: 100,
        },
      });

      return res.data.items ?? [];
    },
  });

  const visiblePeople = useMemo(() => {
    const arr = peopleQ.data ?? [];

    if (form.type !== 'ENTREGA') return arr;

    return arr.filter(isActivePerson);
  }, [peopleQ.data, form.type]);

  const reasonOptions = useMemo(() => {
    return form.type === 'ENTREGA'
      ? [...DELIVERY_REASONS]
      : [...PICKUP_REASONS];
  }, [form.type]);

  const baseVisibleAssets = useMemo(() => {
    if (form.type === 'ENTREGA') {
      return availableAssetsQ.data ?? [];
    }

    if (!form.personId) {
      return [];
    }

    return assignedAssetsQ.data ?? [];
  }, [availableAssetsQ.data, assignedAssetsQ.data, form.type, form.personId]);

  const visibleAssets = useMemo(() => {
    let source = baseVisibleAssets;

    if (showOnlySelected && form.assetIds.length > 0) {
      const selected = new Set(form.assetIds);
      source = source.filter((asset) => selected.has(asset.id));
    }

    if (form.type === 'RECOGIDA') {
      source = source.filter((asset) => assetSearchMatch(asset, assetQ));
    }

    return source;
  }, [baseVisibleAssets, assetQ, showOnlySelected, form.assetIds, form.type]);

  const totalPages =
    pageSize === 'ALL'
      ? 1
      : Math.max(1, Math.ceil(visibleAssets.length / pageSize));

  const paginatedAssets = useMemo(() => {
    if (pageSize === 'ALL') return visibleAssets;

    const start = (page - 1) * pageSize;

    return visibleAssets.slice(start, start + pageSize);
  }, [visibleAssets, page, pageSize]);

  useEffect(() => {
    setForm((state) => ({
      ...state,
      assetIds: [],
      reason: '',
      personId: state.type === form.type ? state.personId : '',
    }));
  }, [form.type]);

  useEffect(() => {
    setShowOnlySelected(false);
    setPage(1);
  }, [form.type, form.personId]);

  useEffect(() => {
    setPage(1);
  }, [assetQ, pageSize, showOnlySelected]);

  useEffect(() => {
    if (!form.homeDelivery) return;

    setForm((state) => ({
      ...state,
      signerName: '',
      signerId: '',
      relation: 'PACIENTE',
      email: '',
      phone: '',
      notes: '',
      signatureData: null,
    }));
  }, [form.homeDelivery]);

  function toggleAsset(id: string) {
    setForm((state) => ({
      ...state,
      assetIds: state.assetIds.includes(id)
        ? state.assetIds.filter((item) => item !== id)
        : [...state.assetIds, id],
    }));
  }

  function buildPayload(state: FormState) {
    const base = {
      type: state.type,
      signerName: state.homeDelivery ? null : state.signerName.trim() || null,
      signerId: state.homeDelivery ? null : state.signerId.trim() || null,
      relation: state.homeDelivery ? null : state.relation,
      email: state.homeDelivery ? null : state.email.trim() || null,
      phone: state.homeDelivery ? null : state.phone.trim() || null,
      notes: state.homeDelivery ? null : state.notes.trim() || null,
      signatureData: state.homeDelivery ? null : state.signatureData || null,
      reason: state.reason.trim() || null,
      homeDelivery: state.homeDelivery,
      driverId: state.homeDelivery ? state.driverId || null : null,
      scheduledDate:
        state.homeDelivery && state.scheduledDate
          ? state.scheduledDate
          : null,
      items: state.assetIds.map((assetId) => ({
        assetId,
        quantity: 1,
      })),
    };

    if (state.type === 'ENTREGA') {
      return {
        ...base,
        personId: state.personId,
      };
    }

    return base;
  }

  const create = useMutation({
    mutationFn: async (vars: {
      formState: FormState;
      fileToUpload: File | null;
    }) => {
      if (!canUseHandover) {
        throw new Error('No tienes permisos para gestionar entregas y recogidas.');
      }

      const { formState, fileToUpload } = vars;

      if (!formState.assetIds.length) {
        throw new Error('Selecciona al menos un equipo.');
      }

      const allowedValues =
        formState.type === 'ENTREGA' ? DELIVERY_REASONS : PICKUP_REASONS;

      if (!formState.reason || !allowedValues.includes(formState.reason as any)) {
        throw new Error(
          `Selecciona un motivo válido para ${
            formState.type === 'ENTREGA' ? 'ENTREGA' : 'RECOGIDA'
          }.`,
        );
      }

      if (formState.type === 'ENTREGA' && !formState.personId) {
        throw new Error('Selecciona el usuario/custodio para la entrega.');
      }

      if (formState.type === 'RECOGIDA' && !formState.personId) {
        throw new Error('Selecciona el usuario/custodio para la recogida.');
      }

      if (formState.type === 'RECOGIDA' && baseVisibleAssets.length === 0) {
        throw new Error('Ese usuario no tiene equipos asignados.');
      }

      if (formState.homeDelivery && !formState.driverId) {
        throw new Error('Selecciona el conductor para la ruta a domicilio.');
      }

      if (formState.homeDelivery && !formState.scheduledDate) {
        throw new Error('Selecciona la fecha programada de la ruta a domicilio.');
      }

      if (!formState.homeDelivery) {
        if (!formState.signerName.trim()) {
          throw new Error('Falta el nombre de quien firma.');
        }

        if (!formState.signerId.trim()) {
          throw new Error('Falta la identificación de quien firma.');
        }

        if (!formState.relation) {
          throw new Error('Selecciona el parentesco/relación.');
        }

        if (!formState.email.trim()) {
          throw new Error('Falta el correo electrónico.');
        }

        if (!formState.phone.trim()) {
          throw new Error('Falta el teléfono.');
        }

        if (!formState.signatureData) {
          throw new Error('La firma en pantalla es obligatoria.');
        }
      }

      const payload = buildPayload(formState);
      const formData = new FormData();

      Object.entries(payload).forEach(([key, value]) => {
        if (value === null || typeof value === 'undefined') return;

        if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
          return;
        }

        formData.append(key, String(value));
      });

      if (fileToUpload) {
        formData.append('attachment', fileToUpload);
      }

      const res = await api.post('/api/handover', formData);

      return res.data;
    },
    onSuccess: (_resp, vars) => {
      toast.success(
        vars.formState.type === 'ENTREGA'
          ? 'Entrega registrada exitosamente.'
          : 'Recogida registrada exitosamente.',
      );

      if (vars.formState.homeDelivery) {
        toast.info('También se creó una ruta programada.', {
          action: {
            label: 'Ver rutas',
            onClick: () => router.push('/routes'),
          },
          duration: 6000,
        });
      }

      setForm(emptyForm());
      setShowOnlySelected(false);
      setAttachment(null);
      setFileKey(Date.now());
      setActiveTab('HISTORY');

      qc.invalidateQueries({ queryKey: ['handover-available-assets'] });
      qc.invalidateQueries({ queryKey: ['handover-assets-by-person'] });
      qc.invalidateQueries({ queryKey: ['handovers-history'] });
      qc.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ||
          error?.response?.data?.details?.message ||
          error?.message ||
          'No se pudo registrar.',
      );
    },
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    await create.mutateAsync({
      formState: form,
      fileToUpload: attachment,
    });
  }

  if (!roleReady) {
    return (
      <Guard>
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-300">
          Verificando permisos…
        </div>
      </Guard>
    );
  }

  if (!canUseHandover) {
    return (
      <Guard>
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          No tienes permisos para gestionar entregas y recogidas.
        </div>
      </Guard>
    );
  }

  return (
    <Guard>
      <section className="space-y-6 font-poppins mx-auto max-w-7xl pb-20">
        <div className="border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                Gestión Logística
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Registro de entregas, recogidas y rutas a domicilio.
              </p>
            </div>
          </div>

          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('NEW')}
              className={`pb-3 text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'NEW'
                  ? 'border-b-4 border-sky-600 text-sky-700'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Nuevo Registro
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`pb-3 text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'HISTORY'
                  ? 'border-b-4 border-sky-600 text-sky-700'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Historial de Trámites
            </button>
          </div>
        </div>

        {activeTab === 'NEW' && (
          <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
            <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                1. Datos del trámite
              </h2>

              <div className="grid gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Tipo de movimiento
                </label>

                <select
                  className="rounded-xl border px-3 py-3 text-sm bg-slate-50 dark:bg-slate-950 font-bold text-slate-800 outline-none focus:border-sky-600"
                  value={form.type}
                  onChange={(event) =>
                    setForm({
                      ...emptyForm(),
                      type: event.target.value as HandoverType,
                    })
                  }
                >
                  <option value="ENTREGA">ENTREGA DE EQUIPO</option>
                  <option value="RECOGIDA">RECOGIDA DE EQUIPO</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Usuario / custodio
                </label>

                <UserPicker
                  people={visiblePeople}
                  value={form.personId}
                  onChange={(id) =>
                    setForm((state) => ({
                      ...state,
                      personId: id,
                      assetIds: [],
                    }))
                  }
                  placeholder={
                    form.type === 'ENTREGA'
                      ? 'Seleccione usuario que recibirá'
                      : 'Seleccione usuario para recoger equipos'
                  }
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Motivo
                </label>

                <select
                  className="rounded-xl border px-3 py-3 text-sm bg-slate-50 dark:bg-slate-950 outline-none focus:border-sky-600"
                  value={form.reason}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      reason: event.target.value,
                    }))
                  }
                >
                  <option value="">Seleccione motivo…</option>

                  {reasonOptions.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                <div className="flex items-center gap-3">
                  <input
                    id="homeDelivery"
                    type="checkbox"
                    className="h-5 w-5 rounded text-sky-600 focus:ring-sky-600"
                    checked={form.homeDelivery}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        homeDelivery: event.target.checked,
                      }))
                    }
                  />

                  <label
                    htmlFor="homeDelivery"
                    className="text-sm font-bold text-sky-900 cursor-pointer select-none"
                  >
                    Gestionar a través de ruta / transporte
                  </label>
                </div>

                {form.homeDelivery && (
                  <p className="text-[10px] text-sky-700 ml-8 mt-1 leading-relaxed">
                    El inventario y la firma del paciente se procesarán cuando el
                    conductor finalice la ruta en terreno.
                  </p>
                )}
              </div>

              {form.homeDelivery && (
                <div className="grid gap-4 pt-4 border-t border-slate-100">
                  <div className="grid gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Conductor
                    </label>

                    <DriverPicker
                      drivers={driversQ.data ?? []}
                      value={form.driverId}
                      onChange={(id) =>
                        setForm((state) => ({
                          ...state,
                          driverId: id,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Fecha programada
                    </label>

                    <input
                      type="date"
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-sky-600"
                      value={form.scheduledDate}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          scheduledDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              {!form.homeDelivery && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Información de recepción física
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      className="rounded-xl border px-3 py-3 text-sm bg-slate-50 focus:border-sky-600 outline-none uppercase font-bold"
                      placeholder="Nombre de quien recibe"
                      value={form.signerName}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          signerName: event.target.value.replace(
                            /[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g,
                            '',
                          ),
                        }))
                      }
                    />

                    <input
                      inputMode="numeric"
                      className="rounded-xl border px-3 py-3 text-sm bg-slate-50 focus:border-sky-600 outline-none"
                      placeholder="N° de cédula"
                      value={form.signerId}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          signerId: event.target.value.replace(/\D/g, ''),
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <select
                      className="rounded-xl border px-3 py-3 text-sm bg-slate-50 focus:border-sky-600 outline-none"
                      value={form.relation}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          relation: event.target.value as Relation,
                        }))
                      }
                    >
                      {RELATIONS.map((relation) => (
                        <option key={relation} value={relation}>
                          {relation}
                        </option>
                      ))}
                    </select>

                    <input
                      inputMode="numeric"
                      className="rounded-xl border px-3 py-3 text-sm bg-slate-50 focus:border-sky-600 outline-none"
                      placeholder="Teléfono"
                      value={form.phone}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          phone: event.target.value.replace(/\D/g, ''),
                        }))
                      }
                    />
                  </div>

                  <input
                    type="email"
                    className="w-full rounded-xl border px-3 py-3 text-sm bg-slate-50 focus:border-sky-600 outline-none"
                    placeholder="Correo electrónico"
                    value={form.email}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        email: event.target.value,
                      }))
                    }
                  />

                  <textarea
                    className="w-full rounded-xl border px-3 py-3 text-sm bg-slate-50 focus:border-sky-600 outline-none"
                    placeholder="Observaciones adicionales…"
                    value={form.notes}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        notes: event.target.value,
                      }))
                    }
                    rows={2}
                  />

                  <div className="grid gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Documento soporte adicional
                    </label>

                    <input
                      key={fileKey}
                      type="file"
                      onChange={(event) =>
                        setAttachment(event.target.files?.[0] || null)
                      }
                      className="rounded-xl border px-3 py-2 text-xs bg-white file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-bold hover:file:bg-slate-300 cursor-pointer"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                    />
                  </div>

                  <div className="grid gap-1.5 pt-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                      Firma de conformidad

                      {form.signatureData && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm((state) => ({
                              ...state,
                              signatureData: null,
                            }))
                          }
                          className="text-rose-500 underline"
                        >
                          Borrar
                        </button>
                      )}
                    </label>

                    <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white shadow-inner">
                      <SignaturePad
                        value={form.signatureData}
                        onChange={(value) =>
                          setForm((state) => ({
                            ...state,
                            signatureData: value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-4">
                2. Selección de equipos
              </h2>

              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input
                  value={assetQ}
                  onChange={(event) => setAssetQ(event.target.value)}
                  placeholder="Buscar por nombre, tag o categoría…"
                  className="flex-1 rounded-xl border px-4 py-2 text-sm bg-slate-50 outline-none focus:border-sky-600"
                />

                <label className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={showOnlySelected}
                    onChange={(event) => setShowOnlySelected(event.target.checked)}
                    disabled={form.assetIds.length === 0}
                  />
                  <span>Filtrar elegidos</span>
                </label>
              </div>

              <div className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  Seleccionados:{' '}
                  <strong className="text-slate-800">{form.assetIds.length}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <span>Mostrar</span>

                  <select
                    className="rounded-lg border px-2 py-1 text-xs bg-white"
                    value={pageSize === 'ALL' ? 'ALL' : String(pageSize)}
                    onChange={(event) => {
                      const value = event.target.value;

                      setPageSize(
                        value === 'ALL'
                          ? 'ALL'
                          : (Number(value) as PageSizeOption),
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

              <div className="flex-1 overflow-y-auto border rounded-xl shadow-inner bg-slate-50/50 min-h-[300px]">
                {(availableAssetsQ.isLoading || assignedAssetsQ.isLoading) && (
                  <div className="p-8 text-center text-sm text-slate-400 font-medium">
                    Cargando equipos…
                  </div>
                )}

                {!availableAssetsQ.isLoading &&
                  !assignedAssetsQ.isLoading &&
                  paginatedAssets.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-400 font-medium">
                      No se encontraron equipos disponibles.
                    </div>
                  )}

                {paginatedAssets.length > 0 && (
                  <ul className="divide-y divide-slate-100">
                    {paginatedAssets.map((asset) => {
                      const checked = form.assetIds.includes(asset.id);
                      const status = String(asset.status || '').toUpperCase();

                      return (
                        <li
                          key={asset.id}
                          onClick={() => toggleAsset(asset.id)}
                          className={`p-4 flex items-center justify-between cursor-pointer transition-colors hover:bg-white ${
                            checked ? 'bg-sky-50/50' : ''
                          }`}
                        >
                          <div>
                            <div
                              className={`font-bold text-sm ${
                                checked ? 'text-sky-900' : 'text-slate-700'
                              }`}
                            >
                              {asset.tag}
                              <span className="text-[10px] uppercase ml-1 font-medium text-slate-500">
                                • {asset.name}
                              </span>
                            </div>

                            <div className="text-[10px] font-black tracking-widest mt-1 text-slate-400 uppercase">
                              {status.replace('_', ' ') || '—'}
                            </div>
                          </div>

                          <div
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                              checked
                                ? 'bg-sky-600 border-sky-600 text-white'
                                : 'bg-white border-slate-300'
                            }`}
                          >
                            {checked && '✓'}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {pageSize !== 'ALL' && totalPages > 1 && (
                <div className="mt-3 flex justify-end items-center gap-2 text-xs text-slate-500">
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1 disabled:opacity-40"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Anterior
                  </button>

                  <span>
                    Página {page} de {totalPages}
                  </span>

                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1 disabled:opacity-40"
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((value) => Math.min(totalPages, value + 1))
                    }
                  >
                    Siguiente
                  </button>
                </div>
              )}

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="w-full rounded-xl bg-slate-900 text-white py-4 text-sm font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                >
                  {create.isPending ? 'Procesando…' : 'Confirmar registro'}
                </button>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'HISTORY' && (
          <div className="animate-in fade-in duration-300">
            {handoversQ.isLoading ? (
              <div className="p-10 text-center font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                Cargando historial…
              </div>
            ) : (handoversQ.data || []).length === 0 ? (
              <div className="p-10 text-center text-slate-500 border rounded-xl bg-slate-50">
                No hay trámites registrados aún.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(handoversQ.data || []).map((handover) => (
                  <div
                    key={handover.id}
                    className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm flex flex-col gap-3 transition-shadow hover:shadow-md"
                  >
                    <div className="flex justify-between items-center border-b pb-3">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-1 rounded tracking-widest border ${
                          handover.type === 'ENTREGA'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {handover.type}
                      </span>

                      <span className="text-[10px] font-bold text-slate-400">
                        {new Date(handover.createdAt).toLocaleDateString('es-CO')}
                      </span>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Usuario / paciente
                      </p>

                      <p
                        className="font-bold text-sm text-slate-800 uppercase truncate"
                        title={handover.person?.fullName || ''}
                      >
                        {handover.person?.fullName || '—'}
                      </p>

                      {handover.reason && (
                        <p className="mt-1 text-[10px] text-slate-500 font-bold uppercase">
                          {handover.reason}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between items-end mt-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">
                        {handover.items?.length || 0} equipos
                      </p>

                      <button
                        onClick={() => setSelectedHandover(handover)}
                        className="text-[10px] font-black text-sky-600 bg-sky-50 px-3 py-1.5 rounded-lg hover:bg-sky-100 uppercase tracking-widest border border-sky-100 transition-colors"
                      >
                        Ver detalles
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedHandover && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight">
                    Detalle de gestión
                  </h2>

                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">
                    Registrado el:{' '}
                    {new Date(selectedHandover.createdAt).toLocaleString('es-CO')}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedHandover(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Tipo de movimiento
                    </p>

                    <p
                      className={`text-sm font-black uppercase ${
                        selectedHandover.type === 'ENTREGA'
                          ? 'text-sky-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {selectedHandover.type}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Autor de gestión
                    </p>

                    <p className="text-sm font-bold text-slate-700 uppercase truncate">
                      {selectedHandover.createdBy?.name || 'Sistema'}
                    </p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                    Información del usuario
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <p className="font-bold text-slate-800 uppercase sm:col-span-2">
                      {selectedHandover.person?.fullName || '—'}
                    </p>

                    <p className="text-slate-600 font-medium text-xs">
                      Doc: {selectedHandover.person?.documentId || '—'}
                    </p>

                    <p
                      className="text-slate-600 font-medium text-xs truncate"
                      title={selectedHandover.person?.email || ''}
                    >
                      Email: {selectedHandover.person?.email || '—'}
                    </p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                    Inventario procesado
                  </h3>

                  <ul className="divide-y">
                    {(selectedHandover.items || []).map((item) => (
                      <li
                        key={item.id}
                        className="py-2 flex justify-between items-center gap-2"
                      >
                        <span className="font-bold text-sm text-slate-700 uppercase leading-tight">
                          {item.asset?.tag}
                          <span className="font-medium text-slate-400 text-[10px] block sm:inline sm:ml-1">
                            • {item.asset?.name}
                          </span>
                        </span>

                        <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded whitespace-nowrap">
                          Cant: {item.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                    Validación y firma
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        Receptor físico
                      </p>

                      <p className="font-bold text-slate-800 uppercase">
                        {selectedHandover.signerName || '—'}
                      </p>

                      <p className="text-xs text-slate-500 font-medium uppercase mt-0.5">
                        {selectedHandover.relation || '—'} • Doc:{' '}
                        {selectedHandover.signerId || '—'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Trazo de conformidad
                      </p>

                      {selectedHandover.signatureData?.startsWith('data:image') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedHandover.signatureData}
                          alt="Firma"
                          className="h-16 border rounded bg-white p-1 object-contain"
                        />
                      ) : (
                        <p className="text-[10px] font-bold italic text-slate-400 uppercase">
                          {selectedHandover.signatureData || 'No disponible'}
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedHandover.notes && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Notas adicionales
                      </p>

                      <p className="text-xs text-slate-600 italic">
                        {selectedHandover.notes}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a
                      href={getSecureUrl(
                        `/uploads/handovers/Comodato_${selectedHandover.id}.pdf`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full flex items-center justify-center bg-indigo-50 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-all font-black uppercase text-[11px] sm:text-xs tracking-widest py-3 rounded-xl shadow-sm gap-2 ${
                        !(
                          selectedHandover.attachmentPath &&
                          !selectedHandover.attachmentPath.includes('Comodato_')
                        )
                          ? 'sm:col-span-2'
                          : ''
                      }`}
                    >
                      Ver comodato
                    </a>

                    {selectedHandover.attachmentPath &&
                      !selectedHandover.attachmentPath.includes('Comodato_') && (
                        <a
                          href={getSecureUrl(selectedHandover.attachmentPath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center bg-emerald-50 border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-all font-black uppercase text-[11px] sm:text-xs tracking-widest py-3 rounded-xl shadow-sm gap-2"
                        >
                          Soporte adicional
                        </a>
                      )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t bg-slate-50 flex justify-end">
                <button
                  onClick={() => setSelectedHandover(null)}
                  className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-colors"
                >
                  Cerrar detalles
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </Guard>
  );
}