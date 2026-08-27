import { useState, useRef } from 'react';
import { Search, Upload, ShieldCheck, AlertTriangle, Star, Loader2, X, Image as ImageIcon } from 'lucide-react';

type ScanResult = {
  venueName: string;
  safetyRating: number;
  greenFlags: string[];
  yellowFlags: string[];
  summary: string;
};

const MOCK_RESULT: ScanResult = {
  venueName: '',
  safetyRating: 88,
  greenFlags: [
    'Active inclusive door policy verified',
    'Staff trained in anti-harassment protocols',
    'Gender-neutral restrooms available',
  ],
  yellowFlags: [
    'Crowded on weekends — stay aware of surroundings',
  ],
  summary:
    'This venue has a strong track record for LGBTQ+ inclusivity. Community reports are overwhelmingly positive, with dedicated drag nights and visible queer staff. Some reports note high weekend foot traffic — plan accordingly.',
};

export default function AIScan() {
  const [venueName, setVenueName] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleScan = async () => {
    if (!venueName.trim() && !uploadedFile) return;
    setScanning(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 1500));
    setResult({ ...MOCK_RESULT, venueName: venueName.trim() || uploadedFile?.name || 'Scanned Venue' });
    setScanning(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const clearUpload = () => {
    setUploadedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const ratingColor = (r: number) => r >= 80 ? '#22c55e' : r >= 60 ? '#eab308' : '#ef4444';

  return (
    <div className="px-4 pb-8 space-y-5">
      {/* Header */}
      <div className="pt-2 pb-2">
        <h2 className="text-xl font-bold text-white">AI Scan</h2>
        <p className="text-[#555555] text-sm mt-0.5">Scan any venue or flyer for safety intelligence</p>
      </div>

      {/* Input card */}
      <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl p-4 space-y-3">
        {/* Venue name input */}
        <div>
          <label className="block text-[11px] font-semibold text-[#666666] uppercase tracking-wider mb-1.5">
            Venue Name
          </label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444444]" />
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              placeholder="e.g. Hardware Bar, NYC"
              className="w-full bg-[#111111] border border-[#272727] rounded-xl pl-10 pr-4 py-3 text-white placeholder-[#444444] text-sm focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/50 transition-colors"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#1e1e1e]" />
          <span className="text-[11px] text-[#444444] font-semibold uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-[#1e1e1e]" />
        </div>

        {/* File upload */}
        <div>
          <label className="block text-[11px] font-semibold text-[#666666] uppercase tracking-wider mb-1.5">
            Upload Flyer / Photo
          </label>
          {uploadedFile ? (
            <div className="flex items-center gap-3 bg-[#111111] border border-[#272727] rounded-xl px-4 py-3">
              <ImageIcon className="w-4 h-4 text-[#c9a84c] flex-shrink-0" />
              <span className="text-sm text-white truncate flex-1">{uploadedFile.name}</span>
              <button onClick={clearUpload} className="text-[#555555] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-[#2a2a2a] rounded-xl py-5 flex flex-col items-center gap-2 hover:border-[#7c3aed]/60 hover:bg-[#7c3aed]/5 transition-all group"
            >
              <Upload className="w-5 h-5 text-[#444444] group-hover:text-[#7c3aed] transition-colors" />
              <span className="text-sm text-[#555555] group-hover:text-[#888888] transition-colors">
                Tap to upload event flyer or photo
              </span>
              <span className="text-[11px] text-[#333333]">JPG, PNG, WEBP up to 10MB</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Scan button */}
        <button
          onClick={handleScan}
          disabled={scanning || (!venueName.trim() && !uploadedFile)}
          className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-[#7c3aed] to-[#9d5cf5] text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_0_24px_rgba(124,58,237,0.3)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {scanning ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>
          ) : (
            <><Search className="w-4 h-4" /> Scan Venue</>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3 animate-fade-in">
          {/* Rating hero */}
          <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl overflow-hidden">
            <div className="px-5 py-5 border-b border-[#1c1c1c]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] text-[#555555] uppercase tracking-wider font-semibold mb-1">Scan Result</p>
                  <h3 className="text-lg font-bold text-white leading-tight">{result.venueName}</h3>
                </div>
                <div className="flex flex-col items-center bg-[#111111] rounded-2xl px-4 py-3 border border-[#1e1e1e] min-w-[80px]">
                  <span
                    className="text-3xl font-black tabular-nums"
                    style={{ color: ratingColor(result.safetyRating) }}
                  >
                    {result.safetyRating}
                  </span>
                  <span className="text-[10px] text-[#555555] font-semibold mt-0.5">/100</span>
                  <div
                    className="h-1 w-10 rounded-full mt-2"
                    style={{
                      background: `linear-gradient(90deg, ${ratingColor(result.safetyRating)}88, ${ratingColor(result.safetyRating)})`,
                      boxShadow: `0 0 8px ${ratingColor(result.safetyRating)}55`,
                    }}
                  />
                </div>
              </div>

              {/* Score bar */}
              <div className="mt-4">
                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${result.safetyRating}%`,
                      background: `linear-gradient(90deg, ${ratingColor(result.safetyRating)}88, ${ratingColor(result.safetyRating)})`,
                      boxShadow: `0 0 8px ${ratingColor(result.safetyRating)}55`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="px-5 py-4 border-b border-[#1c1c1c]">
              <p className="text-[#888888] text-sm leading-relaxed">{result.summary}</p>
            </div>

            {/* Green flags */}
            <div className="px-5 py-4 border-b border-[#1c1c1c]">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400">
                  {result.greenFlags.length} Green Flag{result.greenFlags.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {result.greenFlags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-sm text-[#aaaaaa]">{flag}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Yellow flags */}
            {result.yellowFlags.length > 0 && (
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-bold text-yellow-400">
                    {result.yellowFlags.length} Caution Note{result.yellowFlags.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {result.yellowFlags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-yellow-950/60 border border-yellow-800/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                      </div>
                      <span className="text-sm text-[#aaaaaa]">{flag}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rate this result */}
          <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl px-5 py-4 flex items-center justify-between">
            <p className="text-sm text-[#666666]">Was this helpful?</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} className="text-[#333333] hover:text-[#c9a84c] transition-colors">
                  <Star className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
