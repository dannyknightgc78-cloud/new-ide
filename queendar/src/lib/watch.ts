import { api } from './api';
import { loadPack } from './arrival';

export const WATCH_KEY = 'queendar_watch_until';

const listeners = new Set<(until: number | null) => void>();

export function remain(until: number) {
  const ms = Math.max(0, until - Date.now());
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function getWatchUntil(): number | null {
  const n = Number(localStorage.getItem(WATCH_KEY) || 0);
  return n > Date.now() ? n : null;
}

function emit(until: number | null) {
  listeners.forEach((fn) => fn(until));
  window.dispatchEvent(new CustomEvent('queendar-watch', { detail: until }));
}

function point() {
  const pack = loadPack();
  return pack ? { lat: pack.lat, lng: pack.lng } : {};
}

function armServer(until: number) {
  api('/api/watch', { method: 'POST', body: JSON.stringify({ until, ...point() }) }).catch(() => undefined);
}

export function setWatch(msFromNow: number) {
  const until = Date.now() + msFromNow;
  localStorage.setItem(WATCH_KEY, String(until));
  localStorage.removeItem('queendar_watch_fired');
  emit(until);
  armServer(until);
  return until;
}

export function clearWatch() {
  localStorage.removeItem(WATCH_KEY);
  localStorage.removeItem('queendar_watch_fired');
  emit(null);
  api('/api/watch/clear', { method: 'POST', body: '{}' }).catch(() => undefined);
}

export function extendWatch(ms: number) {
  const cur = getWatchUntil() || Date.now();
  return setWatch(Math.max(0, cur - Date.now()) + ms);
}

export function subscribeWatch(fn: (until: number | null) => void) {
  listeners.add(fn);
  fn(getWatchUntil());
  return () => {
    listeners.delete(fn);
  };
}

export function openFlip() {
  window.dispatchEvent(new CustomEvent('queendar-flip'));
}

export type ExpireKind = 'device' | 'backend';

export function startWatchGuard(onExpire: (kind: ExpireKind) => void) {
  const fire = (kind: ExpireKind) => {
    if (localStorage.getItem('queendar_watch_fired')) return;
    localStorage.setItem('queendar_watch_fired', '1');
    localStorage.removeItem(WATCH_KEY);
    emit(null);
    if (kind === 'device') {
      api('/api/watch/ack', { method: 'POST', body: '{}' }).catch(() => undefined);
    }
    onExpire(kind);
    openFlip();
  };

  const tick = () => {
    const until = Number(localStorage.getItem(WATCH_KEY) || 0);
    if (until && Date.now() >= until) fire('device');
  };

  const sync = async () => {
    tick();
    try {
      const data = await api<{ pending?: boolean; watch?: { status?: string } }>('/api/watch');
      if (data.watch?.status === 'fired_backend') {
        fire('backend');
        return;
      }
      if (data.pending) {
        fire('device');
      }
    } catch {
      /* guest or offline */
    }
  };

  const id = window.setInterval(tick, 1000);
  const onVis = () => {
    if (document.visibilityState === 'visible') sync();
  };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('focus', sync);
  sync();
  return () => {
    window.clearInterval(id);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('focus', sync);
  };
}
