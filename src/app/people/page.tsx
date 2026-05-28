'use client';

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Save,
  Search,
  Trash2,
  Upload,
  UserPlus,
  XCircle,
} from 'lucide-react';

import Guard from '@/components/auth-guard';
import { PageShell } from '@/components/common/page-shell';
import { SectionCard } from '@/components/common/section-card';
import ImportPeopleModal from '@/components/people/import-people-modal';
import { api, type AuthUser } from '@/lib/api';
import { capsFor, normalizeRole, type AppRole } from '@/lib/roles';

type PersonType = 'NOMINA' | 'OPS' | 'PACIENTE' | 'TERCERO';
type PageSizeOption = 10 | 50 | 100 | 'ALL';

type Person = {
  id: string;
  documentId: string | null;
  fullName: string;
  type: PersonType;
  area?: string | null;
  eps: string | null;
  department: string | null;
  municipality: string | null;
  address: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  finalStatus: string | null;
  inactivityType: string | null;
  inactivityDate: string | null;
};

type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

const TYPE_LABEL: Record<PersonType, string> = {
  NOMINA: 'Nómina',
  OPS: 'OPS',
  PACIENTE: 'Paciente',
  TERCERO: 'Tercero',
};

const PERSON_TYPES: Array<{ value: PersonType; label: string }> = [
  { value: 'PACIENTE', label: 'Paciente' },
  { value: 'NOMINA', label: 'Nómina' },
  { value: 'OPS', label: 'OPS' },
  { value: 'TERCERO', label: 'Tercero' },
];

const AREA_OPTIONS = [
  'TALENTO HUMANO',
  'EDUCACIÓN',
  'SISTEMAS',
  'ADMINISTRATIVA',
  'CONTABLE',
  'FACTURACION',
  'E&C',
  'SST - CALIDAD',
  'AUTORIZACIONES',
  'DIRECCION GENERAL',
  'SERVICIO PBS',
  'FINANCIERA',
  'ACTIVOS FIJOS',
  'FARMACIA',
  'JURIDICA',
  'COMPRAS',
  'CLINICA DE HERIDAS',
  'COMUNICACIONES',
  'NUTRIDOM',
  'DIRECCION MEDICA',
  'PHD',
  'SERVICIOS ESPECIALES',
] as const;

const EPS_OPTIONS = [
  'CAJA DE COMPENSACION FAMILIAR DEL VALLE DEL CAUCA - COMFENALCO VALLE DELAGENTE',
  'NUEVA EMPRESA PROMOTORA DE SALUD S.A - NUEVA EPS.',
  'ENTIDAD PROMOTORA DE SALUD SANITAS S.A.S.',
  'SALUD TOTAL EPS-S S.A',
  'COOSALUD ENTIDAD PROMOTORA DE SALUD S.A.',
  'PARTICULAR',
  'EPS SURAMERICANA S.A',
  'CAJA DE COMPENSACION FAMILIAR COMPENSAR',
  'ENTIDAD PROMOTORA DE SALUD SERVICIO OCCIDENTAL DE SALUD S.A. S.O.S.',
  'COOMEVA ENTIDAD PROMOTORA DE SALUD S.A.',
  'EMSSANAR E.S.S',
  'ASOCIACION MUTUAL LA ESPERANZA - ASMET SALUD',
  'FIDEICOMISOS PATRIMONIOS AUTONOMOS FIDUCIARIA LA PREVISORA S.A',
  'POSITIVA COMPAÑIA DE SEGUROS S.A.',
] as const;

const CO_DEPARTMENTS = [
  'AMAZONAS',
  'ANTIOQUIA',
  'ARAUCA',
  'ATLÁNTICO',
  'BOGOTÁ, D. C.',
  'BOLÍVAR',
  'BOYACÁ',
  'CALDAS',
  'CAQUETÁ',
  'CASANARE',
  'CAUCA',
  'CESAR',
  'CHOCÓ',
  'CÓRDOBA',
  'CUNDINAMARCA',
  'GUAINÍA',
  'GUAVIARE',
  'HUILA',
  'LA GUAJIRA',
  'MAGDALENA',
  'META',
  'NARIÑO',
  'NORTE DE SANTANDER',
  'PUTUMAYO',
  'QUINDÍO',
  'RISARALDA',
  'SANTANDER',
  'SUCRE',
  'TOLIMA',
  'VALLE DEL CAUCA',
  'VAUPÉS',
  'VICHADA',
] as const;

const INACTIVITY_TYPES = [
  'FALLECIDO',
  'EGRESO BARTHEL',
  'CAMBIO DE PRESTADOR',
  'SALIDA COLABORADOR',
  'EGRESO ADMINISTRATIVO',
] as const;

function normalizeType(value?: string | null): PersonType {
  const normalized = String(value || '').trim().toUpperCase();

  if (
    normalized === 'NOMINA' ||
    normalized === 'OPS' ||
    normalized === 'PACIENTE' ||
    normalized === 'TERCERO'
  ) {
    return normalized;
  }

  return 'PACIENTE';
}

function normalizeFinalStatus(value?: string | null): 'ACTIVO' | 'INACTIVO' {
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

function emptyForm(): Partial<Person> {
  return {
    documentId: '',
    fullName: '',
    type: 'PACIENTE',
    area: null,
    eps: null,
    department: null,
    municipality: null,
    address: '',
    email: '',
    phone: '',
    notes: '',
    finalStatus: 'ACTIVO',
    inactivityType: null,
    inactivityDate: null,
  };
}

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);

    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

function typeBadgeClass(type?: string | null) {
  const normalized = normalizeType(type);

  if (normalized === 'PACIENTE') {
    return 'border-[#3C9CD1]/30 bg-[#3C9CD1]/10 text-[#1B3859]';
  }

  if (normalized === 'NOMINA') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (normalized === 'OPS') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function statusBadgeClass(status?: string | null) {
  return normalizeFinalStatus(status) === 'ACTIVO'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-rose-200 bg-rose-50 text-rose-700';
}

function inputClass() {
  return 'h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10';
}

function textareaClass() {
  return 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10';
}

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
      {children}
      {required && <span className="ml-1 text-rose-500">*</span>}
    </label>
  );
}

function Modal({
  title,
  description,
  open,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[#111827]">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            aria-label="Cerrar"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-80px)] overflow-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function PersonForm({
  form,
  setForm,
  editingId,
  isPending,
  onSubmit,
  onCancel,
}: {
  form: Partial<Person>;
  setForm: Dispatch<SetStateAction<Partial<Person>>>;
  editingId: string | null;
  isPending: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  const isInactive = normalizeFinalStatus(form.finalStatus) === 'INACTIVO';
  const isNomina = normalizeType(form.type) === 'NOMINA';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-1.5">
          <FieldLabel>Documento</FieldLabel>
          <input
            className={inputClass()}
            value={form.documentId || ''}
            onChange={(event) =>
              setForm((state) => ({
                ...state,
                documentId: event.target.value,
              }))
            }
          />
        </div>

        <div className="grid gap-1.5">
          <FieldLabel required>Nombre completo</FieldLabel>
          <input
            className={inputClass()}
            value={form.fullName || ''}
            onChange={(event) =>
              setForm((state) => ({
                ...state,
                fullName: event.target.value,
              }))
            }
          />
        </div>

        <div className="grid gap-1.5">
          <FieldLabel>Tipo</FieldLabel>
          <select
            className={inputClass()}
            value={normalizeType(form.type)}
            onChange={(event) => {
              const nextType = normalizeType(event.target.value);

              setForm((state) => ({
                ...state,
                type: nextType,
                area: nextType === 'NOMINA' ? state.area ?? null : null,
              }));
            }}
          >
            {PERSON_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isNomina && (
        <div className="grid gap-1.5">
          <FieldLabel>Área</FieldLabel>
          <select
            className={inputClass()}
            value={form.area || ''}
            onChange={(event) =>
              setForm((state) => ({
                ...state,
                area: event.target.value || null,
              }))
            }
          >
            <option value="">—</option>
            {AREA_OPTIONS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <FieldLabel>EPS</FieldLabel>
          <select
            className={inputClass()}
            value={form.eps || ''}
            onChange={(event) =>
              setForm((state) => ({
                ...state,
                eps: event.target.value || null,
              }))
            }
          >
            <option value="">—</option>

            {form.eps && !EPS_OPTIONS.includes(form.eps as any) && (
              <option value={form.eps}>{form.eps}</option>
            )}

            {EPS_OPTIONS.map((eps) => (
              <option key={eps} value={eps}>
                {eps}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <FieldLabel>Estado final</FieldLabel>
          <select
            className={inputClass()}
            value={normalizeFinalStatus(form.finalStatus)}
            onChange={(event) => {
              const next = normalizeFinalStatus(event.target.value);

              setForm((state) => ({
                ...state,
                finalStatus: next,
                inactivityType: next === 'ACTIVO' ? null : state.inactivityType,
                inactivityDate: next === 'ACTIVO' ? null : state.inactivityDate,
              }));
            }}
          >
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <FieldLabel>Departamento</FieldLabel>
          <select
            className={inputClass()}
            value={form.department || ''}
            onChange={(event) =>
              setForm((state) => ({
                ...state,
                department: event.target.value || null,
                municipality: null,
              }))
            }
          >
            <option value="">—</option>

            {form.department &&
              !CO_DEPARTMENTS.includes(form.department as any) && (
                <option value={form.department}>{form.department}</option>
              )}

            {CO_DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <FieldLabel>Municipio</FieldLabel>
          <input
            className={inputClass()}
            value={form.municipality || ''}
            onChange={(event) =>
              setForm((state) => ({
                ...state,
                municipality: event.target.value,
              }))
            }
            placeholder="Ej: CÚCUTA"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <FieldLabel>Teléfono</FieldLabel>
          <input
            className={inputClass()}
            value={form.phone || ''}
            onChange={(event) =>
              setForm((state) => ({
                ...state,
                phone: event.target.value,
              }))
            }
          />
        </div>

        <div className="grid gap-1.5">
          <FieldLabel>Correo</FieldLabel>
          <input
            type="email"
            className={inputClass()}
            value={form.email || ''}
            onChange={(event) =>
              setForm((state) => ({
                ...state,
                email: event.target.value,
              }))
            }
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <FieldLabel>Dirección</FieldLabel>
        <input
          className={inputClass()}
          value={form.address || ''}
          onChange={(event) =>
            setForm((state) => ({
              ...state,
              address: event.target.value,
            }))
          }
          placeholder="Carrera 10 # 20-30"
        />
      </div>

      {isInactive && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <FieldLabel>Tipo de inactivación</FieldLabel>
            <select
              className={inputClass()}
              value={form.inactivityType || ''}
              onChange={(event) =>
                setForm((state) => ({
                  ...state,
                  inactivityType: event.target.value || null,
                }))
              }
            >
              <option value="">Seleccione…</option>

              {INACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <FieldLabel>Fecha inactividad</FieldLabel>
            <input
              type="date"
              className={inputClass()}
              value={form.inactivityDate || ''}
              onChange={(event) =>
                setForm((state) => ({
                  ...state,
                  inactivityDate: event.target.value || null,
                }))
              }
            />
          </div>
        </div>
      )}

      <div className="grid gap-1.5">
        <FieldLabel>Notas</FieldLabel>
        <textarea
          rows={3}
          className={textareaClass()}
          value={form.notes || ''}
          onChange={(event) =>
            setForm((state) => ({
              ...state,
              notes: event.target.value,
            }))
          }
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132B45] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {editingId ? 'Guardar cambios' : 'Crear usuario'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function PeoplePage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [role, setRole] = useState<AppRole | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  const caps = useMemo(() => capsFor(role), [role]);

  const canViewPeople = caps.viewPeople;
  const canEditPeople = caps.editPeople;

  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q.trim(), 350);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Person>>(emptyForm());
  const [showFormModal, setShowFormModal] = useState(false);
  const [showImport, setShowImport] = useState(false);

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
        console.error('Error validando permisos en población:', error);

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

    if (!canViewPeople) {
      router.replace('/assets');
    }
  }, [checkingRole, role, canViewPeople, router]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, pageSize]);

  const people = useQuery<Paginated<Person>>({
    queryKey: ['people', { q: debouncedQ, page, pageSize }],
    enabled: !checkingRole && canViewPeople,
    queryFn: async (): Promise<Paginated<Person>> => {
      const res = await api.get<Paginated<Person>>('/api/people', {
        params: {
          q: debouncedQ || undefined,
          page,
          pageSize: pageSize === 'ALL' ? 10000 : pageSize,
        },
      });

      return res.data;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });

  const createPerson = useMutation({
    mutationFn: async (payload: Partial<Person>) => {
      const res = await api.post<Person>('/api/people', payload);

      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people'] });
      closeFormModal();
      toast.success('Usuario creado');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ?? 'No se pudo crear el usuario.',
      );
    },
  });

  const updatePerson = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<Person>;
    }) => {
      const res = await api.patch<Person>(`/api/people/${id}`, payload);

      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people'] });
      closeFormModal();
      toast.success('Usuario actualizado');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ?? 'No se pudo actualizar el usuario.',
      );
    },
  });

  const deletePerson = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/people/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people'] });
      toast.success('Usuario eliminado');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ?? 'No se pudo eliminar el usuario.',
      );
    },
  });

  const totalItems = people.data?.total ?? 0;
  const totalPages = pageSize === 'ALL' ? 1 : people.data?.pages ?? 1;
  const currentPage = people.data?.page ?? page;
  const items = people.data?.items ?? [];

  const isSaving = createPerson.isPending || updatePerson.isPending;

  function openNewModal() {
    setEditingId(null);
    setForm(emptyForm());
    setShowFormModal(true);
  }

  function openEditModal(person: Person) {
    const type = normalizeType(person.type);
    const finalStatus = normalizeFinalStatus(person.finalStatus);

    setEditingId(person.id);
    setForm({
      id: person.id,
      documentId: person.documentId ?? '',
      fullName: person.fullName ?? '',
      type,
      area: type === 'NOMINA' ? person.area ?? null : null,
      eps: person.eps ?? null,
      department: person.department ?? null,
      municipality: person.municipality ?? null,
      address: person.address ?? '',
      email: person.email ?? '',
      phone: person.phone ?? '',
      notes: person.notes ?? '',
      finalStatus,
      inactivityType:
        finalStatus === 'INACTIVO' ? person.inactivityType ?? null : null,
      inactivityDate:
        finalStatus === 'INACTIVO' && person.inactivityDate
          ? person.inactivityDate.slice(0, 10)
          : null,
    });
    setShowFormModal(true);
  }

  function closeFormModal() {
    setShowFormModal(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!canEditPeople) {
      toast.error('No tienes permisos para gestionar población.');
      return;
    }

    const type = normalizeType(form.type);
    const finalStatus = normalizeFinalStatus(form.finalStatus);

    const payload: Partial<Person> = {
      documentId: form.documentId?.trim() || null,
      fullName: form.fullName?.trim() || '',
      type,
      area: type === 'NOMINA' ? form.area?.trim() || null : null,
      eps: form.eps?.trim() || null,
      department: form.department?.trim() || null,
      municipality: form.municipality?.trim() || null,
      address: form.address?.trim() || null,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
      notes: form.notes?.trim() || null,
      finalStatus,
      inactivityType:
        finalStatus === 'INACTIVO'
          ? form.inactivityType?.trim() || null
          : null,
      inactivityDate:
        finalStatus === 'INACTIVO' ? form.inactivityDate || null : null,
    };

    if (!payload.fullName) {
      toast.error('El nombre completo es obligatorio.');
      return;
    }

    if (editingId) {
      await updatePerson.mutateAsync({
        id: editingId,
        payload,
      });
    } else {
      await createPerson.mutateAsync(payload);
    }
  }

  async function handleDelete(id: string) {
    const ok = confirm('¿Eliminar este usuario?');

    if (!ok) return;

    await deletePerson.mutateAsync(id);
  }

  if (checkingRole) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando permisos…
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
            <p className="text-sm font-semibold text-rose-600">{roleError}</p>
          </SectionCard>
        </PageShell>
      </Guard>
    );
  }

  if (!canViewPeople) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <p className="text-sm text-slate-600">
              No tienes permisos para ver población.
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
          title="Población"
          contentClassName="p-0"
          actions={
            canEditPeople ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openNewModal}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132B45]"
                >
                  <UserPlus className="h-4 w-4" />
                  Nuevo usuario
                </button>

                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#1B3859] transition hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4" />
                  Importar
                </button>
              </div>
            ) : null
          }
        >
          <div className="space-y-4 p-4 sm:p-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Buscar por nombre, documento, EPS, área o municipio…"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-10 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                />

                {q && (
                  <button
                    type="button"
                    onClick={() => setQ('')}
                    className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Limpiar búsqueda"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-4">
                <h2 className="text-sm font-semibold text-[#1B3859]">
                  Registros
                </h2>
                <p className="text-xs text-slate-500">
                  {totalItems
                    ? `${totalItems} resultado(s) encontrados`
                    : 'Sin resultados para mostrar'}
                </p>
              </div>

              <div className="overflow-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="w-[160px] px-4 py-3">Documento</th>
                      <th className="px-4 py-3">Nombre completo</th>
                      <th className="w-[170px] px-4 py-3">Estado</th>
                      <th className="w-[210px] px-4 py-3 text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {people.isLoading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center">
                          <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando población…
                          </div>
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center">
                          <p className="text-sm font-semibold text-slate-700">
                            Sin usuarios
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Ajusta la búsqueda o crea un nuevo usuario.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      items.map((person) => {
                        const personType = normalizeType(person.type);
                        const finalStatus = normalizeFinalStatus(
                          person.finalStatus,
                        );

                        const areaOrEps =
                          personType === 'NOMINA'
                            ? person.area || ''
                            : person.eps || '';

                        const location = [person.department, person.municipality]
                          .filter(Boolean)
                          .join(' / ');

                        return (
                          <tr
                            key={person.id}
                            className="align-top transition hover:bg-slate-50"
                          >
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {person.documentId || '—'}
                            </td>

                            <td className="px-4 py-3">
                              <p
                                className="max-w-[520px] truncate font-bold uppercase text-[#111827]"
                                title={person.fullName || ''}
                              >
                                {person.fullName || 'Sin nombre'}
                              </p>

                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                                <span
                                  className={[
                                    'inline-flex h-6 items-center rounded-full border px-2 font-semibold',
                                    typeBadgeClass(person.type),
                                  ].join(' ')}
                                >
                                  {TYPE_LABEL[personType]}
                                </span>

                                {areaOrEps && (
                                  <span
                                    className="max-w-[260px] truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium"
                                    title={areaOrEps}
                                  >
                                    {areaOrEps}
                                  </span>
                                )}

                                {location && (
                                  <span
                                    className="max-w-[220px] truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium"
                                    title={location}
                                  >
                                    {location}
                                  </span>
                                )}

                                {person.phone && (
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium">
                                    Tel: {person.phone}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={[
                                  'inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold',
                                  statusBadgeClass(person.finalStatus),
                                ].join(' ')}
                              >
                                {finalStatus === 'ACTIVO'
                                  ? 'Activo'
                                  : 'Inactivo'}
                              </span>

                              {finalStatus === 'INACTIVO' && (
                                <p className="mt-1 max-w-[160px] truncate text-xs text-slate-500">
                                  {person.inactivityType || '—'}
                                </p>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              {canEditPeople ? (
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(person)}
                                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#1B3859] transition hover:bg-slate-50"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Editar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDelete(person.id)}
                                    disabled={deletePerson.isPending}
                                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Eliminar
                                  </button>
                                </div>
                              ) : (
                                <span className="block text-right text-xs text-slate-400">
                                  Solo lectura
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Mostrar
                  </span>

                  <select
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
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

                {pageSize !== 'ALL' && totalPages > 1 && (
                  <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() =>
                        setPage((value) => Math.max(1, value - 1))
                      }
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </button>

                    <span className="hidden font-medium sm:inline">
                      Página {currentPage} de {totalPages}
                    </span>

                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() =>
                        setPage((value) => Math.min(totalPages, value + 1))
                      }
                      disabled={currentPage >= totalPages}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {!people.isLoading && people.isFetching && items.length > 0 && (
                <div className="flex items-center justify-end border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Actualizando…
                </div>
              )}
            </div>
          </div>

          {canEditPeople && (
            <>
              <ImportPeopleModal
                open={showImport}
                onClose={() => setShowImport(false)}
              />

              <Modal
                open={showFormModal}
                onClose={closeFormModal}
                title={editingId ? 'Editar usuario' : 'Nuevo usuario'}
                description="Registra o actualiza información de pacientes, colaboradores, OPS y terceros."
              >
                <PersonForm
                  form={form}
                  setForm={setForm}
                  editingId={editingId}
                  isPending={isSaving}
                  onSubmit={submit}
                  onCancel={closeFormModal}
                />
              </Modal>
            </>
          )}
        </SectionCard>
      </PageShell>
    </Guard>
  );
}