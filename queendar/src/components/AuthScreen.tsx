import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Crown, Eye, EyeOff, Loader2 } from 'lucide-react';

type Mode = 'login' | 'signup';

type Props = {
  onGuest?: () => void;
};

export default function AuthScreen({ onGuest }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow blobs */}
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#7c3aed]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-100px] w-[340px] h-[340px] rounded-full bg-[#c9a84c]/8 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#c9a84c] to-[#e8c96a] flex items-center justify-center mb-4 shadow-[0_0_32px_rgba(201,168,76,0.35)]">
            <Crown className="w-8 h-8 text-[#080808]" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Queendar</h1>
          <p className="text-sm text-[#c9a84c] mt-1 font-medium tracking-wide">
            You have radar. We have Queendar.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-[#111111] border border-[#222222] p-1 mb-6">
          {(['login', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === m
                  ? 'bg-[#7c3aed] text-white shadow-[0_0_14px_rgba(124,58,237,0.4)]'
                  : 'text-[#666666] hover:text-white'
              }`}
            >
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. glitterqueen"
                required
                className="w-full bg-[#111111] border border-[#272727] rounded-xl px-4 py-3 text-white placeholder-[#444444] text-sm focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/50 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-[#111111] border border-[#272727] rounded-xl px-4 py-3 text-white placeholder-[#444444] text-sm focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-[#111111] border border-[#272727] rounded-xl px-4 py-3 pr-11 text-white placeholder-[#444444] text-sm focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-[#c9a84c] to-[#e8c96a] text-[#080808] hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_0_24px_rgba(201,168,76,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <p className="text-center text-[#444444] text-xs mt-6">
          By continuing you agree to our{' '}
          <span className="text-[#c9a84c] cursor-pointer hover:underline">Terms</span> and{' '}
          <span className="text-[#c9a84c] cursor-pointer hover:underline">Privacy Policy</span>.
        </p>

        {/* Guest bypass */}
        <div className="flex items-center gap-3 mt-5">
          <div className="flex-1 h-px bg-[#1e1e1e]" />
          <span className="text-[11px] text-[#333333] font-semibold uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-[#1e1e1e]" />
        </div>
        <button
          onClick={onGuest}
          className="w-full py-3 text-[#555555] hover:text-[#888888] text-sm font-medium transition-colors"
        >
          Explore as Guest
        </button>
      </div>
    </div>
  );
}
