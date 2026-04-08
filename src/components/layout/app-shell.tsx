// src/lib/api.ts
import axios, { AxiosError } from 'axios';

/* ─────────────────────────────────────────────────────────────
   BASE
────────────────────────────────────────────────────────────── */
const rawBase = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://localhost:4000'
).trim();

const baseURL = rawBase.replace(/\/+$/, '');

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

/* ─────────────────────────────────────────────────────────────
   ACCESS TOKEN + USER helpers
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
  try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
}

export function setAccessToken(token: string | null) {
  if (!isBrowser()) return;
  try {
    if (token) localStorage.setItem(ACCESS_KEY, token);
    else localStorage.removeItem(ACCESS_KEY);
  } catch {}
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
  } catch {}
}

export function clearAuthStorage() {
  setAccessToken(null);
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(USER_ROLE_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    localStorage.removeItem(USER_ID_KEY);
  } catch {}
}

/* ─────────────────────────────────────────────────────────────
   REQUEST: inyecta Authorization
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
   RESPONSE: Interceptor corregido
────────────────────────────────────────────────────────────── */
let redirectingToLogin = false;

function redirectToLogin() {
  if (!isBrowser()) return;
  clearAuthStorage();
  if (!redirectingToLogin && !window.location.pathname.startsWith('/login')) {
    redirectingToLogin = true;
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status;

    // ✅ CORRECCIÓN DEFINITIVA: Solo debe decir 401 (No Autorizado / Token Vencido)
    if (status === 401) {
      redirectToLogin();
    }

    throw error;
  }
);

export type AuthUser = {
  id: string;
  name: string;
  email?: string;
  documentId?: string;
  role?: string;
};

export async function authLoginByDocument(documentId: string, password: string) {
  const { data } = await api.post<{ accessToken: string; user: AuthUser }>(
    '/api/auth/login',
    { documentId, password }
  );
  if (data?.accessToken) setAccessToken(data.accessToken);
  if (data?.user) setAuthUserInfo(data.user);
  return data;
}

export async function authLogout() {
  try { await api.post('/api/auth/logout'); } catch {} 
  finally {
    clearAuthStorage();
    redirectToLogin();
  }
}

export interface Asset {
  id: string; tag: string; name: string; status: string; serial?: string;
  currentCustodian?: { fullName: string; documentId?: string; };
  currentLocation?: { name: string; }; currentLocationLabel?: string;
  site?: { name: string; };
}

export interface Paginated<T> {
  items: T[]; total: number; page: number; pageSize: number; pageCount: number;
}