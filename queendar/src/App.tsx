import { useEffect, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Legal from './components/Legal';
import { clearSession, getUser, setSession, type QueenUser } from './lib/api';
import { watchArrival } from './lib/arrival';
import { cacheContacts, silentSos } from './lib/silent-sos';
import { startWatchGuard } from './lib/watch';
import { startDistressFlush } from './lib/distress-queue';
import { loadLocalIce, normalizeIce } from './lib/emergency';

type AppState = 'auth' | 'onboarding' | 'dashboard' | 'legal';
const ONBOARDING_KEY = 'queendar_onboarding_v2';

export default function App() {
  useEffect(() => {
    const stopArrival = watchArrival();
    cacheContacts();
    const stopFlush = startDistressFlush();
    const stopWatch = startWatchGuard((kind) => {
      silentSos({
        reason: 'timer',
        ice: normalizeIce(getUser()?.ice) || loadLocalIce(),
        skipDeviceSms: kind === 'backend',
      });
    });
    return () => {
      stopArrival();
      stopWatch();
      stopFlush();
    };
  }, []);
  const saved = getUser();
  const [appState, setAppState] = useState<AppState>(() => {
    if (!saved) return 'auth';
    return localStorage.getItem(ONBOARDING_KEY) ? 'dashboard' : 'onboarding';
  });
  const [legal, setLegal] = useState<'terms' | 'privacy'>('terms');
  const [isGuest, setIsGuest] = useState(false);
  const [owner, setOwner] = useState<QueenUser | null>(saved);

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setAppState('dashboard');
  };

  const handleOwner = (user: QueenUser) => {
    setSession(user, user.token);
    setOwner(user);
    setIsGuest(false);
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setAppState('onboarding');
    } else {
      setAppState('dashboard');
    }
  };

  if (appState === 'legal') {
    return <Legal kind={legal} onBack={() => setAppState(owner || isGuest ? 'dashboard' : 'auth')} />;
  }
  if (appState === 'auth') {
    return (
      <AuthScreen
        onGuest={() => {
          clearSession();
          setIsGuest(true);
          setAppState('onboarding');
        }}
        onOwner={handleOwner}
        onLegal={(kind) => { setLegal(kind); setAppState('legal'); }}
      />
    );
  }
  if (appState === 'onboarding') {
    return (
      <Onboarding
        guest={isGuest || !owner}
        owner={owner}
        onUser={(user) => { setOwner(user); setSession(user); }}
        onComplete={finishOnboarding}
      />
    );
  }
  if (owner) {
    return (
      <Dashboard
        userId={owner.id || 'owner'}
        owner={owner}
        onUser={(user) => { setOwner(user); setSession(user); }}
      />
    );
  }
  if (isGuest) return <Dashboard userId="guest" guest />;
  return <AuthScreen onOwner={handleOwner} onGuest={() => { setIsGuest(true); setAppState('onboarding'); }} />;
}
