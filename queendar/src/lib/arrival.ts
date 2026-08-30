import { api } from './api';
import { emergencyFor, type EmergencyInfo } from './emergency';

export const GPS_KEY = 'queendar_last_gps';
export const PACK_KEY = 'queendar_local_pack';
export const ISO_KEY = 'queendar_arrival_iso';

export type LocalPack = {
  lat: number;
  lng: number;
  at: number;
  iso: string | null;
  country: string;
  primary: string;
  call: string;
  place: string;
  city: string;
  tips: string[];
  blurb: string;
  emergency: EmergencyInfo;
  arrived: boolean;
};

type RadarPayload = {
  nearestHood?: { name?: string; city?: string; tips?: string[]; blurb?: string };
  localTips?: string[];
  emergency?: EmergencyInfo;
};

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function loadPack(): LocalPack | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PACK_KEY) || 'null');
    if (raw && typeof raw.lat === 'number' && typeof raw.lng === 'number') return raw as LocalPack;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveGps(lat: number, lng: number) {
  localStorage.setItem(GPS_KEY, JSON.stringify({ lat, lng }));
}

function savePack(pack: LocalPack) {
  localStorage.setItem(PACK_KEY, JSON.stringify(pack));
  window.dispatchEvent(new CustomEvent('queendar-pack', { detail: pack }));
}

function offlinePack(lat: number, lng: number, prev?: LocalPack | null): LocalPack {
  const em = emergencyFor(lat, lng);
  const lastIso = localStorage.getItem(ISO_KEY);
  const arrived = Boolean(em.iso && em.iso !== lastIso);
  if (em.iso) localStorage.setItem(ISO_KEY, em.iso);
  return {
    lat,
    lng,
    at: Date.now(),
    iso: em.iso,
    country: em.country,
    primary: em.primary,
    call: em.call || 'Call',
    place: prev?.place || '',
    city: prev?.city || '',
    tips: prev?.tips || [],
    blurb: prev?.blurb || '',
    emergency: em,
    arrived,
  };
}

async function enrich(pack: LocalPack): Promise<LocalPack> {
  try {
    const data = await api<RadarPayload>(`/api/radar?lat=${pack.lat}&lng=${pack.lng}`, { timeoutMs: 8000 });
    const hood = data.nearestHood;
    const em = data.emergency || pack.emergency;
    return {
      ...pack,
      iso: em.iso ?? pack.iso,
      country: em.country || pack.country,
      primary: em.primary || pack.primary,
      call: em.call || pack.call,
      place: hood?.name || pack.place,
      city: hood?.city || pack.city,
      tips: hood?.tips || data.localTips || pack.tips,
      blurb: hood?.blurb || pack.blurb,
      emergency: em,
    };
  } catch {
    return pack;
  }
}

export function localHint(pack: LocalPack | null): string {
  if (!pack) return 'Stay aware, not alarmed. Enable GPS so RTX can pull this area.';
  const bits = [pack.place, pack.tips[0], `${pack.call} ${pack.primary} in ${pack.country}.`].filter(Boolean);
  return bits.join(' ');
}

let watchId: number | null = null;
const listeners = new Set<(pack: LocalPack) => void>();

function emit(pack: LocalPack) {
  savePack(pack);
  listeners.forEach((fn) => fn(pack));
}

async function apply(lat: number, lng: number) {
  saveGps(lat, lng);
  const prev = loadPack();
  const stale = !prev || km(prev, { lat, lng }) > 1.5 || Date.now() - prev.at > 30 * 60 * 1000;
  const base = offlinePack(lat, lng, prev);
  if (!stale && prev) {
    emit({ ...prev, lat, lng, at: Date.now(), arrived: base.arrived });
    return;
  }
  emit(base);
  emit(await enrich(base));
}

export function watchArrival(onPack?: (pack: LocalPack) => void): () => void {
  if (onPack) {
    listeners.add(onPack);
    const cached = loadPack();
    if (cached) onPack(cached);
  }

  if (watchId == null && navigator.geolocation) {
    try {
      const raw = JSON.parse(localStorage.getItem(GPS_KEY) || 'null');
      if (raw?.lat != null) apply(raw.lat, raw.lng);
    } catch {
      /* ignore */
    }
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        apply(pos.coords.latitude, pos.coords.longitude);
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }

  return () => {
    if (onPack) listeners.delete(onPack);
  };
}
