import { useState, useEffect } from 'react';
import type { CrownLogEntry } from '../lib/api';
import { api } from '../lib/api';
import { Plus, Lock, MapPin, Smile, Trash2, X, Loader2, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const MOODS = ['✨ Radiant', '🔥 Fierce', '😌 Chill', '😤 On Guard', '💜 Grateful', '😰 Uneasy'];

type Props = { guest?: boolean };

export default function CrownLog({ guest }: Props) {
  const [logs, setLogs] = useState<CrownLogEntry[]>([]);
  const [loading, setLoading] = useState(!guest);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState('');
  const [location, setLocation] = useState('');

  const fetchLogs = async () => {
    if (guest) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api<{ logs: CrownLogEntry[] }>('/api/logs');
      setLogs(data.logs || []);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [guest]);

  const handleSave = async () => {
    if (!title.trim() || !body.trim() || guest) return;
    setSaving(true);
    try {
      await api('/api/logs', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), body: body.trim(), mood, location: location.trim() }),
      });
      setTitle('');
      setBody('');
      setMood('');
      setLocation('');
      setShowForm(false);
      await fetchLogs();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await api(`/api/logs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setLogs((prev) => prev.filter((l) => l.id !== id));
    setDeletingId(null);
  };

  return (
    <div className="px-4 pb-8">
      <div className="pt-2 pb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Crown Log</h2>
          <p className="text-[#555555] text-sm mt-0.5">Encrypted at rest. Only you can read these entries.</p>
        </div>
        {!guest && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 bg-gradient-to-r from-[#c9a84c] to-[#e8c96a] text-[#080808] text-xs font-bold px-3.5 py-2 rounded-xl">
            <Plus className="w-3.5 h-3.5" /> New Log
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-3.5 py-2.5 mb-4">
        <Lock className="w-3.5 h-3.5 text-[#c9a84c]" />
        <p className="text-xs text-[#666666]">Entries are encrypted on our QueenDar database. Never shared.</p>
      </div>
      {guest && <p className="text-sm text-[#666] text-center py-10">Sign in to keep a private encrypted journal.</p>}
      {showForm && (
        <div className="bg-[#0e0e0e] border border-[#c9a84c]/40 rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white">New Entry</p>
            <button onClick={() => setShowForm(false)} className="text-[#555]"><X className="w-4 h-4" /></button>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Entry title..." className="w-full bg-[#111] border border-[#272727] rounded-xl px-4 py-2.5 text-white text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Write your log or safety check-in..." className="w-full bg-[#111] border border-[#272727] rounded-xl px-4 py-2.5 text-white text-sm resize-none" />
          <div className="grid grid-cols-2 gap-2">
            <select value={mood} onChange={(e) => setMood(e.target.value)} className="bg-[#111] border border-[#272727] rounded-xl px-3 py-2.5 text-white text-xs">
              <option value="">Select mood</option>
              {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or venue..." className="bg-[#111] border border-[#272727] rounded-xl px-3 py-2.5 text-white text-xs" />
          </div>
          <button onClick={handleSave} disabled={saving || !title.trim() || !body.trim()} className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-[#c9a84c] to-[#e8c96a] text-[#080808] disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Entry'}
          </button>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-[#444] animate-spin" /></div>
      ) : !guest && logs.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <BookOpen className="w-6 h-6 text-[#333] mb-3" />
          <p className="text-white font-semibold text-sm">No entries yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl overflow-hidden">
              <button onClick={() => setExpandedId(expandedId === log.id ? null : log.id)} className="w-full flex items-start gap-3 px-4 py-4 text-left">
                <div className="w-8 h-8 rounded-xl bg-[#141414] border border-[#1e1e1e] flex items-center justify-center"><Smile className="w-4 h-4 text-[#c9a84c]" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{log.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-[#444]">
                    <span>{new Date(log.created_at).toLocaleDateString()}</span>
                    {log.mood && <span>{log.mood}</span>}
                    {log.location && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{log.location}</span>}
                  </div>
                </div>
                {expandedId === log.id ? <ChevronUp className="w-4 h-4 text-[#444]" /> : <ChevronDown className="w-4 h-4 text-[#444]" />}
              </button>
              {expandedId === log.id && (
                <div className="px-4 pb-4 border-t border-[#1a1a1a] pt-3">
                  <p className="text-[#999] text-sm whitespace-pre-wrap">{log.body}</p>
                  <button onClick={() => handleDelete(log.id)} disabled={deletingId === log.id} className="flex items-center gap-1.5 text-red-600 text-xs mt-3">
                    {deletingId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
