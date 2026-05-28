'use client';

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BadgeCheck,
  Boxes,
  Building2,
  CheckCircle2,
  CircleOff,
  Database,
  Edit3,
  FolderKanban,
  KeyRound,
  Layers3,
  Loader2,
  MapPin,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';

import Guard from '@/components/auth-guard';
import { PageShell } from '@/components/common/page-shell';
import { SectionCard } from '@/components/common/section-card';
import SitesPanel from '@/components/settings/sites-panel';
import { api, type AuthUser } from '@/lib/api';
import {
  useDeleteCategory,
  useDeleteLocation,
  useSites,
  useUpdateCategory,
  useUpdateLocation,
} from '@/lib/hooks';
import {
  useCreateUser,
  useResetPassword,
  useUpdateUser,
  useUsers,
} from '@/lib/user-hooks';
import { normalizeRole, type AppRole } from '@/lib/roles';

/* ────────────────────────────────────────────────────────────────────────────
   Data hooks locales
──────────────────────────────────────────────────────────────────────────── */

function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () =>
      (await api.get('/api/catalog/categories', { params: { pageSize: 100 } }))
        .data.items,
  });
}

function useCreateCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      code?: string | null;
      description?: string | null;
    }) => api.post('/api/catalog/categories', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoría creada');
    },
  });
}

function useAddCategoryName() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: { categoryId: string; name: string }) =>
      api.post('/api/catalog/category-names', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

function useRemoveCategoryName() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/catalog/category-names/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () =>
      (await api.get('/api/catalog/locations', { params: { pageSize: 100 } }))
        .data.items,
  });
}

function useCreateLocation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      type?: string | null;
      address?: string | null;
      siteId?: string | null;
    }) => api.post('/api/catalog/locations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Ubicación creada');
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   UI helpers
──────────────────────────────────────────────────────────────────────────── */

function canManageSettingsRole(role: AppRole | null) {
  return role === 'SUPER_ADMIN' || role === 'ACTIVOS_FIJOS';
}

function inputClass() {
  return 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10';
}

function textareaClass() {
  return 'min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10';
}

function buttonPrimaryClass() {
  return 'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132B45] disabled:cursor-not-allowed disabled:opacity-60';
}

function buttonSecondaryClass() {
  return 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#1B3859] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60';
}

function buttonDangerClass() {
  return 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60';
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

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-[#111827]">{value}</p>
        </div>

        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  maxWidth = 'max-w-md',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        className={`w-full ${maxWidth} overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-[#111827]">{title}</h3>
            {subtitle && (
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  title,
  message,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: ReactNode;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-600">{message}</p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={buttonSecondaryClass()}>
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Eliminar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TabButton({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex min-w-[220px] items-start gap-3 rounded-2xl border p-4 text-left transition',
        active
          ? 'border-[#3C9CD1]/40 bg-[#3C9CD1]/10 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      <div
        className={[
          'grid h-10 w-10 shrink-0 place-items-center rounded-2xl',
          active ? 'bg-white text-[#1B3859]' : 'bg-slate-50 text-slate-500',
        ].join(' ')}
      >
        {icon}
      </div>

      <span>
        <span className="block text-sm font-bold text-[#111827]">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
    </button>
  );
}

function locationTypeLabel(type?: string | null) {
  if (type === 'warehouse') return 'Bodega';
  if (type === 'office') return 'Oficina';
  if (type === 'client') return 'Cliente';
  if (type === 'other') return 'Otro';

  return '—';
}

function roleLabel(role?: string | null) {
  if (role === 'SUPER_ADMIN') return 'Super admin';
  if (role === 'ACTIVOS_FIJOS') return 'Activos fijos';
  if (role === 'INVENTARIO') return 'Inventario';
  if (role === 'ADMINISTRATIVO') return 'Administrativo';
  if (role === 'CONDUCTOR') return 'Conductor';
  if (role === 'VIEWER') return 'Consulta';

  return role || '—';
}

function roleBadgeClass(role?: string | null) {
  if (role === 'SUPER_ADMIN') return 'border-purple-200 bg-purple-50 text-purple-800';
  if (role === 'ACTIVOS_FIJOS') return 'border-[#3C9CD1]/30 bg-[#3C9CD1]/10 text-[#1B3859]';
  if (role === 'INVENTARIO') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (role === 'CONDUCTOR') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (role === 'ADMINISTRATIVO') return 'border-slate-200 bg-slate-50 text-slate-700';

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

/* ────────────────────────────────────────────────────────────────────────────
   Página de Configuraciones
──────────────────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const router = useRouter();

  const [tab, setTab] = useState<'categories' | 'locations' | 'users'>(
    'categories',
  );
  const [role, setRole] = useState<AppRole | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  const canManageSettings = canManageSettingsRole(role);

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
        console.error('Error validando permisos en configuraciones:', error);

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

    if (!canManageSettings) {
      router.replace('/assets');
    }
  }, [checkingRole, canManageSettings, router]);

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

  if (!canManageSettings) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <p className="text-sm text-slate-600">
              No tienes permisos para administrar configuraciones.
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
          title="Configuración"
          contentClassName="p-0"
          actions={
            <span className="inline-flex h-9 items-center rounded-full border border-[#3C9CD1]/30 bg-[#3C9CD1]/10 px-3 text-xs font-semibold text-[#1B3859]">
              Rol: {roleLabel(role)}
            </span>
          }
        >
          <div className="space-y-5 p-4 sm:p-5">
            

            <div className="grid gap-3 lg:grid-cols-3">
              <TabButton
                active={tab === 'categories'}
                icon={<Layers3 className="h-5 w-5" />}
                title="Categorías y activos"
                description="Catálogo base de categorías y nombres permitidos."
                onClick={() => setTab('categories')}
              />

              <TabButton
                active={tab === 'locations'}
                icon={<Building2 className="h-5 w-5" />}
                title="Ubicaciones y sedes"
                description="Bodegas, oficinas, sedes y puntos operativos."
                onClick={() => setTab('locations')}
              />

              <TabButton
                active={tab === 'users'}
                icon={<Users className="h-5 w-5" />}
                title="Usuarios del sistema"
                description="Cuentas, roles, estado y restablecimiento de clave."
                onClick={() => setTab('users')}
              />
            </div>

            {tab === 'categories' && <CategoriesPanel />}
            {tab === 'locations' && <LocationsPanel />}
            {tab === 'users' && <UsersPanel />}
          </div>
        </SectionCard>
      </PageShell>
    </Guard>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Categorías
──────────────────────────────────────────────────────────────────────────── */

function CategoriesPanel() {
  const list = useCategories();
  const create = useCreateCategory();
  const upd = useUpdateCategory();
  const del = useDeleteCategory();

  const addName = useAddCategoryName();
  const removeName = useRemoveCategoryName();

  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);

  const [managingNames, setManagingNames] = useState<any | null>(null);
  const [newName, setNewName] = useState('');

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  const categories = Array.isArray(list.data) ? list.data : [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      return toast.error('El nombre es obligatorio');
    }

    try {
      await create.mutateAsync({
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
      });

      setName('');
      setCode('');
      setDescription('');
    } catch (error: any) {
      toast.error(error?.response?.data?.error ?? 'No se pudo crear la categoría.');
    }
  }

  const currentManagingCategory = useMemo(() => {
    if (!managingNames || !categories.length) return managingNames;

    return categories.find((c: any) => c.id === managingNames.id) || managingNames;
  }, [managingNames, categories]);

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form
        onSubmit={onSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[#1B3859]">
            Nueva categoría
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Define familias de activos y el catálogo de nombres permitidos.
          </p>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <FieldLabel required>Nombre</FieldLabel>
            <input
              className={inputClass()}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Computadores"
            />
          </div>

          <div className="grid gap-1.5">
            <FieldLabel>Código</FieldLabel>
            <input
              className={inputClass()}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="COMP"
            />
          </div>

          <div className="grid gap-1.5">
            <FieldLabel>Descripción</FieldLabel>
            <textarea
              className={textareaClass()}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Portátiles y computadores de escritorio"
            />
          </div>

          <button disabled={create.isPending} className={buttonPrimaryClass()}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {create.isPending ? 'Guardando…' : 'Guardar categoría'}
          </button>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-[#1B3859]">
              Categorías creadas
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {categories.length} registro(s)
            </p>
          </div>

          {list.isFetching && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )}
        </div>

        <div className="max-h-[72vh] space-y-3 overflow-auto p-4">
          {list.isLoading ? (
            <LoadingState label="Cargando categorías…" />
          ) : categories.length === 0 ? (
            <EmptyState label="Sin categorías." />
          ) : (
            categories.map((c: any) => (
              <article
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#3C9CD1]/40"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold uppercase text-[#111827]">
                        {c.name}
                      </h3>

                      {c.code && (
                        <span className="inline-flex h-7 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                          {c.code}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {c.description || 'Sin descripción'}
                    </p>

                    <p className="mt-2 inline-flex h-8 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                      {c.allowedNames?.length || 0} tipo(s) de activo
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={buttonSecondaryClass()}
                      onClick={() => setManagingNames(c)}
                    >
                      <Boxes className="h-4 w-4" />
                      Activos
                    </button>

                    <button
                      type="button"
                      className={buttonSecondaryClass()}
                      onClick={() => setEditing({ ...c })}
                    >
                      <Edit3 className="h-4 w-4" />
                      Editar
                    </button>

                    <button
                      type="button"
                      className={buttonDangerClass()}
                      onClick={() => setConfirmDel(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {managingNames && currentManagingCategory && (
        <Modal
          title="Catálogo de activos"
          subtitle={`Categoría: ${currentManagingCategory.name}`}
          onClose={() => {
            setManagingNames(null);
            setNewName('');
          }}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();

                if (!newName.trim()) return;

                try {
                  await addName.mutateAsync({
                    categoryId: currentManagingCategory.id,
                    name: newName.trim(),
                  });

                  setNewName('');
                  toast.success('Activo agregado correctamente');
                } catch (err: any) {
                  toast.error(err?.response?.data?.error || 'Error al agregar');
                }
              }}
              className="flex gap-2"
            >
              <input
                className={inputClass()}
                placeholder="Ej: SILLA ERGONÓMICA"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />

              <button
                disabled={addName.isPending}
                className={buttonPrimaryClass()}
              >
                {addName.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Guardar
              </button>
            </form>

            <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
              {currentManagingCategory.allowedNames?.length ? (
                currentManagingCategory.allowedNames.map((n: any) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm"
                  >
                    <span className="font-medium text-slate-700">{n.name}</span>

                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      onClick={async () => {
                        const ok = confirm(
                          `¿Eliminar "${n.name}" del catálogo? No afectará a los activos que ya lo usan.`,
                        );

                        if (!ok) return;

                        try {
                          await removeName.mutateAsync(n.id);
                          toast.success('Activo eliminado de la lista');
                        } catch {
                          toast.error('Error al eliminar');
                        }
                      }}
                    >
                      Borrar
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState label="Aún no hay tipos de activos registrados." />
              )}
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal
          title="Editar categoría"
          onClose={() => setEditing(null)}
          maxWidth="max-w-md"
        >
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <FieldLabel required>Nombre</FieldLabel>
              <input
                className={inputClass()}
                value={editing.name}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    name: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-1.5">
              <FieldLabel>Código</FieldLabel>
              <input
                className={inputClass()}
                value={editing.code || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    code: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-1.5">
              <FieldLabel>Descripción</FieldLabel>
              <textarea
                className={textareaClass()}
                value={editing.description || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    description: e.target.value,
                  })
                }
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                className={buttonSecondaryClass()}
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={buttonPrimaryClass()}
                disabled={upd.isPending}
                onClick={async () => {
                  await upd.mutateAsync({
                    id: editing.id,
                    data: {
                      name: editing.name,
                      code: editing.code || null,
                      description: editing.description || null,
                    },
                  });

                  setEditing(null);
                  toast.success('Categoría actualizada');
                }}
              >
                {upd.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDeleteModal
          title="Eliminar categoría"
          message={
            <>
              ¿Seguro que deseas eliminar <b>{confirmDel.name}</b>?
            </>
          }
          pending={del.isPending}
          onCancel={() => setConfirmDel(null)}
          onConfirm={async () => {
            try {
              await del.mutateAsync(confirmDel.id);
              toast.success('Categoría eliminada');
            } catch (e: any) {
              toast.error(e?.response?.data?.error ?? 'No se pudo eliminar');
            } finally {
              setConfirmDel(null);
            }
          }}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Ubicaciones
──────────────────────────────────────────────────────────────────────────── */

function LocationsPanel() {
  const list = useLocations();
  const create = useCreateLocation();
  const sites = useSites();

  const [name, setName] = useState('');
  const [type, setType] = useState('warehouse');
  const [address, setAddress] = useState('');
  const [siteId, setSiteId] = useState('');

  const upd = useUpdateLocation();
  const del = useDeleteLocation();

  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);

  const locations = Array.isArray(list.data) ? list.data : [];
  const siteList = Array.isArray(sites.data) ? sites.data : [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      return toast.error('El nombre es obligatorio');
    }

    try {
      await create.mutateAsync({
        name: name.trim(),
        type: type || null,
        address: address.trim() || null,
        siteId: siteId || null,
      });

      setName('');
      setType('warehouse');
      setAddress('');
      setSiteId('');
    } catch (error: any) {
      toast.error(error?.response?.data?.error ?? 'No se pudo crear la ubicación.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#1B3859]">
              Nueva ubicación
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Registra bodegas, oficinas o puntos asociados a una sede.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <FieldLabel required>Nombre</FieldLabel>
              <input
                className={inputClass()}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bodega Principal"
              />
            </div>

            <div className="grid gap-1.5">
              <FieldLabel>Tipo</FieldLabel>
              <select
                className={inputClass()}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="warehouse">Bodega</option>
                <option value="office">Oficina</option>
                <option value="client">Cliente</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <FieldLabel>Dirección</FieldLabel>
              <input
                className={inputClass()}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle 1 #2-3"
              />
            </div>

            <div className="grid gap-1.5">
              <FieldLabel>Sede</FieldLabel>
              <select
                className={inputClass()}
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              >
                <option value="">Sin sede</option>

                {siteList.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <button disabled={create.isPending} className={buttonPrimaryClass()}>
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {create.isPending ? 'Guardando…' : 'Guardar ubicación'}
            </button>
          </div>
        </form>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-[#1B3859]">
                Ubicaciones
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {locations.length} registro(s)
              </p>
            </div>

            {list.isFetching && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>

          <div className="max-h-[72vh] space-y-3 overflow-auto p-4">
            {list.isLoading ? (
              <LoadingState label="Cargando ubicaciones…" />
            ) : locations.length === 0 ? (
              <EmptyState label="Sin ubicaciones." />
            ) : (
              locations.map((l: any) => (
                <article
                  key={l.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#3C9CD1]/40"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold uppercase text-[#111827]">
                          {l.name}
                        </h3>

                        <span className="inline-flex h-7 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                          {locationTypeLabel(l.type)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {l.address || 'Sin dirección'}
                      </p>

                      <p className="mt-2 inline-flex h-8 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                        Sede: {l.site?.name || 'Sin sede'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={buttonSecondaryClass()}
                        onClick={() => setEditing({ ...l })}
                      >
                        <Edit3 className="h-4 w-4" />
                        Editar
                      </button>

                      <button
                        type="button"
                        className={buttonDangerClass()}
                        onClick={() => setConfirmDel(l)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
            <Building2 className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-[#1B3859]">
              Sedes
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Administra sedes y su relación con bodegas o ubicaciones operativas.
            </p>
          </div>
        </div>

        <SitesPanel />
      </div>

      {editing && (
        <Modal
          title="Editar ubicación"
          onClose={() => setEditing(null)}
          maxWidth="max-w-md"
        >
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <FieldLabel required>Nombre</FieldLabel>
              <input
                className={inputClass()}
                value={editing.name}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    name: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-1.5">
              <FieldLabel>Tipo</FieldLabel>
              <select
                className={inputClass()}
                value={editing.type || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    type: e.target.value,
                  })
                }
              >
                <option value="">—</option>
                <option value="warehouse">Bodega</option>
                <option value="office">Oficina</option>
                <option value="client">Cliente</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <FieldLabel>Dirección</FieldLabel>
              <input
                className={inputClass()}
                value={editing.address || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    address: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-1.5">
              <FieldLabel>Sede</FieldLabel>
              <select
                className={inputClass()}
                value={editing.siteId || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    siteId: e.target.value,
                  })
                }
              >
                <option value="">Sin sede</option>

                {siteList.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                className={buttonSecondaryClass()}
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={buttonPrimaryClass()}
                disabled={upd.isPending}
                onClick={async () => {
                  await upd.mutateAsync({
                    id: editing.id,
                    data: {
                      name: editing.name,
                      type: editing.type || null,
                      address: editing.address || null,
                      siteId: editing.siteId || null,
                    },
                  });

                  setEditing(null);
                  toast.success('Ubicación actualizada');
                }}
              >
                {upd.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDeleteModal
          title="Eliminar ubicación"
          message={
            <>
              ¿Seguro que deseas eliminar <b>{confirmDel.name}</b>?
            </>
          }
          pending={del.isPending}
          onCancel={() => setConfirmDel(null)}
          onConfirm={async () => {
            try {
              await del.mutateAsync(confirmDel.id);
              toast.success('Ubicación eliminada');
            } catch (e: any) {
              toast.error(e?.response?.data?.error ?? 'No se pudo eliminar');
            } finally {
              setConfirmDel(null);
            }
          }}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Usuarios
──────────────────────────────────────────────────────────────────────────── */

function UsersPanel() {
  const list = useUsers();
  const create = useCreateUser();
  const upd = useUpdateUser();
  const resetPwd = useResetPassword();

  const users = useMemo(() => {
    const d: any = list.data;

    if (Array.isArray(d)) return d;

    return d?.items ?? [];
  }, [list.data]);

  const [f, setF] = useState({
    documentId: '',
    email: '',
    name: '',
    role: 'INVENTARIO',
    password: '',
  });

  const [editing, setEditing] = useState<any | null>(null);

  const [changingPwd, setChangingPwd] = useState<{
    id: string;
    email?: string | null;
    documentId?: string | null;
  } | null>(null);

  const [newPwd, setNewPwd] = useState('');

  async function createUser(e: FormEvent) {
    e.preventDefault();

    if (!f.documentId.trim() || !f.name.trim() || !f.password.trim()) {
      return toast.error('Completa documento, nombre y contraseña');
    }

    try {
      await create.mutateAsync({
        documentId: f.documentId.trim(),
        email: f.email.trim() || undefined,
        name: f.name.trim(),
        role: f.role,
        password: f.password,
      } as any);

      toast.success('Usuario creado');

      setF({
        documentId: '',
        email: '',
        name: '',
        role: 'INVENTARIO',
        password: '',
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo crear');
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form
        onSubmit={createUser}
        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[#1B3859]">
            Nuevo usuario
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Crea cuentas de acceso y define el rol operativo del usuario.
          </p>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <FieldLabel required>Documento</FieldLabel>
            <input
              className={inputClass()}
              value={f.documentId}
              onChange={(e) =>
                setF({
                  ...f,
                  documentId: e.target.value,
                })
              }
              placeholder="Ej. 1095298077"
            />
          </div>

          <div className="grid gap-1.5">
            <FieldLabel>Correo</FieldLabel>
            <input
              type="email"
              className={inputClass()}
              value={f.email}
              onChange={(e) =>
                setF({
                  ...f,
                  email: e.target.value,
                })
              }
              placeholder="usuario@empresa.com"
            />
          </div>

          <div className="grid gap-1.5">
            <FieldLabel required>Nombre</FieldLabel>
            <input
              className={inputClass()}
              value={f.name}
              onChange={(e) =>
                setF({
                  ...f,
                  name: e.target.value,
                })
              }
              placeholder="Nombre y apellido"
            />
          </div>

          <div className="grid gap-1.5">
            <FieldLabel required>Rol</FieldLabel>
            <select
              className={inputClass()}
              value={f.role}
              onChange={(e) =>
                setF({
                  ...f,
                  role: e.target.value,
                })
              }
            >
              <option value="SUPER_ADMIN">SUPER ADMIN</option>
              <option value="ACTIVOS_FIJOS">ACTIVOS FIJOS</option>
              <option value="INVENTARIO">INVENTARIO</option>
              <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
              <option value="CONDUCTOR">CONDUCTOR</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </div>

          <div className="grid gap-1.5">
            <FieldLabel required>Contraseña</FieldLabel>
            <input
              type="password"
              className={inputClass()}
              value={f.password}
              onChange={(e) =>
                setF({
                  ...f,
                  password: e.target.value,
                })
              }
              placeholder="••••••••"
            />
          </div>

          <button disabled={create.isPending} className={buttonPrimaryClass()}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {create.isPending ? 'Guardando…' : 'Guardar usuario'}
          </button>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-[#1B3859]">
              Usuarios
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {users.length} registro(s)
            </p>
          </div>

          {list.isFetching && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )}
        </div>

        <div className="max-h-[72vh] space-y-3 overflow-auto p-4">
          {list.isLoading ? (
            <LoadingState label="Cargando usuarios…" />
          ) : users.length === 0 ? (
            <EmptyState label="Sin usuarios." />
          ) : (
            users.map((u: any) => (
              <article
                key={u.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#3C9CD1]/40"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold uppercase text-[#111827]">
                        {u.name || u.email || u.documentId}
                      </h3>

                      <span
                        className={[
                          'inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold',
                          roleBadgeClass(u.role),
                        ].join(' ')}
                      >
                        {roleLabel(u.role)}
                      </span>

                      <span
                        className={[
                          'inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold',
                          u.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-rose-200 bg-rose-50 text-rose-700',
                        ].join(' ')}
                      >
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Doc: {u.documentId ?? '—'}
                      {u.email ? ` · ${u.email}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={buttonSecondaryClass()}
                      onClick={() => setEditing(u)}
                    >
                      <Edit3 className="h-4 w-4" />
                      Editar
                    </button>

                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
                      onClick={() => {
                        setChangingPwd({
                          id: u.id,
                          email: u.email,
                          documentId: u.documentId,
                        });
                        setNewPwd('');
                      }}
                    >
                      <KeyRound className="h-4 w-4" />
                      Clave
                    </button>

                    {u.isActive ? (
                      <button
                        type="button"
                        className={buttonDangerClass()}
                        onClick={async () => {
                          await upd.mutateAsync({
                            id: u.id,
                            data: {
                              isActive: false,
                            },
                          });
                        }}
                      >
                        <CircleOff className="h-4 w-4" />
                        Desactivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        onClick={async () => {
                          await upd.mutateAsync({
                            id: u.id,
                            data: {
                              isActive: true,
                            },
                          });
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Reactivar
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {editing && (
        <Modal
          title="Editar usuario"
          onClose={() => setEditing(null)}
          maxWidth="max-w-md"
        >
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <FieldLabel>Documento</FieldLabel>
              <input
                className={inputClass()}
                value={editing.documentId || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    documentId: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-1.5">
              <FieldLabel>Correo</FieldLabel>
              <input
                type="email"
                className={inputClass()}
                value={editing.email || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    email: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-1.5">
              <FieldLabel>Nombre</FieldLabel>
              <input
                className={inputClass()}
                value={editing.name || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    name: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-1.5">
              <FieldLabel>Rol</FieldLabel>
              <select
                className={inputClass()}
                value={editing.role}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    role: e.target.value,
                  })
                }
              >
                <option value="SUPER_ADMIN">SUPER ADMIN</option>
                <option value="ACTIVOS_FIJOS">ACTIVOS FIJOS</option>
                <option value="INVENTARIO">INVENTARIO</option>
                <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
                <option value="CONDUCTOR">CONDUCTOR</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                className={buttonSecondaryClass()}
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={buttonPrimaryClass()}
                disabled={upd.isPending}
                onClick={async () => {
                  await upd.mutateAsync({
                    id: editing.id,
                    data: {
                      documentId: editing.documentId,
                      email: editing.email || undefined,
                      name: editing.name,
                      role: editing.role,
                    } as any,
                  });

                  setEditing(null);
                  toast.success('Usuario actualizado');
                }}
              >
                {upd.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {changingPwd && (
        <Modal
          title="Resetear contraseña"
          subtitle={
            changingPwd.documentId
              ? `Documento: ${changingPwd.documentId}`
              : changingPwd.email || 'Usuario sin identificación visible'
          }
          onClose={() => setChangingPwd(null)}
          maxWidth="max-w-md"
        >
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <FieldLabel required>Nueva contraseña</FieldLabel>
              <input
                type="password"
                className={inputClass()}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                className={buttonSecondaryClass()}
                onClick={() => setChangingPwd(null)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={resetPwd.isPending}
                onClick={async () => {
                  if (!newPwd.trim()) {
                    return toast.error('Escribe la nueva contraseña');
                  }

                  await resetPwd.mutateAsync({
                    id: changingPwd.id,
                    password: newPwd,
                  });

                  setChangingPwd(null);
                  toast.success('Contraseña actualizada');
                }}
              >
                {resetPwd.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Actualizar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
