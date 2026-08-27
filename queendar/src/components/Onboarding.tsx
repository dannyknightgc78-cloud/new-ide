import { Crown, Shield, Scan, BookOpen, ChevronRight } from 'lucide-react';

type Props = { onComplete: () => void };

const FEATURES = [
  {
    icon: <Shield className="w-5 h-5" />,
    color: '#22c55e',
    title: 'Vibe Radar',
    desc: 'Real-time city and neighborhood safety scores curated for the queer community.',
  },
  {
    icon: <Scan className="w-5 h-5" />,
    color: '#7c3aed',
    title: 'AI Scan',
    desc: 'Instantly analyze any venue name or event flyer for community safety intelligence.',
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    color: '#c9a84c',
    title: 'Crown Log',
    desc: 'A private, encrypted journal for personal notes and community safety check-ins.',
  },
];

export default function Onboarding({ onComplete }: Props) {
  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[#7c3aed]/8 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full bg-[#c9a84c]/6 blur-[100px] pointer-events-none" />

      {/* Gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c]/60 to-transparent" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo block */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#c9a84c] to-[#e8c96a] flex items-center justify-center shadow-[0_0_48px_rgba(201,168,76,0.4)]">
              <Crown className="w-10 h-10 text-[#080808]" strokeWidth={2.5} />
            </div>
            <div className="absolute -inset-2 rounded-3xl border border-[#c9a84c]/20 animate-pulse" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">Queendar</h1>
          <p className="text-[#c9a84c] font-semibold text-sm mt-2 tracking-wide text-center">
            You have radar. We have Queendar.
          </p>
          <p className="text-[#555555] text-sm mt-3 text-center leading-relaxed max-w-[280px]">
            The advanced travel safety radar and nightlife companion built for the LGBTQ+ community.
          </p>
        </div>

        {/* Feature cards */}
        <div className="space-y-3 mb-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-4 bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl px-4 py-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${f.color}18`, color: f.color }}
              >
                {f.icon}
              </div>
              <div>
                <p className="text-white text-sm font-bold">{f.title}</p>
                <p className="text-[#555555] text-xs mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onComplete}
          className="w-full py-4 rounded-2xl font-black text-base tracking-wide bg-gradient-to-r from-[#c9a84c] to-[#e8c96a] text-[#080808] hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_0_32px_rgba(201,168,76,0.35)] flex items-center justify-center gap-2"
        >
          Enter Queendar
          <ChevronRight className="w-5 h-5" />
        </button>

        <p className="text-[#333333] text-xs text-center mt-4">
          Safe spaces for every queen, everywhere.
        </p>
      </div>
    </div>
  );
}
