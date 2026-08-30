import { useEffect, useState } from 'react';
import { flushDistressQueue, nextRetryAt, queuedDistress, subscribeQueue } from '../lib/distress-queue';

function remain(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000));
}

export default function OfflineBar() {
  const [online, setOnline] = useState(navigator.onLine);
  const [n, setN] = useState(queuedDistress().length);
  const [retry, setRetry] = useState(nextRetryAt());
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const stop = subscribeQueue((items) => setN(items.length));
    const onRetry = (e: Event) => setRetry((e as CustomEvent<number>).detail || nextRetryAt());
    window.addEventListener('queendar-retry', onRetry);
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('queendar-retry', onRetry);
      window.clearInterval(t);
      stop();
    };
  }, []);

  if (n === 0) return null;

  const secs = remain(retry - now);
  const label = !online
    ? `Offline — SOS queued. Sends when data returns. Retry ${secs}s. Voice call still works.`
    : busy
      ? 'Sending queued SOS…'
      : `Alert queued — retry in ${secs}s. Tap to send now.`;

  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true);
        await flushDistressQueue();
        setN(queuedDistress().length);
        setRetry(nextRetryAt());
        setBusy(false);
      }}
      className="w-full text-left px-3 py-2.5 bg-[#c9a84c] text-[#080808] border-b border-[#a88b2e]"
    >
      <p className="text-[10px] uppercase tracking-wider font-black">{online ? 'Waiting to send' : 'Offline — alert queued'}</p>
      <p className="text-[12px] font-bold leading-snug mt-0.5">{label}</p>
    </button>
  );
}
