import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Shield, TrendingUp, ChevronDown, Loader2, Phone, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { emergencyFor, type EmergencyInfo } from '../lib/emergency';
import AwarenessCoach from './AwarenessCoach';
import SafeHavens, { type Haven } from './SafeHavens';

type Hood = {
  name: string;
  city: string;
  country: string;
  safetyScore: number;
  distanceKm?: number | null;
  blurb: string;
  tags: string[];
  lat: number;
  lng: number;
  tips?: string[];
};

type City = {
  name: string;
  country: string;
  safetyScore: number;
  trend: string;
  distanceKm?: number | null;
  lat: number;
  lng: number;
  neighborhoods: Hood[];
};

type Incident = {
  id: string;
  kind: string;
  label: string;
  note: string;
  lat: number;
  lng: number;
  confirms: number;
  status?: 'unverified' | 'confirmed';
  created_at: string;
  distanceKm?: number | null;
};

const REPORT_KINDS: { id: string; label: string }[] = [
  { id: 'protest', label: 'Protest' },
  { id: 'transit', label: 'Transit' },
  { id: 'violence', label: 'Violence' },
  { id: 'hazard', label: 'Hazard' },
  { id: 'police', label: 'Police' },
  { id: 'other', label: 'Other' },
];

function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

function gaugeColor(score: number) {
  return score >= 85 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
}

export default function VibeRadar({ guest }: { guest?: boolean }) {
  const [cities, setCities] = useState<City[]>([]);
  const [nearest, setNearest] = useState<City | null>(null);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [gps, setGps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>('Las Palmas');
  const [emergency, setEmergency] = useState<EmergencyInfo>(emergencyFor());
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [hood, setHood] = useState<{ name: string; tips?: string[]; blurb?: string } | null>(null);
  const [havens, setHavens] = useState<Haven[]>([]);
  const [kind, setKind] = useState('hazard');
  const [note, setNote] = useState('');
  const [reportMsg, setReportMsg] = useState('');
  const [posting, setPosting] = useState(false);
  const hereRef = useRef(here);
  hereRef.current = here;

  const load = async (lat?: number, lng?: number) => {
    const q = lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : '';
    const data = await api<{
      cities: City[];
      nearest: City | null;
      gps: boolean;
      here?: { lat: number; lng: number };
      emergency?: EmergencyInfo;
      incidents?: Incident[];
      nearestHood?: { name: string; tips?: string[]; blurb?: string } | null;
      localTips?: string[];
      havens?: Haven[];
    }>(`/api/radar${q}`);
    setCities(data.cities || []);
    setNearest(data.nearest || null);
    setGps(Boolean(data.gps));
    if (data.here?.lat != null) setHere(data.here);
    if (data.nearest?.name) setOpen(data.nearest.name);
    if (data.emergency) setEmergency(data.emergency);
    else if (lat != null && lng != null) setEmergency(emergencyFor(lat, lng));
    setIncidents(data.incidents || []);
    if (data.havens) setHavens(data.havens);
    if (lat != null && lng != null) {
      api<{ havens?: Haven[] }>(`/api/havens?lat=${lat}&lng=${lng}`, { timeoutMs: 16000 })
        .then((h) => { if (h.havens?.length) setHavens(h.havens); })
        .catch(() => undefined);
    }
    if (data.nearestHood) setHood(data.nearestHood);
    else if (data.localTips?.length) setHood({ name: data.nearest?.name || '', tips: data.localTips });
  };

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        await load();
        if (!navigator.geolocation) {
          setLoading(false);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (dead) return;
            try {
              await load(pos.coords.latitude, pos.coords.longitude);
            } catch {
              setErr('Radar loaded without live GPS.');
            }
            setLoading(false);
          },
          () => {
            if (!dead) setLoading(false);
          },
          { enableHighAccuracy: true, timeout: 10000 },
        );
      } catch {
        setErr('Could not load radar.');
        setLoading(false);
      }
    })();
    const tick = window.setInterval(() => {
      const h = hereRef.current;
      if (h) load(h.lat, h.lng).catch(() => undefined);
    }, 60000);
    return () => {
      dead = true;
      window.clearInterval(tick);
    };
  }, []);

  const locate = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await load(pos.coords.latitude, pos.coords.longitude);
        } finally {
          setLoading(false);
        }
      },
      () => setLoading(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const pin = nearest || cities[0];
  const mapSrc = pin
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${pin.lng - 0.08}%2C${pin.lat - 0.06}%2C${pin.lng + 0.08}%2C${pin.lat + 0.06}&layer=mapnik&marker=${pin.lat}%2C${pin.lng}`
    : '';

  const postAlert = async () => {
    if (guest) {
      setReportMsg('Sign in to post a live alert.');
      return;
    }
    if (!here) {
      setReportMsg('Enable GPS so other travelers see where this is.');
      return;
    }
    setPosting(true);
    try {
      await api('/api/incidents', { method: 'POST', body: JSON.stringify({ kind, note, lat: here.lat, lng: here.lng }) });
      setNote('');
      setReportMsg('Alert posted for travelers nearby. It expires in 12 hours.');
      await load(here.lat, here.lng);
    } catch (e) {
      setReportMsg(e instanceof Error ? e.message : 'Could not post alert.');
    } finally {
      setPosting(false);
    }
  };

  const confirmAlert = async (id: string) => {
    if (guest) {
      setReportMsg('Sign in to confirm an alert.');
      return;
    }
    try {
      const data = await api<{ incident?: Incident; already?: boolean }>(`/api/incidents/${id}/confirm`, { method: 'POST' });
      if (data.incident) {
        setIncidents((list) => list.map((item) => (item.id === id ? { ...item, ...data.incident } : item)));
      }
    } catch (e) {
      setReportMsg(e instanceof Error ? e.message : 'Could not confirm.');
    }
  };

  return (
    <div className="pb-8">
      <div className="px-4 pt-2 pb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Vibe Radar</h2>
          <p className="text-[#555555] text-sm mt-0.5">
            {gps && here ? 'Live GPS · scores update with time of day and your scans' : 'Allow location for live neighbourhood scores'}
          </p>
        </div>
        <button onClick={locate} className="text-[#c9a84c] bg-[#111] border border-[#222] rounded-xl p-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
        </button>
      </div>
      {err && <p className="px-4 text-xs text-red-400 mb-2">{err}</p>}
      {emergency.primary && (
        <a
          href={`tel:${emergency.primary}`}
          className="mx-4 mb-3 flex items-center justify-between rounded-2xl bg-red-950/40 border border-red-800/50 px-4 py-3"
        >
          <div>
            <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Local emergency</p>
            <p className="text-white font-bold text-sm">{emergency.call || 'Call'} {emergency.primary} · {emergency.country}</p>
          </div>
          <Phone className="w-4 h-4 text-red-400" />
        </a>
      )}
      <AwarenessCoach guest={guest} here={here} city={hood?.name || nearest?.name || cities[0]?.name} tips={hood?.tips} incidents={incidents} />
      {havens.length > 0 && (
        <div className="mx-4 mb-3 bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl p-4">
          <SafeHavens havens={havens} />
        </div>
      )}
      <div className="mx-4 mb-3 bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#c9a84c] font-bold">Live traveler alerts</p>
          <p className="text-white font-bold text-sm">What is happening around you</p>
          <p className="text-[11px] text-[#666] mt-0.5">Traveler reports. Unverified until someone else confirms. Location is fuzzed. Expires in 12 hours.</p>
        </div>
        {incidents.length === 0 && <p className="text-xs text-[#555]">No live alerts nearby. If you see something, post it for other travelers.</p>}
        {incidents.map((item) => {
          const confirmed = item.status === 'confirmed' || item.confirms >= 2;
          return (
          <div key={item.id} className={`rounded-xl px-3 py-2.5 border ${confirmed ? 'bg-[#14120c] border-[#c9a84c]/40' : 'bg-[#111] border-[#222] opacity-90'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-white text-sm font-bold truncate">{item.label}</p>
                <p className="text-[11px] text-[#777]">
                  {confirmed ? 'Confirmed' : 'Unverified'} · {item.distanceKm != null ? `${item.distanceKm} km` : 'Nearby'} · {ago(item.created_at)} · {item.confirms} traveler{item.confirms === 1 ? '' : 's'}
                </p>
                {item.note && <p className="text-xs text-[#aaa] mt-1">{item.note}</p>}
              </div>
              <button onClick={() => confirmAlert(item.id)} className="text-[11px] font-bold text-[#c9a84c] bg-[#1a1a1a] border border-[#333] rounded-lg px-2 py-1 flex-shrink-0">
                Confirm
              </button>
            </div>
          </div>
          );
        })}
        <div className="flex flex-wrap gap-1.5">
          {REPORT_KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border ${kind === k.id ? 'bg-[#7c3aed]/20 border-[#7c3aed] text-white' : 'border-[#222] text-[#888]'}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" className="flex-1 bg-[#111] border border-[#272727] rounded-xl px-3 py-2 text-sm text-white" />
          <button onClick={postAlert} disabled={posting} className="bg-red-700 text-white rounded-xl px-3 text-xs font-bold flex items-center gap-1 disabled:opacity-50">
            {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            Report
          </button>
        </div>
        {reportMsg && <p className="text-[11px] text-[#c9a84c]">{reportMsg}</p>}
      </div>
      {mapSrc && (
        <div className="mx-4 mb-4 rounded-2xl overflow-hidden border border-[#1c1c1c] h-44">
          <iframe title="radar map" src={mapSrc} className="w-full h-full grayscale-[0.3] contrast-125" />
        </div>
      )}
      {nearest && gps && (
        <div className="mx-4 mb-3 bg-[#7c3aed]/10 border border-[#7c3aed]/30 rounded-2xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-[#9d5cf5] font-bold">Nearest</p>
          <p className="text-white font-bold">{nearest.name} · {nearest.safetyScore}/100</p>
          <p className="text-xs text-[#888]">{nearest.distanceKm != null ? `${nearest.distanceKm} km away` : nearest.country}</p>
        </div>
      )}
      <div className="space-y-3 px-4">
        {cities.map((city) => (
          <div key={city.name} className="bg-[#0e0e0e] rounded-2xl border border-[#1c1c1c] overflow-hidden">
            <button onClick={() => setOpen(open === city.name ? null : city.name)} className="w-full flex items-center justify-between px-4 py-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#141414] border border-[#1e1e1e] flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-[#c9a84c]" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{city.name}</p>
                  <p className="text-[#555] text-xs">
                    {city.country}
                    {city.distanceKm != null ? ` · ${city.distanceKm} km` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {city.trend === 'up' && (
                  <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3" />LIVE</span>
                )}
                <span className="font-black tabular-nums" style={{ color: gaugeColor(city.safetyScore) }}>{city.safetyScore}</span>
                <ChevronDown className={`w-4 h-4 text-[#444] ${open === city.name ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {open === city.name && (
              <div className="border-t border-[#1c1c1c] px-3 py-3 space-y-2">
                {city.neighborhoods.map((hood) => (
                  <div key={hood.name} className="bg-[#0a0a0a] border border-[#181818] rounded-xl px-4 py-3">
                    <div className="flex justify-between gap-2">
                      <p className="text-white text-sm font-bold">{hood.name}</p>
                      <span className="text-xs font-bold" style={{ color: gaugeColor(hood.safetyScore) }}>{hood.safetyScore}</span>
                    </div>
                    <p className="text-[#555] text-xs mt-1">{hood.blurb}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(hood.tags || []).map((tag) => (
                        <span key={tag} className="text-[11px] px-2 py-1 rounded-lg bg-[#111] border border-[#222] text-[#888]">{tag}</span>
                      ))}
                    </div>
                    <a
                      className="inline-flex items-center gap-1 text-[11px] text-[#c9a84c] mt-2"
                      href={`https://maps.google.com/?q=${hood.lat},${hood.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Shield className="w-3 h-3" /> Open map
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
