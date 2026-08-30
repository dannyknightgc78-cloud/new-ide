import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { api, setSession, type QueenUser } from '../lib/api';
import BrandMark from './BrandMark';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

type Props = {
  onGuest?: () => void;
  onOwner?: (user: QueenUser) => void;
  onLegal?: (kind: 'terms' | 'privacy') => void;
};

export default function AuthScreen({ onGuest, onOwner, onLegal }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const data = await api<{ message?: string; resetToken?: string }>('/api/auth/forgot', {
          method: 'POST',
          body: JSON.stringify({ email: (email || username).trim() }),
        });
        setInfo(data.message || 'Check that inbox.');
        if (data.resetToken) {
          setResetToken(data.resetToken);
          setMode('reset');
          setInfo('Enter a new password. Your one-hour reset code is filled in.');
        }
        return;
      }
      if (mode === 'reset') {
        await api('/api/auth/reset', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken.trim(), password: password.trim() }),
        });
        setMode('login');
        setInfo('Password updated. Sign in.');
        return;
      }
      const form = e.currentTarget as HTMLFormElement;
      const fd = new FormData(form);
      const login = String(fd.get('username') || fd.get('email') || username || email)
        .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .replace(/ñ/gi, 'n')
        .trim();
      const pass = String(fd.get('password') || password)
        .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .replace(/ñ/gi, 'n')
        .trim();
      const data = await api<{ token: string; user: QueenUser }>(
        mode === 'signup' ? '/api/auth/signup' : '/api/auth/login',
        {
          method: 'POST',
          timeoutMs: 12000,
          body: JSON.stringify(
            mode === 'signup'
              ? { username: username.trim(), email: email.trim(), password: pass }
              : { username: login, email: login, password: pass },
          ),
        },
      );
      setSession(data.user, data.token);
      onOwner?.(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-qd-atmosphere flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #c9a84c 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        <BrandMark size="hero" tagline className="mb-10" />

        {(mode === 'login' || mode === 'signup') && (
          <div className="flex rounded-xl bg-[#111111] border border-[#2a2418] p-1 mb-6">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  mode === m
                    ? 'bg-gradient-to-r from-[#c9a84c] to-[#e8c96a] text-[#080808]'
                    : 'text-[#666666]'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              className="w-full bg-[#111] border border-[#272727] rounded-xl px-4 py-3 text-white text-sm focus:border-[#c9a84c] focus:outline-none"
            />
          )}
          {mode !== 'reset' && (
            <input
              name={mode === 'login' ? 'username' : 'email'}
              autoComplete={mode === 'login' ? 'username' : 'email'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={mode === 'login' ? username : email}
              onChange={(e) => (mode === 'login' ? setUsername(e.target.value) : setEmail(e.target.value))}
              placeholder={mode === 'login' ? 'Username or email' : 'Email'}
              required
              className="w-full bg-[#111] border border-[#272727] rounded-xl px-4 py-3 text-white text-sm focus:border-[#c9a84c] focus:outline-none"
            />
          )}
          {mode === 'reset' && (
            <input
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              placeholder="Reset code"
              required
              className="w-full bg-[#111] border border-[#272727] rounded-xl px-4 py-3 text-white text-sm focus:border-[#c9a84c] focus:outline-none"
            />
          )}
          {mode !== 'forgot' && (
            <div className="relative">
              <input
                name="password"
                autoComplete={mode === 'signup' || mode === 'reset' ? 'new-password' : 'current-password'}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'reset' ? 'New password' : 'Password'}
                required
                minLength={6}
                className="w-full bg-[#111] border border-[#272727] rounded-xl px-4 py-3 pr-11 text-white text-sm focus:border-[#c9a84c] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}
          {error && (
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-4 py-3 text-emerald-300 text-sm">
              {info}
            </div>
          )}
          <button
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#c9a84c] to-[#e8c96a] text-[#080808] disabled:opacity-50 flex items-center justify-center gap-2 shadow-gold"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'signup' ? (
              'Create Account'
            ) : mode === 'forgot' ? (
              'Send reset'
            ) : mode === 'reset' ? (
              'Set password'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {mode === 'login' && (
          <button onClick={() => setMode('forgot')} className="w-full mt-3 text-xs text-[#666] hover:text-[#c9a84c]">
            Forgot password?
          </button>
        )}
        {mode !== 'login' && mode !== 'signup' && (
          <button onClick={() => setMode('login')} className="w-full mt-3 text-xs text-[#666]">
            Back to sign in
          </button>
        )}

        <p className="text-center text-[#444444] text-xs mt-6">
          By continuing you agree to our{' '}
          <button type="button" onClick={() => onLegal?.('terms')} className="text-[#c9a84c]">
            Terms
          </button>{' '}
          and{' '}
          <button type="button" onClick={() => onLegal?.('privacy')} className="text-[#c9a84c]">
            Privacy Policy
          </button>
          .
        </p>
        <button
          onClick={onGuest}
          className="w-full py-3 text-[#555555] hover:text-[#c9a84c] text-sm mt-2 transition-colors"
        >
          Explore as Guest
        </button>
      </div>
    </div>
  );
}
