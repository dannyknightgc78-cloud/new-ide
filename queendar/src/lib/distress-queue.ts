import { api } from './api';

export const RETRY_MS = 20000;
const QUEUE_KEY = 'queendar_distress_queue';

let nextRetry = 0;

export function nextRetryAt() {
  return nextRetry;
}

function markRetry() {
  nextRetry = Date.now() + RETRY_MS;
  window.dispatchEvent(new CustomEvent('queendar-retry', { detail: nextRetry }));
}

export type DistressItem = {
  id: string;
  at: number;
  lat?: number;
  lng?: number;
  message: string;
  guest?: boolean;
};

const listeners = new Set<(items: DistressItem[]) => void>();

function load(): DistressItem[] {
  try {
    const rows = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(items: DistressItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-20)));
  listeners.forEach((fn) => fn(load()));
  window.dispatchEvent(new CustomEvent('queendar-queue', { detail: load() }));
}

export function queuedDistress(): DistressItem[] {
  return load();
}

export function enqueueDistress(item: Omit<DistressItem, 'id' | 'at'> & { id?: string; at?: number }) {
  const next: DistressItem = {
    id: item.id || crypto.randomUUID(),
    at: item.at || Date.now(),
    lat: item.lat,
    lng: item.lng,
    message: item.message,
    guest: item.guest,
  };
  const rest = load().filter((row) => row.message !== next.message);
  save([...rest, next]);
  markRetry();
  return next;
}

export function dropDistress(id: string) {
  save(load().filter((row) => row.id !== id));
}

export function subscribeQueue(fn: (items: DistressItem[]) => void) {
  listeners.add(fn);
  fn(load());
  return () => listeners.delete(fn);
}

let flushing = false;

export async function flushDistressQueue() {
  if (flushing) return { sent: 0, left: load().length };
  if (!navigator.onLine) {
    markRetry();
    return { sent: 0, left: load().length };
  }
  flushing = true;
  let sent = 0;
  try {
    for (const item of load()) {
      if (item.guest) {
        dropDistress(item.id);
        continue;
      }
      try {
        await api('/api/sos', {
          method: 'POST',
          timeoutMs: 12000,
          body: JSON.stringify({ lat: item.lat, lng: item.lng, kind: 'sos', message: item.message }),
        });
        dropDistress(item.id);
        sent += 1;
      } catch {
        break;
      }
    }
  } finally {
    flushing = false;
    if (load().length) markRetry();
    else nextRetry = 0;
  }
  return { sent, left: load().length };
}

export function startDistressFlush() {
  const kick = () => {
    flushDistressQueue().catch(() => undefined);
  };
  const onVis = () => {
    if (document.visibilityState === 'visible') kick();
  };
  window.addEventListener('online', kick);
  document.addEventListener('visibilitychange', onVis);
  kick();
  const id = window.setInterval(kick, RETRY_MS);
  return () => {
    window.removeEventListener('online', kick);
    document.removeEventListener('visibilitychange', onVis);
    window.clearInterval(id);
  };
}
