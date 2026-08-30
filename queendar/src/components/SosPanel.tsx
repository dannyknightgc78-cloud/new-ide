import { useEffect, useState } from 'react';
import { AlertTriangle, Check, HeartPulse, Loader2, MapPin, Phone, Plus, Shield, Trash2 } from 'lucide-react';
import { api, setSession, type QueenUser } from '../lib/api';
import { AID_NOTICE } from '../lib/disclaimer';
import {
  emergencyFor,
  iceFilled,
  iceSummary,
  loadLocalIce,
  normalizeIce,
  saveLocalIce,
  type EmergencyInfo,
  type IceCard,
} from '../lib/emergency';
import GpsCard from './GpsCard';
import { enqueueDistress, dropDistress } from '../lib/distress-queue';

type Contact = { id: string; name: string; phone: string; note?: string };
type Checkin = { id: string; kind: string; message: string; created_at: string; lat?: number; lng?: number };

type Props = { guest?: boolean; owner?: QueenUser; onUser?: (user: QueenUser) => void };

export default function SosPanel({ guest, owner, onUser }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [here, setHere] = useState<{ lat?: number; lng?: number }>({});
  const [emergency, setEmergency] = useState<EmergencyInfo>(emergencyFor());
  const [ice, setIce] = useState<IceCard>(guest ? loadLocalIce() : normalizeIce(owner?.ice));
  const [iceOpen, setIceOpen] = useState(!iceFilled(guest ? loadLocalIce() : normalizeIce(owner?.ice)));
  const [iceMsg, setIceMsg] = useState('');

  const load = async () => {
    if (guest) {
      try {
        setContacts(JSON.parse(localStorage.getItem('queendar_contacts') || '[]'));
      } catch {
        setContacts([]);
      }
      return;
    }
    try {
      const [c, k] = await Promise.all([api<{ contacts: Contact[] }>('/api/contacts'), api<{ checkins: Checkin[] }>('/api/checkins')]);
      setContacts(c.contacts || []);
      setCheckins(k.checkins || []);
    } catch {
      /* guest-like fallback */
    }
  };

  useEffect(() => {
    load();
  }, [guest]);

  useEffect(() => {
    if (!guest) setIce(normalizeIce(owner?.ice));
  }, [guest, owner?.ice]);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('queendar_last_gps') || 'null');
      if (cached?.lat != null) {
        setHere({ lat: cached.lat, lng: cached.lng });
        setEmergency(emergencyFor(cached.lat, cached.lng));
      }
    } catch {
      /* ignore */
    }
    if (!navigator.geolocation) {
      setEmergency((prev) => prev.gps ? prev : emergencyFor());
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setHere({ lat, lng });
        localStorage.setItem('queendar_last_gps', JSON.stringify({ lat, lng }));
        const local = emergencyFor(lat, lng);
        setEmergency(local);
        api<EmergencyInfo>(`/api/emergency?lat=${lat}&lng=${lng}`).then(setEmergency).catch(() => undefined);
      },
      () => setEmergency((prev) => prev.primary ? prev : emergencyFor()),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const addContact = async () => {
    if (!name.trim()) return;
    if (guest) {
      const next = [...contacts, { id: crypto.randomUUID(), name: name.trim(), phone: phone.trim() }];
      localStorage.setItem('queendar_contacts', JSON.stringify(next));
      setContacts(next);
      setName('');
      setPhone('');
      return;
    }
    await api('/api/contacts', { method: 'POST', body: JSON.stringify({ name: name.trim(), phone: phone.trim() }) });
    setName('');
    setPhone('');
    load();
  };

  const removeContact = async (id: string) => {
    if (guest) {
      const next = contacts.filter((c) => c.id !== id);
      localStorage.setItem('queendar_contacts', JSON.stringify(next));
      setContacts(next);
      return;
    }
    await api(`/api/contacts/${id}`, { method: 'DELETE' });
    load();
  };

  const locate = () =>
    new Promise<{ lat?: number; lng?: number }>((resolve) => {
      if (!navigator.geolocation) return resolve(here);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(here),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });

  const saveIce = async () => {
    if (guest) {
      saveLocalIce(ice);
      setIceMsg('ICE saved on this phone.');
      return;
    }
    const data = await api<{ user: QueenUser }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ username: owner?.username, bio: owner?.bio || '', ice }),
    });
    setSession(data.user);
    onUser?.(data.user);
    setIceMsg('ICE medical card saved.');
  };

  const send = async (kind: 'ok' | 'sos') => {
    setBusy(kind);
    const gps = await locate();
    const fallback = here.lat != null ? here : {};
    const point = gps.lat != null ? gps : fallback;
    if (point.lat != null) {
      setHere(point);
      localStorage.setItem('queendar_last_gps', JSON.stringify(point));
      setEmergency(emergencyFor(point.lat, point.lng));
    }
    const maps = point.lat != null ? `https://maps.google.com/?q=${point.lat},${point.lng}` : '';
    const em = emergencyFor(point.lat, point.lng);
    const medical = iceSummary(ice);
    const message =
      kind === 'sos'
        ? ['QUEENDAR SOS — I need help.', maps, `Local emergency ${em.primary} (${em.country})`, medical].filter(Boolean).join(' ')
        : `Queendar check-in: I'm safe. ${maps}`.trim();
    try {
      if (!guest && kind === 'sos') {
        const item = enqueueDistress({ lat: point.lat, lng: point.lng, message });
        try {
          await api('/api/sos', { method: 'POST', timeoutMs: 8000, body: JSON.stringify({ ...point, kind, message }) });
          dropDistress(item.id);
        } catch {
          setStatus('No data — SOS queued. SMS and the call button still work. QueenDar will send when you are back online.');
        }
      } else if (!guest) {
        await api('/api/checkin', { method: 'POST', body: JSON.stringify({ ...point, kind, message }) }).catch(() => undefined);
      }
      await navigator.clipboard?.writeText(message).catch(() => undefined);
      const sms = contacts.find((c) => c.phone)?.phone;
      if (sms) {
        window.location.href = `sms:${sms.replace(/\s/g, '')}&body=${encodeURIComponent(message)}`;
      }
      if (kind !== 'sos') setStatus("Check-in saved. You're marked safe.");
      else if (navigator.onLine) setStatus('SOS ready. Message copied — text still works without signal to the app.');
      load();
    } catch (err) {
      await navigator.clipboard?.writeText(message).catch(() => undefined);
      const sms = contacts.find((c) => c.phone)?.phone;
      if (sms) window.location.href = `sms:${sms.replace(/\s/g, '')}&body=${encodeURIComponent(message)}`;
      setStatus(err instanceof Error ? err.message : 'Offline SOS: message copied. Call local emergency above.');
    } finally {
      setBusy('');
      setCountdown(null);
    }
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      send('sos');
      return;
    }
    const t = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]);

  const tel = (n: string) => `tel:${n.replace(/\s/g, '')}`;
  const extra = emergency.services.filter((s) => s.number !== emergency.primary);

  return (
    <div className="px-4 pb-8 space-y-4">
      <div className="pt-2">
        <h2 className="text-xl font-bold text-white">SOS & check-in</h2>
        <p className="text-[#555555] text-sm mt-0.5">One-thumb call. ICE card for responders. SOS still texts if the app is offline.</p>
        <p className="text-[11px] text-[#666] mt-2">{AID_NOTICE}</p>
      </div>

      <a
        href={tel(emergency.primary)}
        className="block rounded-2xl py-7 bg-red-600 text-center text-white font-black text-2xl tracking-wide shadow-[0_0_24px_rgba(220,38,38,0.35)] min-h-[88px]"
      >
        {emergency.call || 'Call'} {emergency.primary}
        <span className="block text-[12px] font-semibold text-red-100 mt-1">{emergency.country}</span>
      </a>
      <GpsCard lat={here.lat} lng={here.lng} />
      {extra.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {extra.slice(0, 4).map((s) => (
            <a key={`${s.kind}-${s.number}`} href={tel(s.number)} className="rounded-xl bg-[#111] border border-[#222] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-[#777]">{s.kind}</p>
              <p className="text-white font-bold text-sm">{s.number}</p>
            </a>
          ))}
        </div>
      )}

      <div className="bg-[#fff8e8] border border-[#c9a84c] rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[#080808] font-black text-sm tracking-wide flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4" /> ICE · In case of emergency
          </p>
          {ice.phone && (
            <a href={tel(ice.phone)} className="text-[11px] font-bold bg-[#080808] text-[#c9a84c] rounded-lg px-2 py-1">
              Call ICE
            </a>
          )}
        </div>
        {iceFilled(ice) ? (
          <div className="text-[#111] text-sm space-y-1">
            {(ice.name || ice.phone) && (
              <p className="font-bold">
                {ice.name || 'Emergency contact'}
                {ice.relation ? ` · ${ice.relation}` : ''}
                {ice.phone ? ` · ${ice.phone}` : ''}
              </p>
            )}
            {ice.bloodType && <p>Blood type: {ice.bloodType}</p>}
            {ice.conditions && <p>Conditions: {ice.conditions}</p>}
            {ice.allergies && <p>Allergies: {ice.allergies}</p>}
            {ice.meds && <p>Meds: {ice.meds}</p>}
            {ice.notes && <p>{ice.notes}</p>}
          </div>
        ) : (
          <p className="text-[#444] text-xs">No medical ICE yet. Add diabetes, allergies, blood type, and who to call.</p>
        )}
        <p className="text-[10px] text-[#7a5a10]">Medical ICE is encrypted on your account. Live alerts never show who reported them.</p>
        <button onClick={() => setIceOpen(!iceOpen)} className="text-[11px] font-bold text-[#5b3d00]">
          {iceOpen ? 'Hide editor' : 'Edit ICE card'}
        </button>
        {iceOpen && (
          <div className="space-y-2 pt-1">
            <input value={ice.name} onChange={(e) => setIce({ ...ice, name: e.target.value })} placeholder="ICE contact name" className="w-full bg-white border border-[#e6d4a3] rounded-xl px-3 py-2 text-sm text-[#111]" />
            <div className="flex gap-2">
              <input value={ice.phone} onChange={(e) => setIce({ ...ice, phone: e.target.value })} placeholder="ICE phone" className="flex-1 bg-white border border-[#e6d4a3] rounded-xl px-3 py-2 text-sm text-[#111]" />
              <input value={ice.relation} onChange={(e) => setIce({ ...ice, relation: e.target.value })} placeholder="Relation" className="w-28 bg-white border border-[#e6d4a3] rounded-xl px-3 py-2 text-sm text-[#111]" />
            </div>
            <input value={ice.conditions} onChange={(e) => setIce({ ...ice, conditions: e.target.value })} placeholder="Conditions (diabetes, asthma…)" className="w-full bg-white border border-[#e6d4a3] rounded-xl px-3 py-2 text-sm text-[#111]" />
            <input value={ice.allergies} onChange={(e) => setIce({ ...ice, allergies: e.target.value })} placeholder="Allergies (peanuts, penicillin…)" className="w-full bg-white border border-[#e6d4a3] rounded-xl px-3 py-2 text-sm text-[#111]" />
            <div className="flex gap-2">
              <input value={ice.meds} onChange={(e) => setIce({ ...ice, meds: e.target.value })} placeholder="Medications" className="flex-1 bg-white border border-[#e6d4a3] rounded-xl px-3 py-2 text-sm text-[#111]" />
              <input value={ice.bloodType} onChange={(e) => setIce({ ...ice, bloodType: e.target.value })} placeholder="Blood" className="w-20 bg-white border border-[#e6d4a3] rounded-xl px-3 py-2 text-sm text-[#111]" />
            </div>
            <textarea value={ice.notes} onChange={(e) => setIce({ ...ice, notes: e.target.value })} placeholder="Notes for first responders" rows={2} className="w-full bg-white border border-[#e6d4a3] rounded-xl px-3 py-2 text-sm text-[#111] resize-none" />
            <button onClick={() => saveIce().catch((e) => setIceMsg(e.message))} className="w-full py-2 rounded-xl bg-[#080808] text-[#c9a84c] text-xs font-bold">
              Save ICE card
            </button>
            {iceMsg && <p className="text-[11px] text-[#5b3d00]">{iceMsg}</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => send('ok')}
          disabled={!!busy || countdown !== null}
          className="rounded-2xl min-h-[72px] py-4 bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 font-bold text-sm flex flex-col items-center justify-center gap-1 disabled:opacity-50"
        >
          {busy === 'ok' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          I'm safe
        </button>
        {countdown === null ? (
          <button
            onClick={() => setCountdown(5)}
            disabled={!!busy}
            className="rounded-2xl min-h-[72px] py-4 bg-red-950/50 border border-red-800/50 text-red-400 font-bold text-sm flex flex-col items-center justify-center gap-1"
          >
            <AlertTriangle className="w-5 h-5" />
            SOS
          </button>
        ) : (
          <button onClick={() => setCountdown(null)} className="rounded-2xl py-4 bg-[#1a1a1a] border border-[#333] text-white font-bold text-sm">
            Cancel {countdown}s
          </button>
        )}
      </div>

      {status && (
        <div className="bg-[#111111] border border-[#222] rounded-xl px-3 py-2.5 text-xs text-[#c9a84c] flex gap-2">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {status}
        </div>
      )}

      <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl p-4 space-y-3">
        <p className="text-sm font-bold text-white">Trusted contacts</p>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="flex-1 bg-[#111] border border-[#272727] rounded-xl px-3 py-2 text-sm text-white" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="flex-1 bg-[#111] border border-[#272727] rounded-xl px-3 py-2 text-sm text-white" />
          <button onClick={addContact} className="bg-[#c9a84c] rounded-xl px-3 text-[#080808]"><Plus className="w-4 h-4" /></button>
        </div>
        {contacts.length === 0 && <p className="text-xs text-[#555]">Add someone who should get your SOS text (GPS + ICE summary).</p>}
        {contacts.map((c) => (
          <div key={c.id} className="flex items-center gap-2 bg-[#111] rounded-xl px-3 py-2">
            <Shield className="w-3.5 h-3.5 text-[#c9a84c]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{c.name}</p>
              <p className="text-[11px] text-[#666]">{c.phone || 'No number'}</p>
            </div>
            {c.phone && (
              <a href={`tel:${c.phone}`} className="text-[#888]"><Phone className="w-4 h-4" /></a>
            )}
            <button onClick={() => removeContact(c.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      {checkins[0] && (
        <div className="text-[11px] text-[#555]">
          Last: {checkins[0].kind === 'sos' ? 'SOS' : 'safe'} · {new Date(checkins[0].created_at).toLocaleString()}
        </div>
      )}
      {guest && <p className="text-[11px] text-[#444]">Guest ICE and contacts stay on this phone. Sign in to save SOS events to your account.</p>}
    </div>
  );
}
