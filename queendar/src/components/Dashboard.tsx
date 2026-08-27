import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/supabase';
import { Crown, Radar, Scan, BookOpen, Settings, LogOut, Trash2, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import VibeRadar from './VibeRadar';
import AIScan from './AIScan';
import CrownLog from './CrownLog';

type Tab = 'radar' | 'scan' | 'log';

type Props = { userId: string };

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'radar', label: 'Vibe Radar', icon: <Radar className="w-4 h-4" /> },
  { id: 'scan', label: 'AI Scan', icon: <Scan className="w-4 h-4" /> },
  { id: 'log', label: 'Crown Log', icon: <BookOpen className="w-4 h-4" /> },
];

export default function Dashboard({ userId }: Props) {
  const [tab, setTab] = useState<Tab>('radar');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [userId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
        setDeleteConfirm(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleting(true);
    await supabase.from('crown_logs').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.auth.signOut();
  };

  const displayName = profile?.username || 'Queen';

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col max-w-lg mx-auto">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pt-12 pb-4 bg-[#080808] border-b border-[#111111] sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#c9a84c] to-[#e8c96a] flex items-center justify-center shadow-[0_0_12px_rgba(201,168,76,0.3)]">
            <Crown className="w-4 h-4 text-[#080808]" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Queendar</p>
            <p className="text-[#c9a84c] text-[10px] mt-0.5 font-medium">Welcome, {displayName}</p>
          </div>
        </div>

        {/* Settings dropdown */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => { setSettingsOpen(!settingsOpen); setDeleteConfirm(false); }}
            className="flex items-center gap-1.5 text-[#555555] hover:text-white transition-colors bg-[#111111] border border-[#1e1e1e] rounded-xl px-3 py-2"
          >
            <Settings className="w-3.5 h-3.5" />
            <ChevronDown className={`w-3 h-3 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
          </button>

          {settingsOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-[#111111] border border-[#222222] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-[#1e1e1e]">
                <p className="text-white text-sm font-semibold truncate">{displayName}</p>
                <p className="text-[#444444] text-xs mt-0.5 truncate">Account Settings</p>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-[#888888] hover:text-white hover:bg-[#1a1a1a] transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>

              <div className="border-t border-[#1e1e1e]">
                {!deleteConfirm ? (
                  <button
                    onClick={handleDeleteAccount}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:text-red-400 hover:bg-red-950/20 transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </button>
                ) : (
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-red-400 text-xs leading-snug">
                        This will permanently delete all your data. Tap again to confirm.
                      </p>
                    </div>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-red-900/40 border border-red-800/50 rounded-xl text-red-400 text-xs font-bold hover:bg-red-900/60 transition-colors disabled:opacity-50"
                    >
                      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Yes, Delete Everything
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'radar' && <VibeRadar />}
        {tab === 'scan' && <AIScan />}
        {tab === 'log' && <CrownLog userId={userId} />}
      </main>

      {/* Bottom nav */}
      <nav className="sticky bottom-0 bg-[#080808] border-t border-[#111111] px-2 pb-safe-area-inset-bottom">
        <div className="flex items-stretch">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3.5 transition-all duration-200 ${
                tab === t.id
                  ? 'text-[#7c3aed]'
                  : 'text-[#444444] hover:text-[#666666]'
              }`}
            >
              <div className={`transition-all duration-200 ${tab === t.id ? 'drop-shadow-[0_0_6px_rgba(124,58,237,0.7)]' : ''}`}>
                {t.icon}
              </div>
              <span className={`text-[10px] font-semibold tracking-wide ${tab === t.id ? 'text-[#7c3aed]' : ''}`}>
                {t.label}
              </span>
              {tab === t.id && (
                <div className="absolute bottom-0 h-0.5 w-12 bg-[#7c3aed] rounded-t-full shadow-[0_0_8px_rgba(124,58,237,0.6)]" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
