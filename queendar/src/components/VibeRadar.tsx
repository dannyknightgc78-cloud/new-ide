import { useState } from 'react';
import { MapPin, TrendingUp, Shield, Music, Coffee, ChevronDown, UtensilsCrossed, Wine } from 'lucide-react';

type VenueTag = {
  label: string;
  icon: React.ReactNode;
};

type Neighborhood = {
  name: string;
  safetyScore: number;
  description: string;
  venueTags: VenueTag[];
};

type City = {
  name: string;
  country: string;
  safetyScore: number;
  trend: 'up' | 'stable' | 'down';
  neighborhoods: Neighborhood[];
};

const CITIES: City[] = [
  {
    name: 'Berlin',
    country: 'Germany',
    safetyScore: 95,
    trend: 'up',
    neighborhoods: [
      {
        name: 'Schöneberg',
        safetyScore: 96,
        description: 'The historic heart of Berlin\'s queer scene, home to legendary bars and the annual Pride parade route.',
        venueTags: [
          { label: 'Dance Club', icon: <Music className="w-3 h-3" /> },
          { label: 'Cafe', icon: <Coffee className="w-3 h-3" /> },
          { label: 'Late Night Dining', icon: <UtensilsCrossed className="w-3 h-3" /> },
        ],
      },
      {
        name: 'Kreuzberg',
        safetyScore: 91,
        description: 'Edgy, inclusive, and unapologetically alternative. A haven for queer artists and underground nightlife.',
        venueTags: [
          { label: 'Dance Club', icon: <Music className="w-3 h-3" /> },
          { label: 'Cocktail Bar', icon: <Wine className="w-3 h-3" /> },
          { label: 'Cafe', icon: <Coffee className="w-3 h-3" /> },
        ],
      },
      {
        name: 'Friedrichshain',
        safetyScore: 88,
        description: 'Raw energy and warehouse parties. The epicenter of Berlin\'s techno and queer club culture.',
        venueTags: [
          { label: 'Dance Club', icon: <Music className="w-3 h-3" /> },
          { label: 'Late Night Dining', icon: <UtensilsCrossed className="w-3 h-3" /> },
          { label: 'Cocktail Bar', icon: <Wine className="w-3 h-3" /> },
        ],
      },
    ],
  },
  {
    name: 'Barcelona',
    country: 'Spain',
    safetyScore: 87,
    trend: 'stable',
    neighborhoods: [
      {
        name: 'Eixample',
        safetyScore: 92,
        description: 'Known as "Gaixample" — Barcelona\'s vibrant LGBTQ+ district packed with inclusive bars and clubs.',
        venueTags: [
          { label: 'Dance Club', icon: <Music className="w-3 h-3" /> },
          { label: 'Cocktail Bar', icon: <Wine className="w-3 h-3" /> },
          { label: 'Cafe', icon: <Coffee className="w-3 h-3" /> },
        ],
      },
      {
        name: 'El Raval',
        safetyScore: 78,
        description: 'Bohemian and diverse. Great queer-friendly spots but stay alert at night in quieter side streets.',
        venueTags: [
          { label: 'Cafe', icon: <Coffee className="w-3 h-3" /> },
          { label: 'Late Night Dining', icon: <UtensilsCrossed className="w-3 h-3" /> },
          { label: 'Cocktail Bar', icon: <Wine className="w-3 h-3" /> },
        ],
      },
      {
        name: 'Poblenou',
        safetyScore: 85,
        description: 'The creative district — emerging queer spaces, beach proximity, and a growing inclusive scene.',
        venueTags: [
          { label: 'Cafe', icon: <Coffee className="w-3 h-3" /> },
          { label: 'Dance Club', icon: <Music className="w-3 h-3" /> },
          { label: 'Late Night Dining', icon: <UtensilsCrossed className="w-3 h-3" /> },
        ],
      },
    ],
  },
  {
    name: 'London',
    country: 'United Kingdom',
    safetyScore: 89,
    trend: 'up',
    neighborhoods: [
      {
        name: 'Soho',
        safetyScore: 93,
        description: 'London\'s iconic queer epicenter — legendary bars, cabaret venues, and a 24/7 inclusive atmosphere.',
        venueTags: [
          { label: 'Dance Club', icon: <Music className="w-3 h-3" /> },
          { label: 'Cocktail Bar', icon: <Wine className="w-3 h-3" /> },
          { label: 'Late Night Dining', icon: <UtensilsCrossed className="w-3 h-3" /> },
        ],
      },
      {
        name: 'Vauxhall',
        safetyScore: 90,
        description: 'The powerhouse of London\'s late-night queer club scene — dark rooms, mega clubs, and after-hours.',
        venueTags: [
          { label: 'Dance Club', icon: <Music className="w-3 h-3" /> },
          { label: 'Cocktail Bar', icon: <Wine className="w-3 h-3" /> },
          { label: 'Cafe', icon: <Coffee className="w-3 h-3" /> },
        ],
      },
      {
        name: 'Dalston',
        safetyScore: 82,
        description: 'East London\'s queer-artsy hub — drag, indie nights, and a fiercely inclusive community spirit.',
        venueTags: [
          { label: 'Cafe', icon: <Coffee className="w-3 h-3" /> },
          { label: 'Dance Club', icon: <Music className="w-3 h-3" /> },
          { label: 'Late Night Dining', icon: <UtensilsCrossed className="w-3 h-3" /> },
        ],
      },
    ],
  },
];

function SafetyGauge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const color = score >= 85 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const glowColor = score >= 85 ? 'rgba(34,197,94,0.25)' : score >= 60 ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)';

  const radius = size === 'lg' ? 32 : size === 'md' ? 24 : 18;
  const strokeWidth = size === 'lg' ? 5 : size === 'md' ? 4 : 3;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  const svgSize = (radius + strokeWidth) * 2;
  const fontSize = size === 'lg' ? 'text-lg' : size === 'md' ? 'text-sm' : 'text-[10px]';

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: svgSize, height: svgSize }}>
      <svg width={svgSize} height={svgSize} className="-rotate-90">
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="#1a1a1a"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)',
            filter: `drop-shadow(0 0 8px ${glowColor})`,
          }}
        />
      </svg>
      <span className={`absolute font-black tabular-nums ${fontSize}`} style={{ color }}>
        {score}
      </span>
    </div>
  );
}

function CityCard({ city }: { city: City }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#0e0e0e] rounded-2xl border border-[#1c1c1c] overflow-hidden transition-all duration-300">
      {/* City header — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-[#111111]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#141414] border border-[#1e1e1e] flex items-center justify-center">
            <MapPin className="w-4 h-4 text-[#c9a84c]" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">{city.name}</p>
            <p className="text-[#555555] text-xs">{city.country}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {city.trend === 'up' && (
            <div className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-lg">
              <TrendingUp className="w-3 h-3" />
              <span className="text-[10px] font-bold">UP</span>
            </div>
          )}
          {city.trend === 'stable' && (
            <div className="flex items-center gap-1 text-[#777777] bg-[#1a1a1a] px-2 py-0.5 rounded-lg">
              <Shield className="w-3 h-3" />
              <span className="text-[10px] font-bold">STABLE</span>
            </div>
          )}
          <SafetyGauge score={city.safetyScore} size="md" />
          <ChevronDown
            className={`w-4 h-4 text-[#444444] transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* City safety bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-[#555555] uppercase tracking-wider font-semibold">City Safety Score</span>
          <span className="text-[10px] text-[#777777] font-bold tabular-nums">{city.safetyScore}/100</span>
        </div>
        <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${city.safetyScore}%`,
              background: city.safetyScore >= 85
                ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                : city.safetyScore >= 60
                ? 'linear-gradient(90deg, #a16207, #f59e0b)'
                : 'linear-gradient(90deg, #b91c1c, #ef4444)',
              boxShadow: city.safetyScore >= 85 ? '0 0 8px rgba(34,197,94,0.4)' : city.safetyScore >= 60 ? '0 0 8px rgba(245,158,11,0.3)' : undefined,
              transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </div>
      </div>

      {/* Expanded neighborhoods */}
      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out ${
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-[#1c1c1c] px-3 py-3 space-y-2.5">
          <p className="text-[10px] text-[#444444] uppercase tracking-wider font-semibold px-1">
            Neighborhoods
          </p>
          {city.neighborhoods.map((hood, i) => (
            <div
              key={hood.name}
              className="bg-[#0a0a0a] border border-[#181818] rounded-xl px-4 py-3.5 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-bold">{hood.name}</p>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
                      style={{
                        color: hood.safetyScore >= 85 ? '#22c55e' : '#f59e0b',
                        background: hood.safetyScore >= 85 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                      }}
                    >
                      {hood.safetyScore}
                    </span>
                  </div>
                  <p className="text-[#555555] text-xs mt-1 leading-relaxed">{hood.description}</p>

                  {/* Venue tags */}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {hood.venueTags.map((tag) => (
                      <button
                        key={tag.label}
                        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-[#111111] border border-[#222222] text-[#888888] hover:text-[#c9a84c] hover:border-[#c9a84c]/30 hover:bg-[#c9a84c]/5 transition-all active:scale-95"
                      >
                        {tag.icon}
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>

                <SafetyGauge score={hood.safetyScore} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VibeRadar() {
  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-2 pb-4">
        <h2 className="text-xl font-bold text-white">Vibe Radar</h2>
        <p className="text-[#555555] text-sm mt-0.5">Real-time safety intelligence for your community</p>
      </div>

      {/* City cards */}
      <div className="space-y-3 px-4">
        {CITIES.map((city) => (
          <CityCard key={city.name} city={city} />
        ))}
      </div>
    </div>
  );
}
