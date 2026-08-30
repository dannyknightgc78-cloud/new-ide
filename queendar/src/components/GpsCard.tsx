import { MapPin } from 'lucide-react';
import { useState } from 'react';

export function fmtCoord(n?: number) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toFixed(6);
}

export default function GpsCard({ lat, lng }: { lat?: number; lng?: number }) {
  const [copied, setCopied] = useState(false);
  const text = lat != null && lng != null ? `${fmtCoord(lat)}, ${fmtCoord(lng)}` : '';
  const maps = text ? `https://maps.google.com/?q=${lat},${lng}` : '';

  const copy = async () => {
    if (!text) return;
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-2xl bg-[#f5ead0] text-[#080808] px-4 py-4">
      <p className="text-[10px] uppercase tracking-wider font-black">Coordinates · no data needed</p>
      <p className="font-mono text-[28px] font-black leading-none mt-2 tracking-tight">{fmtCoord(lat)}</p>
      <p className="font-mono text-[28px] font-black leading-none mt-1 tracking-tight">{fmtCoord(lng)}</p>
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={copy} className="flex-1 rounded-xl bg-[#080808] text-[#f5ead0] text-xs font-bold py-2.5 flex items-center justify-center gap-1.5">
          {copied ? 'Copied' : 'Copy GPS'}
        </button>
        {maps && (
          <a href={maps} className="flex-1 rounded-xl border border-[#080808] text-xs font-bold py-2.5 flex items-center justify-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Maps
          </a>
        )}
      </div>
      <p className="text-[10px] text-[#5b3d00] mt-2">Read these numbers to a dispatcher or a friend. Voice call still works without mobile data.</p>
    </div>
  );
}
