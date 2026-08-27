import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import AuthScreen from './components/AuthScreen';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import CircularStickyQR from './components/CircularStickyQR';

type AppState = 'loading' | 'auth' | 'onboarding' | 'dashboard';

const ONBOARDING_KEY = 'queendar_onboarding_done';
const GUEST_USER_ID = 'guest';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [appState, setAppState] = useState<AppState>('loading');
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        const done = localStorage.getItem(ONBOARDING_KEY);
        setAppState(done ? 'dashboard' : 'onboarding');
      } else {
        setAppState('auth');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setIsGuest(false);
        const done = localStorage.getItem(ONBOARDING_KEY);
        setAppState(done ? 'dashboard' : 'onboarding');
      } else if (!isGuest) {
        setAppState('auth');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setAppState('dashboard');
  };

  const handleGuest = () => {
    setIsGuest(true);
    localStorage.setItem(ONBOARDING_KEY, '1');
    setAppState('dashboard');
  };

  if (appState === 'loading') {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#c9a84c] to-[#e8c96a] flex items-center justify-center shadow-[0_0_24px_rgba(201,168,76,0.35)] animate-pulse">
            <svg className="w-6 h-6 text-[#080808]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l7 4 7-4M5 3v14l7 4 7-4V3" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  let screen = <AuthScreen onGuest={handleGuest} />;
  if (appState === 'onboarding') screen = <Onboarding onComplete={handleOnboardingComplete} />;
  else if (appState === 'dashboard') {
    const userId = isGuest ? GUEST_USER_ID : session?.user.id;
    screen = userId ? <Dashboard userId={userId} /> : <AuthScreen onGuest={handleGuest} />;
  }

  return (
    <>
      {screen}
      <CircularStickyQR />
    </>
  );
}
