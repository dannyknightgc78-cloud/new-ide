import { Crown, ArrowLeft } from 'lucide-react';

type Kind = 'terms' | 'privacy';

const TERMS = `Queendar is a travel safety companion for LGBTQ+ people. By using queendar.com you agree to use it for personal safety, not to harass anyone, and not to treat AI venue scores as legal, medical, or police advice.

QueenDar is not an emergency dispatch service. For a real emergency, call the local number shown in the app (112, 999, 911, or the GPS-matched equivalent). Quiet timers and SOS texts notify people you choose — they do not call police for you.

Accounts are yours. Do not share your password. Guest mode stores nothing on our servers. Paid Plus, if offered, renews monthly until you cancel through Stripe.

We may suspend accounts that abuse SOS, spam scans, or impersonate others. The service is provided as-is. Gran Canaria nightlife changes — always use your own judgement.`;

const PRIVACY = `Queendar stores your account, encrypted Crown Log entries, AI scans, SOS/check-ins, and trusted contacts on our database host (cloudit2). Passwords are hashed. Journal text is encrypted at rest with a server key tied to your account.

Location is only sent when you tap radar GPS, check-in, SOS, or start a quiet timer. A signed-in quiet timer is also stored on the server so it can still fire if the phone sleeps. We do not sell personal data. AI scans go to our GPU for a safety card, then the result can be saved to your account.

Delete account in Settings to wipe your rows. Guest mode keeps data in this browser only. Contact dannyknightgc78@gmail.com for data requests.`;

export default function Legal({ kind, onBack }: { kind: Kind; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#080808] text-white max-w-lg mx-auto px-5 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-[#888888] text-sm mb-8 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c9a84c] to-[#e8c96a] flex items-center justify-center">
          <Crown className="w-5 h-5 text-[#080808]" />
        </div>
        <h1 className="text-2xl font-bold">{kind === 'terms' ? 'Terms' : 'Privacy'}</h1>
      </div>
      <p className="text-[#999999] text-sm leading-relaxed whitespace-pre-wrap">{kind === 'terms' ? TERMS : PRIVACY}</p>
    </div>
  );
}
