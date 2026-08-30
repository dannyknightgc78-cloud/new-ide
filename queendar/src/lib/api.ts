import type { IceCard } from './emergency';

export type QueenUser = {
  id?: string;
  username: string;
  email?: string;
  premium?: string;
  isPlus?: boolean;
  bio?: string;
  avatar_url?: string;
  token?: string;
  ice?: IceCard;
};

export type CrownLogEntry = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  mood: string;
  location: string;
  created_at: string;
  encrypted?: boolean;
};

const USER_KEY = 'queendar_owner';
const TOKEN_KEY = 'queendar_token';

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || getUser()?.id || '';
}

export function getUser(): QueenUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as QueenUser;
    return saved?.username ? saved : null;
  } catch {
    return null;
  }
}

export function setSession(user: QueenUser, token?: string) {
  const t = token || user.token || getToken();
  if (t) localStorage.setItem(TOKEN_KEY, t);
  const stored = { ...user };
  delete stored.token;
  localStorage.setItem(USER_KEY, JSON.stringify(stored));
}

export function clearSession() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = Record<string, unknown>>(
  path: string,
  opts: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 20000, headers, ...rest } = opts;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  const token = getToken();
  const res = await fetch(path, {
    ...rest,
    signal: ctrl.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  window.clearTimeout(timer);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
