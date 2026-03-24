// src/lib/api.ts
import axios, { AxiosError } from 'axios';

/* ─────────────────────────────────────────────────────────────
   BASE
   - Usa NEXT_PUBLIC_API_URL (recomendado)
   - Soporta también NEXT_PUBLIC_API_BASE por compatibilidad
────────────────────────────────────────────────────────────── */
const rawBase = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE || // fallback
  'http://localhost:4000'
).trim();

// Quitamos slashes del final, para evitar // o /api/api
const baseURL = rawBase.replace(/\/+$/, '');

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  // Si en algún momento usas cookies:
  withCredentials: true,
});

/* ─────────────────────────────────────────────────────────────
   ACCESS TOKEN + USER helpers (localStorage)
────────────────────────────────────────────────────────────── */
const ACCESS_KEY = 'access_token';
const USER_ROLE_KEY = 'user_role';
const USER_NAME_KEY = 'user_name';
const USER_ID_KEY = 'user_id';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null) {
  if (!isBrowser()) return;
  try {
    if (token) localStorage.setItem(ACCESS_KEY, token);
    else localStorage.removeItem(ACCESS_KEY);
  } catch {
    // ignoramos errores de localStorage (modo incógnito, etc.)
  }
}

export function setAuthUserInfo(user: AuthUser | null) {
  if (!isBrowser()) return;
  try {
    if (user?.role) localStorage.setItem(USER_ROLE_KEY, String(user.role));
    else localStorage.removeItem(USER_ROLE_KEY);

    if (user?.name) localStorage.setItem(USER_NAME_KEY, String(user.name));
    else localStorage.removeItem(USER_NAME_KEY);

    if (user?.id) localStorage.setItem(USER_ID_KEY, String(user.id));
    else localStorage.removeItem(USER_ID_KEY);
  } catch {
    // ignoramos errores
  }
}

export function clearAuthStorage() {
  setAccessToken(null);
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(USER_ROLE_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    localStorage.removeItem(USER_ID_KEY);
  } catch {
    // ignoramos
  }
}

/* ─────────────────────────────────────────────────────────────
   REQUEST: inyecta Authorization: Bearer <token>
────────────────────────────────────────────────────────────── */
api.interceptors.request.use((config) => {
  const t = getAccessToken();
  if (t) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${t}`;
  }
  return config;
});

/* ─────────────────────────────────────────────────────────────
   RESPONSE:
   - Si llega un 401/403, limpia token y redirige a /login
────────────────────────────────────────────────────────────── */
let redirectingToLogin = false;

function redirectToLogin() {
  if (!isBrowser()) return;

  // Limpia token + info de usuario
  clearAuthStorage();

  // Evitamos bucles infinitos
  if (!redirectingToLogin && !window.location.pathname.startsWith('/login')) {
    redirectingToLogin = true;
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      // Token inválido/expirado o sin permisos → fuera
      redirectToLogin();
    }

    throw error;
  }
);

/* ─────────────────────────────────────────────────────────────
   TIPOS DE USUARIO AUTENTICADO
────────────────────────────────────────────────────────────── */
export type AuthUser = {
  id: string;          // en tu BD es string (UUID/ULID)
  name: string;
  email?: string;
  documentId?: string;
  role?: string;
};

/* ─────────────────────────────────────────────────────────────
   Helpers para login/logout en UI
────────────────────────────────────────────────────────────── */
export async function authLoginByDocument(documentId: string, password: string) {
  const { data } = await api.post<{ accessToken: string; user: AuthUser }>(
    '/api/auth/login',
    { documentId, password }
  );

  if (data?.accessToken) {
    setAccessToken(data.accessToken);
  }

  if (data?.user) {
    setAuthUserInfo(data.user);
  }

  return data;
}

export async function authLogout() {
  try {
    // opcional: si tienes endpoint de logout en backend
    await api.post('/api/auth/logout');
  } catch {
    // ignoramos errores aquí
  } finally {
    clearAuthStorage();
    redirectToLogin();
  }
}

/* ─────────────────────────────────────────────────────────────
   INTERFACES DE DATOS (Agregadas para resolver errores)
────────────────────────────────────────────────────────────── */
export interface Asset {
  id: string;
  tag: string;
  name: string;
  status: string;
  serial?: string;
  currentCustodian?: {
    fullName: string;
    documentId?: string;
  };
  currentLocation?: {
    name: string;
  };
  currentLocationLabel?: string;
  site?: {
    name: string;
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}