import { useEffect, useRef, useState } from 'react';
import { Crown, Radar, Scan, BookOpen, Settings, LogOut, Trash2, ChevronDown, Loader2, ShieldAlert, User } from 'lucide-react';
import VibeRadar from './VibeRadar';
import AIScan from './AIScan';
import CrownLog from './CrownLog';
import SosPanel from './SosPanel';
import AlwaysAsk from './AlwaysAsk';
import OfflineBar from './OfflineBar';
import FlipCard from './FlipCard';
import { api, clearSession, setSession, type QueenUser } from '../lib/api';
import { emergencyFor, loadLocalIce, normalizeIce, type IceCard } from '../lib/emergency';
import { getWatchUntil, openFlip, remain, subscribeWatch } from '../lib/watch';
import { cacheContacts, haptic, silentSos } from '../lib/silent-sos';
import { loadPack } from '../lib/arrival';
import type { Haven } from './SafeHavens';

type Tab = 'radar' | 'scan' | 'log' | 'sos';
type Props = { userId: string; owner?: QueenUser; guest?: boolean; onUser?: (user: QueenUser) => void };

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'radar', label: 'Radar', icon: <Radar className="w-4 h-4" /> },
  { id: 'scan', label: 'Scan', icon: <Scan className="w-4 h-4" /> },
  { id: 'log', label: 'Log', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'sos', label: 'SOS', icon: <ShieldAlert className="w-4 h-4" /> },
];

export default function Dashboard({ owner, guest, onUser }: Props) {
  const [tab, setTab] = useState<Tab>('radar');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panel, setPanel] = useState<'menu' | 'profile' | 'plus'>('menu');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [username, setUsername] = useState(owner?.username || '');
  const [bio, setBio] = useState(owner?.bio || '');
  const [ice, setIce] = useState<IceCard>(normalizeIce(owner?.ice));
  const [watchUntil, setWatchUntil] = useState<number | null>(() => getWatchUntil());
  const [flip, setFlip] = useState(false);
  const [havens, setHavens] = useState<Haven[]>([]);
  const tapRef = useRef<number[]>([]);
  const [now, setNow] = useState(Date.now());
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [msg, setMsg] = useState('');
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
        setPanel('menu');
        setDeleteConfirm(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('plus') === 'success' && params.get('session_id') && !guest) {
      api<{ user: QueenUser }>('/api/plus/confirm', {
        method: 'POST',
        body: JSON.stringify({ session_id: params.get('session_id') }),
      }).then((data) => {
        if (data.user) {
          setSession(data.user);
          onUser?.(data.user);
        }
        window.history.replaceState({}, '', '/');
      }).catch(() => undefined);
    }
  }, [guest, onUser]);

  useEffect(() => {
    const stop = subscribeWatch(setWatchUntil);
    return () => { stop(); };
  }, []);

  useEffect(() => {
    if (!watchUntil) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [watchUntil]);

  useEffect(() => {
    const onFlip = () => setFlip(true);
    window.addEventListener('queendar-flip', onFlip);
    cacheContacts(guest);
    const pack = loadPack();
    if (pack?.lat != null) {
      api<{ havens?: Haven[] }>(`/api/havens?lat=${pack.lat}&lng=${pack.lng}`, { timeoutMs: 15000 })
        .then((d) => setHavens(d.havens || []))
        .catch(() => undefined);
    }
    return () => window.removeEventListener('queendar-flip', onFlip);
  }, [guest]);

  const crownTap = () => {
    const t = Date.now();
    tapRef.current = [...tapRef.current.filter((x) => t - x < 900), t];
    if (tapRef.current.length >= 3) {
      tapRef.current = [];
      haptic(20);
      silentSos({ reason: 'tap', ice: guest ? loadLocalIce() : ice, guest });
    }
  };

  const pack = loadPack();
  const emergency = emergencyFor(pack?.lat, pack?.lng);

  const displayName = owner?.username || (guest ? 'Guest' : 'Queen');
  const isPlus = Boolean(owner?.premium === 'lifetime' || owner?.premium === 'plus' || owner?.isPlus);

  const saveProfile = async () => {
    const data = await api<{ user: QueenUser }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ username, bio, ice }),
    });
    setSession(data.user);
    onUser?.(data.user);
    setIce(normalizeIce(data.user.ice));
    setMsg('Profile saved.');
  };

  const changePassword = async () => {
    await api('/api/auth/password', { method: 'POST', body: JSON.stringify({ current: currentPw, password: newPw }) });
    setCurrentPw('');
    setNewPw('');
    setMsg('Password updated.');
  };

  const startPlus = async () => {
    const data = await api<{ url?: string; already?: boolean; user?: QueenUser }>('/api/plus/checkout', { method: 'POST' });
    if (data.already && data.user) {
      setSession(data.user);
      onUser?.(data.user);
      setMsg('Plus is already active.');
      return;
    }
    if (data.url) window.location.href = data.url;
  };

  const handleSignOut = () => {
    clearSession();
    window.location.reload();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleting(true);
    try {
      await api('/api/account', { method: 'DELETE' });
    } catch {
      /* still sign out */
    }
    clearSession();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col max-w-lg mx-auto">
      <header className="flex items-center justify-between px-4 pt-12 pb-4 bg-[#080808] border-b border-[#111111] sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={crownTap}
            className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#c9a84c] to-[#e8c96a] flex items-center justify-center"
            aria-label="QueenDar — triple tap for a silent ping"
          >
            <Crown className="w-4 h-4 text-[#080808]" strokeWidth={2.5} />
          </button>
          <div>
            <p className="text-white font-bold text-sm leading-none">Queendar</p>
            <p className="text-[#c9a84c] text-[10px] mt-0.5 font-medium">
              Welcome, {displayName}
              {owner?.premium === 'lifetime' ? ' · Lifetime Premium' : isPlus ? ' · Plus' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {watchUntil && (
            <button
              key={now}
              onClick={openFlip}
              className="text-[10px] font-bold text-[#c9a84c] bg-[#141414] border border-[#2a2418] rounded-lg px-2 py-1.5"
            >
              Quiet {remain(watchUntil)}
            </button>
          )}
        <div className="relative" ref={settingsRef}>
          <button onClick={() => { setSettingsOpen(!settingsOpen); setPanel('menu'); setDeleteConfirm(false); }} className="flex items-center gap-1.5 text-[#555] bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2">
            <Settings className="w-3.5 h-3.5" />
            <ChevronDown className={`w-3 h-3 ${settingsOpen ? 'rotate-180' : ''}`} />
          </button>
          {settingsOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#111] border border-[#222] rounded-2xl shadow-2xl z-50 overflow-hidden">
              {panel === 'menu' && (
                <>
                  <div className="px-4 py-3 border-b border-[#1e1e1e]">
                    <p className="text-white text-sm font-semibold truncate">{displayName}</p>
                    <p className="text-[#444] text-xs">{owner?.email || (guest ? 'Guest' : '')}</p>
                  </div>
                  {!guest && (
                    <>
                      <button onClick={() => setPanel('profile')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#888] hover:text-white"><User className="w-4 h-4" /> Profile</button>
                      <button onClick={() => setPanel('plus')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#888] hover:text-white"><Crown className="w-4 h-4" /> QueenDar Plus</button>
                    </>
                  )}
                  <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#888] hover:text-white"><LogOut className="w-4 h-4" /> Sign Out</button>
                  {!guest && (
                    <button onClick={handleDelete} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500">
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {deleteConfirm ? 'Tap again to delete everything' : 'Delete Account'}
                    </button>
                  )}
                </>
              )}
              {panel === 'profile' && (
                <div className="p-4 space-y-2">
                  <p className="text-white text-sm font-bold">Profile</p>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-sm text-white" />
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" rows={2} className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-sm text-white resize-none" />
                  <p className="text-[10px] uppercase tracking-wider text-[#c9a84c] font-bold pt-1">ICE / medical</p>
                  <input value={ice.name} onChange={(e) => setIce({ ...ice, name: e.target.value })} placeholder="Emergency contact name" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-sm text-white" />
                  <input value={ice.phone} onChange={(e) => setIce({ ...ice, phone: e.target.value })} placeholder="ICE phone" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-sm text-white" />
                  <input value={ice.relation} onChange={(e) => setIce({ ...ice, relation: e.target.value })} placeholder="Relation (partner, parent…)" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-sm text-white" />
                  <input value={ice.conditions} onChange={(e) => setIce({ ...ice, conditions: e.target.value })} placeholder="Conditions (diabetes, asthma…)" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-sm text-white" />
                  <input value={ice.allergies} onChange={(e) => setIce({ ...ice, allergies: e.target.value })} placeholder="Allergies" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-sm text-white" />
                  <input value={ice.meds} onChange={(e) => setIce({ ...ice, meds: e.target.value })} placeholder="Medications" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-sm text-white" />
                  <input value={ice.bloodType} onChange={(e) => setIce({ ...ice, bloodType: e.target.value })} placeholder="Blood type" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-sm text-white" />
                  <textarea value={ice.notes} onChange={(e) => setIce({ ...ice, notes: e.target.value })} placeholder="Notes for first responders" rows={2} className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-sm text-white resize-none" />
                  <button onClick={() => saveProfile().catch((e) => setMsg(e.message))} className="w-full py-2 rounded-xl bg-[#7c3aed] text-white text-xs font-bold">Save profile</button>
                  <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Current password" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-sm text-white" />
                  <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-sm text-white" />
                  <button onClick={() => changePassword().catch((e) => setMsg(e.message))} className="w-full py-2 rounded-xl border border-[#333] text-[#ccc] text-xs font-bold">Change password</button>
                  {msg && <p className="text-[11px] text-[#c9a84c]">{msg}</p>}
                </div>
              )}
              {panel === 'plus' && (
                <div className="p-4 space-y-2">
                  <p className="text-white text-sm font-bold">QueenDar Plus</p>
                  <p className="text-xs text-[#888]">€4.99/month. Lifetime is already on the founder account.</p>
                  {isPlus ? (
                    <p className="text-sm text-emerald-400">{owner?.premium === 'lifetime' ? 'Lifetime Premium is active.' : 'Plus is active.'}</p>
                  ) : (
                    <button onClick={() => startPlus().catch((e) => setMsg(e.message))} className="w-full py-2 rounded-xl bg-gradient-to-r from-[#c9a84c] to-[#e8c96a] text-[#080808] text-xs font-bold">Subscribe</button>
                  )}
                  {msg && <p className="text-[11px] text-[#c9a84c]">{msg}</p>}
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </header>

      <OfflineBar />

      <main className="flex-1 overflow-y-auto">
        {tab === 'radar' && <VibeRadar guest={guest} />}
        {tab === 'scan' && <AIScan />}
        {tab === 'log' && <CrownLog guest={guest} />}
        {tab === 'sos' && <SosPanel guest={guest} owner={owner} onUser={onUser} />}
      </main>

      <AlwaysAsk />

      {flip && (
        <FlipCard
          ice={guest ? loadLocalIce() : ice}
          emergency={emergency}
          havens={havens}
          guest={guest}
          onClose={() => setFlip(false)}
          onSafe={() => { /* subscribeWatch clears */ }}
        />
      )}

      <nav className="sticky bottom-0 bg-[#080808] border-t border-[#111] px-2">
        <div className="flex">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 flex flex-col items-center gap-1 py-3.5 text-[10px] font-semibold ${tab === t.id ? 'text-[#7c3aed]' : 'text-[#444]'}`}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
