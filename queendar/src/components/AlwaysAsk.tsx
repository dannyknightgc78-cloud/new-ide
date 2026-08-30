import { useEffect, useState } from 'react';
import { Loader2, MapPin, MessageCircle } from 'lucide-react';
import { api } from '../lib/api';
import { localHint, loadPack, watchArrival, type LocalPack } from '../lib/arrival';

type Msg = { role: 'you' | 'queen'; text: string };

export default function AlwaysAsk() {
  const [pack, setPack] = useState<LocalPack | null>(() => loadPack());
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<Msg[]>([]);

  useEffect(() => watchArrival(setPack), []);

  const ask = async (preset?: string) => {
    const you = (preset || input).trim() || "What's around me here?";
    setInput('');
    setOpen(true);
    setThread((t) => [...t, { role: 'you', text: you }]);
    setBusy(true);
    const hour = new Date().getHours();
    try {
      const data = await api<{ reply: string; place?: string }>('/api/ai/aware', {
        method: 'POST',
        timeoutMs: 50000,
        body: JSON.stringify({
          message: you,
          hour,
          lat: pack?.lat,
          lng: pack?.lng,
          city: pack?.place || pack?.city,
          situation: hour >= 23 || hour < 6 ? ['night'] : [],
        }),
      });
      const reply = (data.reply || '').trim() || localHint(pack);
      setThread((t) => [...t, { role: 'queen', text: reply }]);
    } catch {
      setThread((t) => [...t, { role: 'queen', text: localHint(pack) }]);
    } finally {
      setBusy(false);
    }
  };

  const label = pack?.place || pack?.country || 'this area';

  return (
    <div className="border-t border-[#111] bg-[#0a0a0a] px-3 py-2">
      {pack?.primary && (
        <p className="text-[10px] text-[#c9a84c] font-semibold tracking-wide mb-1.5">
          On the ground · {pack.country} · {pack.call} {pack.primary}
          {pack.place ? ` · ${pack.place}` : ''}
        </p>
      )}
      {open && thread.length > 0 && (
        <div className="max-h-36 overflow-y-auto space-y-1.5 mb-2">
          {thread.slice(-6).map((m, i) => (
            <p key={`${m.role}-${i}`} className={`text-[11px] rounded-lg px-2 py-1.5 ${m.role === 'you' ? 'text-[#888]' : 'text-[#ddd] bg-[#141414]'}`}>
              <span className="text-[#555] mr-1">{m.role === 'you' ? 'You' : 'RTX'}</span>
              {m.text}
            </p>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-center">
        <MapPin className="w-3.5 h-3.5 text-[#c9a84c] flex-shrink-0" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder={`Ask RTX · ${label}`}
          className="flex-1 bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-sm text-white"
        />
        <button onClick={() => ask()} disabled={busy} className="bg-[#c9a84c] text-[#080808] rounded-xl px-3 py-2 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
        </button>
      </div>
      <button onClick={() => ask("What's around me here?")} className="text-[10px] text-[#666] mt-1 px-1">
        Pull local tips
      </button>
    </div>
  );
}
