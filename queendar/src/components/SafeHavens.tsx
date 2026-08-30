import { HeartPulse, MapPin, Navigation, Shield } from 'lucide-react';

export type Haven = {
  name: string;
  kind: string;
  lat: number;
  lng: number;
  note?: string;
  distanceKm?: number | null;
  walk: string;
  source?: string;
};

const ICONS: Record<string, typeof MapPin> = {
  hospital: HeartPulse,
  pharmacy: HeartPulse,
  police: Shield,
  transit: Navigation,
  lobby: MapPin,
};

export default function SafeHavens({ havens, compact }: { havens: Haven[]; compact?: boolean }) {
  if (!havens.length) return null;
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {!compact && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#c9a84c] font-bold">Safe havens</p>
          <p className="text-[11px] text-[#666]">Lit public places nearby. Confirm they’re open before you walk.</p>
        </div>
      )}
      {havens.slice(0, compact ? 4 : 8).map((h) => {
            const Icon = ICONS[h.kind] || MapPin;
        return (
          <a
            key={`${h.kind}-${h.lat}-${h.lng}`}
            href={h.walk}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-2 rounded-xl border border-[#222] bg-[#111] px-3 py-2"
          >
            <Icon className="w-4 h-4 text-[#c9a84c] mt-0.5 flex-shrink-0" />
            <span className="min-w-0">
              <span className="text-white text-xs font-bold block truncate">{h.name}</span>
              <span className="text-[11px] text-[#777] block">
                {h.kind} {h.distanceKm != null ? `· ${h.distanceKm} km walk` : ''} · maps
              </span>
              {h.note && <span className="text-[11px] text-[#888] block">{h.note}</span>}
            </span>
          </a>
        );
      })}
    </div>
  );
}
