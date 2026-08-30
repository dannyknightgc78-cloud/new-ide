import { api } from './api';
import { emergencyFor, iceSummary, loadLocalIce, type IceCard } from './emergency';
import { GPS_KEY, loadPack } from './arrival';
import { dropDistress, enqueueDistress, flushDistressQueue } from './distress-queue';

export type WatchContact = { name: string; phone: string };

function gps() {
  const pack = loadPack();
  if (pack) return { lat: pack.lat, lng: pack.lng };
  try {
    const raw = JSON.parse(localStorage.getItem(GPS_KEY) || 'null');
    if (raw?.lat != null) return { lat: Number(raw.lat), lng: Number(raw.lng) };
  } catch {
    /* ignore */
  }
  return {} as { lat?: number; lng?: number };
}

export function loadContacts(): WatchContact[] {
  try {
    const rows = JSON.parse(localStorage.getItem('queendar_contacts') || localStorage.getItem('queendar_contacts_cache') || '[]');
    return Array.isArray(rows) ? rows.filter((c) => c?.phone) : [];
  } catch {
    return [];
  }
}

export async function cacheContacts(guest?: boolean) {
  if (guest) return loadContacts();
  try {
    const data = await api<{ contacts: WatchContact[] }>('/api/contacts');
    const rows = (data.contacts || []).filter((c) => c.phone);
    localStorage.setItem('queendar_contacts_cache', JSON.stringify(rows));
    return rows;
  } catch {
    return loadContacts();
  }
}

function smsHref(phone: string, body: string) {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const sep = ios ? '&' : '?';
  return `sms:${phone.replace(/\s/g, '')}${sep}body=${encodeURIComponent(body)}`;
}

export function haptic(pattern: number | number[] = [35, 40, 35]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* iOS often blocks */
  }
}

export async function silentSos(opts: {
  reason: 'timer' | 'tap' | 'flip';
  ice?: IceCard;
  guest?: boolean;
  skipDeviceSms?: boolean;
}) {
  haptic(opts.reason === 'timer' ? [40, 80, 40] : 25);
  const point = gps();
  const em = emergencyFor(point.lat, point.lng);
  const ice = opts.ice || loadLocalIce();
  const maps = point.lat != null ? `https://maps.google.com/?q=${point.lat},${point.lng}` : '';
  const why = opts.reason === 'timer' ? 'Check-in timer ended — please check on me.' : 'I need help. This is silent from my phone.';
  const message = ['QUEENDAR SOS — I need help.', why, maps, `Local emergency ${em.primary} (${em.country})`, iceSummary(ice)].filter(Boolean).join(' ');
  let queued = false;
  if (!opts.guest) {
    const item = enqueueDistress({ lat: point.lat, lng: point.lng, message });
    try {
      await api('/api/sos', { method: 'POST', timeoutMs: 8000, body: JSON.stringify({ ...point, kind: 'sos', message }) });
      dropDistress(item.id);
      flushDistressQueue().catch(() => undefined);
    } catch {
      queued = true;
    }
  }
  await navigator.clipboard?.writeText(message).catch(() => undefined);
  const phone = loadContacts().find((c) => c.phone)?.phone;
  if (phone && !opts.skipDeviceSms) {
    window.location.href = smsHref(phone, message);
  }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const body = opts.skipDeviceSms
        ? 'Quiet timer ended. A check-in ping was sent from QueenDar.'
        : phone
          ? 'Silent SOS draft is ready to send.'
          : 'SOS copied. Add a trusted contact on SOS.';
      new Notification('QueenDar', { body, silent: true });
    }
  } catch {
    /* ignore */
  }
  return { message, phone: Boolean(phone), queued };
}
