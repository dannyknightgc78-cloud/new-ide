import { useEffect, useState } from 'react';
import { ChevronRight, Crown, HeartPulse, Phone, ShieldAlert } from 'lucide-react';
import { api, setSession, type QueenUser } from '../lib/api';
import { blankIce, emergencyFor, iceFilled, loadLocalIce, normalizeIce, saveLocalIce, type IceCard } from '../lib/emergency';
import { AID_NOTICE } from '../lib/disclaimer';

type Props = { onComplete: () => void; owner?: QueenUser | null; guest?: boolean; onUser?: (user: QueenUser) => void };

export default function Onboarding({ onComplete, owner, guest, onUser }: Props) {
  const [step, setStep] = useState(0);
  const [ice, setIce] = useState<IceCard>(guest ? loadLocalIce() : normalizeIce(owner?.ice) || blankIce());
  const [saving, setSaving] = useState(false);
  const [here, setHere] = useState<{ lat?: number; lng?: number }>({});
  const [em, setEm] = useState(emergencyFor());
  const [place, setPlace] = useState('');
  const [tips, setTips] = useState<string[]>([]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setHere({ lat, lng });
        const local = emergencyFor(lat, lng);
        setEm(local);
        api<{ nearestHood?: { name: string; tips?: string[] }; emergency?: typeof local }>(`/api/radar?lat=${lat}&lng=${lng}`)
          .then((data) => {
            if (data.emergency) setEm(data.emergency);
            if (data.nearestHood?.name) setPlace(data.nearestHood.name);
            if (data.nearestHood?.tips) setTips(data.nearestHood.tips);
          })
          .catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const saveIceCard = async () => {
    if (guest || !owner) {
      saveLocalIce(ice);
      return;
    }
    if (!iceFilled(ice)) return;
    setSaving(true);
    try {
      const data = await api<{ user: QueenUser }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ username: owner.username, bio: owner.bio || '', ice }),
      });
      setSession(data.user);
      onUser?.(data.user);
    } catch {
      saveLocalIce(ice);
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (step === 1) await saveIceCard();
    if (step >= 2) {
      onComplete();
      return;
    }
    setStep(step + 1);
  };

  const tel = `tel:${(em.primary || '112').replace(/\s/g, '')}`;

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col px-4 pt-16 pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#c9a84c] to-[#e8c96a] flex items-center justify-center">
          <Crown className="w-4 h-4 text-[#080808]" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-white font-bold text-sm">30-second setup</p>
          <p className="text-[#555] text-[11px]">Step {step + 1} of 3 · skip anything you want</p>
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-4 flex-1">
          <h1 className="text-2xl font-black text-white">You're covered on arrival</h1>
          <p className="text-sm text-[#888]">Local emergency number from GPS. No setup. Not a panic alarm.</p>
          <a href={tel} className="block rounded-2xl py-7 bg-red-600 text-center text-white font-black text-2xl">
            {em.call || 'Call'} {em.primary}
            <span className="block text-[12px] font-semibold text-red-100 mt-1">{em.country}</span>
          </a>
          {place && <p className="text-sm text-[#c9a84c]">Nearest zone: {place}</p>}
          {tips.slice(0, 2).map((t) => (
            <p key={t} className="text-xs text-[#888]">· {t}</p>
          ))}
          {here.lat == null && <p className="text-xs text-[#555]">Allow location for the right number. Until then we show 112.</p>}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3 flex-1">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-[#c9a84c]" /> ICE card
          </h1>
          <p className="text-sm text-[#888]">Diabetes, allergies, who to call. Encrypted on your account. First responders see it on SOS.</p>
          <input value={ice.name} onChange={(e) => setIce({ ...ice, name: e.target.value })} placeholder="Emergency contact name" className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-3 text-sm text-white" />
          <input value={ice.phone} onChange={(e) => setIce({ ...ice, phone: e.target.value })} placeholder="ICE phone" className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-3 text-sm text-white" />
          <input value={ice.conditions} onChange={(e) => setIce({ ...ice, conditions: e.target.value })} placeholder="Conditions (diabetes, asthma…)" className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-3 text-sm text-white" />
          <input value={ice.allergies} onChange={(e) => setIce({ ...ice, allergies: e.target.value })} placeholder="Allergies" className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-3 text-sm text-white" />
          <input value={ice.bloodType} onChange={(e) => setIce({ ...ice, bloodType: e.target.value })} placeholder="Blood type" className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-3 text-sm text-white" />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 flex-1">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#7c3aed]" /> One-tap tools
          </h1>
          <p className="text-sm text-[#888]">Radar has I've arrived, a 30-minute check-in, and a pin you can share. SOS is for people you trust — plus the big call button.</p>
          <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl p-4 space-y-2 text-sm text-[#ccc]">
            <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-red-400" /> {em.call || 'Call'} {em.primary} — always first</p>
            <p>I've arrived safely — check in without drama</p>
            <p>Check in on me in 30 mins — a quiet timer. If it ends, QueenDar pings someone you trust. Keep the app open, or sign in so the server can still fire if the phone sleeps.</p>
            <p className="text-[11px] text-[#888]">{AID_NOTICE}</p>
            <p>Alerts stay unverified until a second traveler confirms</p>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        <button onClick={next} disabled={saving} className="w-full py-4 rounded-2xl font-black bg-gradient-to-r from-[#c9a84c] to-[#e8c96a] text-[#080808] flex items-center justify-center gap-2">
          {step === 2 ? 'Enter Queendar' : step === 1 ? 'Save ICE & continue' : 'Next'}
          <ChevronRight className="w-5 h-5" />
        </button>
        {step === 1 && (
          <button onClick={() => setStep(2)} className="w-full py-2 text-xs text-[#666]">Skip ICE for now</button>
        )}
        {step !== 1 && step < 2 && (
          <button onClick={onComplete} className="w-full py-2 text-xs text-[#666]">Skip setup</button>
        )}
      </div>
    </div>
  );
}
