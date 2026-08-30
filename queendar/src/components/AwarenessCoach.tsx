import { useEffect, useMemo, useState } from 'react';
import { Battery, Check, Clock, Loader2, MapPin, MessageCircle, Newspaper, Timer } from 'lucide-react';
import { api } from '../lib/api';
import { cacheContacts } from '../lib/silent-sos';
import { clearWatch, getWatchUntil, openFlip, remain, setWatch, subscribeWatch } from '../lib/watch';
import { AID_NOTICE } from '../lib/disclaimer';

type IncidentLite = {
  kind: string;
  label?: string;
  status?: string;
  confirms?: number;
};

type Msg = { role: 'you' | 'queen'; text: string };

const CHIPS: { id: string; label: string }[] = [
  { id: 'alone', label: 'Out alone' },
  { id: 'meetup', label: 'Meeting someone new' },
  { id: 'night', label: 'Late night' },
];

function isNight(hour: number) {
  return hour >= 23 || hour < 6;
}

function isMajor(incidents: IncidentLite[]) {
  return incidents.some((i) => {
    const confirmed = i.status === 'confirmed' || (i.confirms || 0) >= 2;
    return confirmed && (i.kind === 'violence' || i.kind === 'protest' || i.kind === 'police');
  }) || incidents.some((i) => (i.confirms || 0) >= 3);
}

function localHint(tags: string[], night: boolean, major: boolean, place?: string, tips?: string[]) {
  const yumbo = /yumbo|maspalomas/i.test(place || '');
  if (major) {
    return 'Something notable was flagged nearby. Stay steady — check local news or official sources before you change plans.';
  }
  if (yumbo) {
    return 'Yumbo is busy and mixed. Watch your drink, and late taxis from a rank or a booked app — not a random offer at 4am.';
  }
  if (tips?.[0]) return tips[0];
  if (tags.includes('meetup')) {
    return 'Meeting someone new: public first hello. Use a 30-minute check-in instead of a warning.';
  }
  if (tags.includes('alone') || night) {
    return 'Late is fine. Share an ETA, keep the phone charged, and tap I’ve arrived when you’re in.';
  }
  return 'Practical tools, not alarms. RTX Pro will coach you if you ask.';
}

export default function AwarenessCoach({
  city,
  incidents = [],
  guest,
  here,
  tips = [],
}: {
  city?: string;
  incidents?: IncidentLite[];
  guest?: boolean;
  here?: { lat: number; lng: number } | null;
  tips?: string[];
}) {
  const hour = new Date().getHours();
  const night = isNight(hour);
  const major = isMajor(incidents);
  const unverified = incidents.some((i) => i.status !== 'confirmed' && (i.confirms || 0) < 2);
  const [tags, setTags] = useState<string[]>(night ? ['night'] : []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [verify, setVerify] = useState(major);
  const [thread, setThread] = useState<Msg[]>([]);
  const [status, setStatus] = useState('');
  const [battery, setBattery] = useState<number | null>(null);
  const [watchUntil, setWatchUntil] = useState<number | null>(() => getWatchUntil());
  const [now, setNow] = useState(Date.now());

  const hint = useMemo(() => localHint(tags, night, major, city, tips), [tags, night, major, city, tips]);
  const newsUrl = `https://news.google.com/search?q=${encodeURIComponent(`${city || 'local'} news`)}&hl=en`;

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
    nav.getBattery?.().then((b) => setBattery(Math.round(b.level * 100))).catch(() => undefined);
  }, []);

  useEffect(() => {
    const stop = subscribeWatch(setWatchUntil);
    return () => { stop(); };
  }, []);

  useEffect(() => {
    if (!watchUntil) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [watchUntil]);

  const toggle = (id: string) => {
    setTags((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));
  };

  const locate = () =>
    new Promise<{ lat?: number; lng?: number }>((resolve) => {
      if (here?.lat != null) return resolve(here);
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });

  const arrived = async () => {
    const gps = await locate();
    const maps = gps.lat != null ? `https://maps.google.com/?q=${gps.lat},${gps.lng}` : '';
    const message = `Queendar check-in: I've arrived safely. ${maps}`.trim();
    try {
      if (!guest) {
        await api('/api/checkin', { method: 'POST', body: JSON.stringify({ ...gps, kind: 'ok', message }) }).catch(() => undefined);
      }
      await navigator.clipboard?.writeText(message).catch(() => undefined);
      clearWatch();
      setStatus("Marked arrived. Message copied if you want to text someone.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Could not check in.');
    }
  };

  const watch30 = () => {
    cacheContacts(guest);
    setWatch(30 * 60 * 1000);
    setStatus('Quiet timer · 30 min. Signed-in timers still fire if the phone sleeps. Triple-tap the crown for a silent ping before then.');
  };

  const sharePin = async () => {
    const gps = await locate();
    if (gps.lat == null) {
      setStatus('Allow location once so we can share a pin.');
      return;
    }
    const maps = `https://maps.google.com/?q=${gps.lat},${gps.lng}`;
    const mins = 30;
    const body = `QueenDar live pin for the next ${mins} min: ${maps}`;
    await navigator.clipboard?.writeText(body).catch(() => undefined);
    watch30();
    setStatus('Pin copied. Send it to someone you trust — it is not broadcast publicly.');
  };

  const ask = async (preset?: string) => {
    const message = (preset || input).trim();
    const you = message || (tags.includes('meetup') ? 'Meeting someone new tonight.' : tags.includes('alone') || night ? "I'm out alone tonight." : "What's around me here?");
    setInput('');
    setThread((t) => [...t, { role: 'you', text: you }]);
    setBusy(true);
    try {
      const data = await api<{ reply: string; verifyNews?: boolean; place?: string }>('/api/ai/aware', {
        method: 'POST',
        timeoutMs: 50000,
        body: JSON.stringify({
          message: you,
          situation: tags,
          city,
          hour,
          lat: here?.lat,
          lng: here?.lng,
          incidents: incidents.map((i) => ({ kind: i.kind, status: i.status, confirms: i.confirms, label: i.label })),
        }),
      });
      setVerify(Boolean(data.verifyNews) || major);
      const reply = (data.reply || '').trim();
      const bad = !reply || /plain text|thinking process|analyze user input/i.test(reply);
      setThread((t) => [...t, { role: 'queen', text: bad ? localHint(tags, night, major, city, tips) : reply }]);
    } catch {
      setVerify(major);
      setThread((t) => [...t, { role: 'queen', text: localHint(tags, night, major, city, tips) }]);
    } finally {
      setBusy(false);
    }
  };

  const lowBattery = battery != null && battery <= 20;

  return (
    <div className="mx-4 mb-3 bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl p-4 space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[#c9a84c] font-bold">Awareness · RTX Pro</p>
        <p className="text-white font-bold text-sm">Stay switched on — don’t panic</p>
        <p className="text-[12px] text-[#888] mt-1">{hint}</p>
      </div>
      {tips.length > 0 && (
        <ul className="text-[12px] text-[#aaa] space-y-1 list-disc pl-4">
          {tips.slice(0, 3).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {(verify || major) && (
        <a href={newsUrl} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-xl border border-[#333] bg-[#141414] px-3 py-2.5">
          <Newspaper className="w-4 h-4 text-[#c9a84c] mt-0.5 flex-shrink-0" />
          <span className="text-xs text-[#ccc]">
            Reports of disruptions near {city || 'this area'}. Check local news, transport updates, or official sources before heading out. QueenDar does not confirm headlines.
          </span>
        </a>
      )}
      {unverified && !major && !verify && (
        <p className="text-[11px] text-[#777]">Unverified traveler notes nearby — treat them as a hint, not a siren.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={arrived} className="rounded-xl bg-emerald-950/40 border border-emerald-800/40 px-3 py-3 text-emerald-300 text-xs font-bold flex flex-col items-center gap-1">
          <Check className="w-4 h-4" />
          I've arrived safely
        </button>
        <button onClick={watchUntil ? openFlip : watch30} className="rounded-xl bg-[#111] border border-[#222] px-3 py-3 text-[#ddd] text-xs font-bold flex flex-col items-center gap-1">
          <Clock className="w-4 h-4 text-[#c9a84c]" />
          {watchUntil ? `Quiet ${remain(watchUntil)}` : 'Check in on me in 30 mins'}
        </button>
        <button onClick={sharePin} className="rounded-xl bg-[#111] border border-[#222] px-3 py-3 text-[#ddd] text-xs font-bold flex flex-col items-center gap-1">
          <Timer className="w-4 h-4 text-[#c9a84c]" />
          Share pin 30 min
        </button>
        <div className={`rounded-xl border px-3 py-3 text-xs font-bold flex flex-col items-center gap-1 ${lowBattery ? 'bg-amber-950/30 border-amber-800/40 text-amber-300' : 'bg-[#111] border-[#222] text-[#ddd]'}`}>
          <Battery className="w-4 h-4" />
          {battery == null ? 'Battery unknown' : lowBattery ? `Battery ${battery}% — charge up` : `Battery ${battery}%`}
        </div>
      </div>
      {status && (
        <div className="text-[11px] text-[#c9a84c] flex gap-1.5">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {status}
        </div>
      )}
      {watchUntil && <p className="text-[11px] text-[#666]">Quiet timer · {remain(watchUntil)} left. Now {new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. No audio. {AID_NOTICE}</p>}
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            className={`text-[11px] px-2.5 py-1 rounded-lg border ${tags.includes(c.id) ? 'bg-[#7c3aed]/20 border-[#7c3aed] text-white' : 'border-[#222] text-[#888]'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {thread.length > 0 && (
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {thread.map((m, i) => (
            <div key={`${m.role}-${i}`} className={`text-xs rounded-xl px-3 py-2 ${m.role === 'you' ? 'bg-[#161616] text-[#bbb]' : 'bg-[#12100c] border border-[#2a2418] text-[#ddd]'}`}>
              <p className="text-[10px] uppercase tracking-wider text-[#666] mb-0.5">{m.role === 'you' ? 'You' : 'RTX Pro'}</p>
              {m.text}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="Ask RTX: walking home, first date, rumour…"
          className="flex-1 bg-[#111] border border-[#272727] rounded-xl px-3 py-2 text-sm text-white"
        />
        <button onClick={() => ask()} disabled={busy} className="bg-[#7c3aed] text-white rounded-xl px-3 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
