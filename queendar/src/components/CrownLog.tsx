import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { CrownLog } from '../lib/supabase';
import { Plus, Lock, MapPin, Smile, Trash2, X, Loader2, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const MOODS = ['✨ Radiant', '🔥 Fierce', '😌 Chill', '😤 On Guard', '💜 Grateful', '😰 Uneasy'];

type Props = { userId: string };

export default function CrownLog({ userId }: Props) {
  const [logs, setLogs] = useState<CrownLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [userId]);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crown_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setLogs(data ?? []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    await supabase.from('crown_logs').insert({
      user_id: userId,
      title: title.trim(),
      body: body.trim(),
      mood,
      location: location.trim(),
    });
    setTitle('');
    setBody('');
    setMood('');
    setLocation('');
    setShowForm(false);
    setSaving(false);
    fetchLogs();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from('crown_logs').delete().eq('id', id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    setDeletingId(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="px-4 pb-8">
      {/* Header */}
      <div className="pt-2 pb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Crown Log</h2>
          <p className="text-[#555555] text-sm mt-0.5">Your private, encrypted safety journal</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-[#c9a84c] to-[#e8c96a] text-[#080808] text-xs font-bold px-3.5 py-2 rounded-xl hover:opacity-90 active:scale-[0.97] transition-all shadow-[0_0_16px_rgba(201,168,76,0.3)]"
        >
          <Plus className="w-3.5 h-3.5" />
          New Log
        </button>
      </div>

      {/* Privacy badge */}
      <div className="flex items-center gap-2 bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-3.5 py-2.5 mb-4">
        <Lock className="w-3.5 h-3.5 text-[#c9a84c]" />
        <p className="text-xs text-[#666666]">
          Entries are private and only visible to you. Never shared.
        </p>
      </div>

      {/* New entry form */}
      {showForm && (
        <div className="bg-[#0e0e0e] border border-[#7c3aed]/40 rounded-2xl p-4 mb-4 space-y-3 shadow-[0_0_32px_rgba(124,58,237,0.1)]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-white">New Entry</p>
            <button onClick={() => setShowForm(false)} className="text-[#555555] hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Entry title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#111111] border border-[#272727] rounded-xl px-4 py-2.5 text-white placeholder-[#444444] text-sm focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/50 transition-colors"
          />

          <textarea
            placeholder="Write your log, notes, or safety check-in..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full bg-[#111111] border border-[#272727] rounded-xl px-4 py-2.5 text-white placeholder-[#444444] text-sm focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/50 transition-colors resize-none"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-[#555555] uppercase tracking-wider font-semibold mb-1">
                Mood
              </label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full bg-[#111111] border border-[#272727] rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-[#7c3aed] transition-colors appearance-none"
              >
                <option value="">Select mood</option>
                {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#555555] uppercase tracking-wider font-semibold mb-1">
                Location (optional)
              </label>
              <input
                type="text"
                placeholder="City or venue..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-[#111111] border border-[#272727] rounded-xl px-3 py-2.5 text-white placeholder-[#444444] text-xs focus:outline-none focus:border-[#7c3aed] transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !body.trim()}
            className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-[#7c3aed] to-[#9d5cf5] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Entry'}
          </button>
        </div>
      )}

      {/* Log entries */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#444444] animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#1e1e1e] flex items-center justify-center mb-4">
            <BookOpen className="w-6 h-6 text-[#333333]" />
          </div>
          <p className="text-white font-semibold text-sm">No entries yet</p>
          <p className="text-[#444444] text-xs mt-1 max-w-[220px] leading-relaxed">
            Start recording your safety check-ins and personal logs.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 text-[#c9a84c] text-xs font-semibold hover:opacity-80 transition-opacity flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Create your first entry
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="w-full flex items-start gap-3 px-4 py-4 text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-[#141414] border border-[#1e1e1e] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Smile className="w-4 h-4 text-[#c9a84c]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{log.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[#444444] text-xs">{formatDate(log.created_at)}</span>
                    {log.mood && (
                      <span className="text-[#555555] text-xs">{log.mood}</span>
                    )}
                    {log.location && (
                      <span className="flex items-center gap-0.5 text-[#444444] text-xs">
                        <MapPin className="w-2.5 h-2.5" />{log.location}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[#444444] flex-shrink-0 mt-1">
                  {expandedId === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {expandedId === log.id && (
                <div className="px-4 pb-4 border-t border-[#1a1a1a] pt-3">
                  <p className="text-[#999999] text-sm leading-relaxed whitespace-pre-wrap">{log.body}</p>
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={() => handleDelete(log.id)}
                      disabled={deletingId === log.id}
                      className="flex items-center gap-1.5 text-red-600 hover:text-red-500 text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {deletingId === log.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Delete entry
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
