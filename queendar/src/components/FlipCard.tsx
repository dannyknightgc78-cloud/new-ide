import { HeartPulse, Phone, X } from 'lucide-react';
import { iceFilled, iceSummary, type IceCard, type EmergencyInfo } from '../lib/emergency';
import { AID_NOTICE } from '../lib/disclaimer';
import { clearWatch, extendWatch, remain, getWatchUntil } from '../lib/watch';
import { haptic, silentSos } from '../lib/silent-sos';
import GpsCard from './GpsCard';
import OfflineBar from './OfflineBar';
import SafeHavens, { type Haven } from './SafeHavens';
import { loadPack } from '../lib/arrival';
import { useEffect, useState } from 'react';

type Props = {
  ice: IceCard;
  emergency: EmergencyInfo;
  havens: Haven[];
  guest?: boolean;
  onClose: () => void;
  onSafe: () => void;
};

export default function FlipCard({ ice, emergency, havens, guest, onClose, onSafe }: Props) {
  const [until, setUntil] = useState(getWatchUntil());
  const [now, setNow] = useState(Date.now());
  const [status, setStatus] = useState('');

  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(Date.now());
      setUntil(getWatchUntil());
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  const tel = `tel:${(emergency.primary || '112').replace(/\s/g, '')}`;

  return (
    <div className="fixed inset-0 z-50 bg-[#070707] max-w-lg mx-auto flex flex-col px-4 pt-12 pb-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-wider text-[#c9a84c] font-bold">Quiet card</p>
        <button onClick={onClose} className="text-[#666] p-2" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="-mx-4 mb-3">
        <OfflineBar />
      </div>
      <a href={tel} className="rounded-2xl bg-red-950/50 border border-red-800/50 px-4 py-4 mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Local emergency</p>
          <p className="text-white font-bold text-lg">{emergency.call || 'Call'} {emergency.primary}</p>
          <p className="text-[11px] text-[#aaa]">{emergency.country}</p>
        </div>
        <Phone className="w-5 h-5 text-red-400" />
      </a>
      <div className="mb-3">
        <GpsCard lat={loadPack()?.lat} lng={loadPack()?.lng} />
      </div>
      {iceFilled(ice) && (
        <div className="rounded-2xl border border-[#2a2418] bg-[#12100c] px-4 py-3 mb-3">
          <p className="text-[10px] uppercase tracking-wider text-[#c9a84c] font-bold flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5" /> ICE
          </p>
          <p className="text-[12px] text-[#ddd] mt-1">{iceSummary(ice)}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => {
            haptic(20);
            clearWatch();
            onSafe();
            onClose();
          }}
          className="rounded-xl bg-emerald-950/40 border border-emerald-800/40 py-3 text-emerald-300 text-xs font-bold"
        >
          I'm safe
        </button>
        <button
          onClick={() => {
            haptic(20);
            extendWatch(15 * 60 * 1000);
            setUntil(getWatchUntil());
            setStatus('+15 minutes. Still quiet.');
          }}
          className="rounded-xl bg-[#111] border border-[#222] py-3 text-[#ddd] text-xs font-bold"
        >
          +15 min {until ? `· ${remain(until)}` : ''}
        </button>
      </div>
      <button
        onClick={async () => {
          const res = await silentSos({ reason: 'flip', ice, guest });
          setStatus(
            res.queued
              ? 'No data — SOS queued. SMS draft still opened. QueenDar will send when signal returns.'
              : res.phone
                ? 'Silent SMS draft opened. No sound from QueenDar.'
                : 'Copied. Add a trusted contact on SOS so next time it texts.',
          );
        }}
        className="w-full rounded-xl border border-[#333] py-3 text-[11px] text-[#888] mb-4"
      >
        Silent ping to my contact now
      </button>
      <SafeHavens havens={havens} />
      {status && <p className="text-[11px] text-[#c9a84c] mt-3">{status}</p>}
      <p className="text-[10px] text-[#444] mt-auto pt-4">
        {AID_NOTICE} Triple-tap the crown anytime for a silent ping. QueenDar does not play audio.
        {until ? ` Quiet timer ${remain(until)} · ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
      </p>
    </div>
  );
}
