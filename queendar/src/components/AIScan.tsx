import { useEffect, useRef, useState } from 'react';
import { Search, Upload, ShieldCheck, AlertTriangle, Star, Loader2, X, Image as ImageIcon } from 'lucide-react';
import { api, getToken } from '../lib/api';

type ScanResult = {
  id?: string;
  venueName: string;
  safetyRating: number;
  greenFlags: string[];
  yellowFlags: string[];
  summary: string;
  stars?: number;
  created_at?: string;
};

const ratingColor = (r: number) => (r >= 80 ? '#22c55e' : r >= 60 ? '#eab308' : '#ef4444');

export default function AIScan() {
  const [venueName, setVenueName] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [stars, setStars] = useState(0);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const signedIn = Boolean(getToken());

  const loadHistory = async () => {
    if (!getToken()) return;
    try {
      const data = await api<{ scans: ScanResult[] }>('/api/scans');
      setHistory(data.scans || []);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleScan = async () => {
    if (!venueName.trim() && !uploadedFile) return;
    setScanning(true);
    setResult(null);
    setError('');
    setStars(0);
    try {
      const payload: { venueName: string; image?: string } = { venueName: venueName.trim() };
      if (uploadedFile) {
        payload.image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Could not read that image.'));
          reader.readAsDataURL(uploadedFile);
        });
      }
      const data = await api<ScanResult>('/api/ai/scan', {
        method: 'POST',
        timeoutMs: 180000,
        body: JSON.stringify(payload),
      });
      setResult(data);
      loadHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const rate = async (n: number) => {
    setStars(n);
    if (result?.id && signedIn) {
      await api(`/api/scans/${result.id}/rate`, { method: 'POST', body: JSON.stringify({ stars: n }) });
      loadHistory();
    }
  };

  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="pt-2">
        <h2 className="text-xl font-bold text-white">AI Scan</h2>
        <p className="text-[#555555] text-sm mt-0.5">Scan a venue or flyer. Signed-in scans are saved.</p>
      </div>
      <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
          <input value={venueName} onChange={(e) => setVenueName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleScan()} placeholder="e.g. Yumbo Centre, Maspalomas" className="w-full bg-[#111] border border-[#272727] rounded-xl pl-10 pr-4 py-3 text-white text-sm" />
        </div>
        {uploadedFile ? (
          <div className="flex items-center gap-3 bg-[#111] border border-[#272727] rounded-xl px-4 py-3">
            <ImageIcon className="w-4 h-4 text-[#c9a84c]" />
            <span className="text-sm text-white truncate flex-1">{uploadedFile.name}</span>
            <button onClick={() => { setUploadedFile(null); if (fileRef.current) fileRef.current.value = ''; }}><X className="w-4 h-4 text-[#555]" /></button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="w-full border border-dashed border-[#2a2a2a] rounded-xl py-4 text-sm text-[#555] flex flex-col items-center gap-1">
            <Upload className="w-5 h-5" /> Tap to upload flyer
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && setUploadedFile(e.target.files[0])} />
        <button onClick={handleScan} disabled={scanning || (!venueName.trim() && !uploadedFile)} className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#7c3aed] to-[#9d5cf5] text-white disabled:opacity-40 flex items-center justify-center gap-2">
          {scanning ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</> : 'Scan Venue'}
        </button>
        {error && <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}
      </div>

      {result && (
        <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl overflow-hidden">
          <div className="px-5 py-5 flex justify-between gap-4">
            <div>
              <p className="text-[11px] text-[#555] uppercase font-semibold">Scan result</p>
              <h3 className="text-lg font-bold text-white">{result.venueName}</h3>
            </div>
            <span className="text-3xl font-black" style={{ color: ratingColor(result.safetyRating) }}>{result.safetyRating}</span>
          </div>
          <p className="px-5 pb-4 text-sm text-[#888]">{result.summary}</p>
          <div className="px-5 pb-4 space-y-2">
            {result.greenFlags?.map((flag) => (
              <div key={flag} className="flex gap-2 text-sm text-[#aaa]"><ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />{flag}</div>
            ))}
            {result.yellowFlags?.map((flag) => (
              <div key={flag} className="flex gap-2 text-sm text-[#aaa]"><AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />{flag}</div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-[#1c1c1c] flex items-center justify-between">
            <p className="text-sm text-[#666]">Was this helpful?</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => rate(n)} className={n <= stars ? 'text-[#c9a84c]' : 'text-[#333]'}>
                  <Star className="w-5 h-5" fill={n <= stars ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-[#555] font-bold mb-2">Your scans</p>
          <div className="space-y-2">
            {history.slice(0, 8).map((s) => (
              <button key={s.id || s.venueName} onClick={() => { setResult(s); setStars(s.stars || 0); }} className="w-full text-left bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-4 py-3 flex justify-between">
                <span className="text-sm text-white truncate">{s.venueName}</span>
                <span className="text-sm font-bold" style={{ color: ratingColor(Number(s.safetyRating) || 0) }}>{s.safetyRating}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
