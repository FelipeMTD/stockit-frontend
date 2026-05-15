'use client';

import { useEffect, useState } from 'react';

import { capsFor, normalizeRole, type AppRole, type Caps } from '@/lib/roles';

export type StoredAuthUser = {
  id: string;
  name: string;
  email?: string | null;
  documentId?: string | null;
  role: AppRole;
  isActive?: boolean;
};

export type StoredRbacSession = {
  token: string;
  role: AppRole;
  user: StoredAuthUser;
  caps: Caps;
};

const TOKEN_KEYS = [
  'access_token',
  'accessToken',
  'token',
  'auth_token',
  'jwt',
];

const USER_JSON_KEYS = [
  'user',
  'auth_user',
];

const ROLE_KEY = 'user_role';
const USER_NAME_KEY = 'user_name';
const USER_ID_KEY = 'user_id';

function isBrowser() {
  return typeof window !== 'undefined';
}

function safeGetLocalStorage(key: string): string | null {
  if (!isBrowser()) return null;

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string) {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignorar errores de localStorage.
  }
}

function safeRemoveLocalStorage(key: string) {
  if (!isBrowser()) return;

  try {
    localStorage.removeItem(key);
  } catch {
    // Ignorar errores de localStorage.
  }
}

function safeParseJson<T>(value: string | null): Partial<T> | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as Partial<T>;
  } catch {
    return null;
  }
}

function getFirstStoredValue(keys: string[]) {
  for (const key of keys) {
    const value = safeGetLocalStorage(key);

    if (value) {
      return value;
    }
  }

  return null;
}

function getStoredUserJson(): Partial<StoredAuthUser> | null {
  for (const key of USER_JSON_KEYS) {
    const raw = safeGetLocalStorage(key);
    const parsed = safeParseJson<StoredAuthUser>(raw);

    if (parsed) {
      return parsed;
    }
  }

  return null;
}

/**
 * Devuelve el token disponible en localStorage.
 *
 * La clave oficial del proyecto es access_token, pero se soportan claves
 * antiguas o usadas por tests para evitar inconsistencias temporales.
 */
export function getStoredAccessToken(): string | null {
  return getFirstStoredValue(TOKEN_KEYS);
}

/**
 * Devuelve el rol normalizado desde:
 * 1. user.role / auth_user.role
 * 2. user_role
 */
export function getStoredRole(): AppRole | null {
  const parsedUser = getStoredUserJson();

  const roleFromUser = normalizeRole(parsedUser?.role);
  if (roleFromUser) return roleFromUser;

  const roleFromKey = normalizeRole(safeGetLocalStorage(ROLE_KEY));
  if (roleFromKey) return roleFromKey;

  return null;
}

/**
 * Devuelve el usuario guardado en localStorage con rol normalizado.
 *
 * No valida contra backend. Solo lee la sesión local creada por /login.
 * La validación remota debe quedar en AppShell o en el backend.
 */
export function getStoredUser(): StoredAuthUser | null {
  const role = getStoredRole();

  if (!role) {
    return null;
  }

  const parsedUser = getStoredUserJson();

  const id =
    parsedUser?.id ||
    safeGetLocalStorage(USER_ID_KEY) ||
    'local-user';

  const name =
    parsedUser?.name ||
    safeGetLocalStorage(USER_NAME_KEY) ||
    parsedUser?.email ||
    'Usuario';

  return {
    id: String(id),
    name: String(name),
    email: parsedUser?.email ?? null,
    documentId: parsedUser?.documentId ?? null,
    role,
    isActive: parsedUser?.isActive ?? true,
  };
}

/**
 * Devuelve sesión RBAC local completa.
 *
 * Si falta token o rol válido, devuelve null.
 */
export function getStoredRbacSession(): StoredRbacSession | null {
  const token = getStoredAccessToken();
  const role = getStoredRole();
  const user = getStoredUser();

  if (!token || !role || !user) {
    return null;
  }

  return {
    token,
    role,
    user,
    caps: capsFor(role),
  };
}

export function getStoredCaps(): Caps {
  return capsFor(getStoredRole());
}

export function hasStoredRole(allowedRoles: AppRole[]): boolean {
  const role = getStoredRole();

  if (!role) {
    return false;
  }

  return allowedRoles.includes(role);
}

export function canStoredUser(predicate: (caps: Caps, role: AppRole | null) => boolean) {
  const role = getStoredRole();
  const caps = capsFor(role);

  return predicate(caps, role);
}

/**
 * Persiste sesión local después de login o después de /api/auth/me.
 *
 * No reemplaza el login. Solo centraliza cómo guardar la sesión.
 */
export function setStoredRbacSession(params: {
  token?: string | null;
  user?: {
    id?: string | number | null;
    name?: string | null;
    email?: string | null;
    documentId?: string | null;
    role?: string | null;
    isActive?: boolean;
  } | null;
}) {
  const { token, user } = params;

  if (token) {
    safeSetLocalStorage('access_token', token);
  }

  const role = normalizeRole(user?.role);

  if (role) {
    safeSetLocalStorage(ROLE_KEY, role);
  }

  if (user?.name) {
    safeSetLocalStorage(USER_NAME_KEY, String(user.name));
  }

  if (user?.id) {
    safeSetLocalStorage(USER_ID_KEY, String(user.id));
  }

  if (user && role) {
    const normalizedUser: StoredAuthUser = {
      id: String(user.id || 'local-user'),
      name: String(user.name || user.email || 'Usuario'),
      email: user.email ?? null,
      documentId: user.documentId ?? null,
      role,
      isActive: user.isActive ?? true,
    };

    safeSetLocalStorage('user', JSON.stringify(normalizedUser));
    safeSetLocalStorage('auth_user', JSON.stringify(normalizedUser));
  }

  notifyRbacSessionChanged();
}

export function clearStoredRbacSession() {
  for (const key of TOKEN_KEYS) {
    safeRemoveLocalStorage(key);
  }

  for (const key of USER_JSON_KEYS) {
    safeRemoveLocalStorage(key);
  }

  safeRemoveLocalStorage(ROLE_KEY);
  safeRemoveLocalStorage(USER_NAME_KEY);
  safeRemoveLocalStorage(USER_ID_KEY);

  notifyRbacSessionChanged();
}

export function notifyRbacSessionChanged() {
  if (!isBrowser()) return;

  try {
    window.dispatchEvent(new Event('rbac-session-changed'));
  } catch {
    // Ignorar errores.
  }
}

/**
 * Hook para páginas cliente.
 *
 * Uso típico:
 *
 * const { role, caps, user, loading } = useRbacSession();
 *
 * Las páginas deben usar caps para mostrar/ocultar acciones.
 */
export function useRbacSession() {
  const [session, setSession] = useState<StoredRbacSession | null>(() =>
    getStoredRbacSession(),
  );

  useEffect(() => {
    const refresh = () => {
      setSession(getStoredRbacSession());
    };

    refresh();

    window.addEventListener('storage', refresh);
    window.addEventListener('rbac-session-changed', refresh);

    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('rbac-session-changed', refresh);
    };
  }, []);

  const role = session?.role ?? null;

  return {
    session,
    token: session?.token ?? null,
    user: session?.user ?? null,
    role,
    caps: capsFor(role),
    isAuthenticated: Boolean(session?.token && session?.role),
  };
}