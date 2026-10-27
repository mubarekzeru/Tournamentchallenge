import React, { useState, useEffect } from 'react';
import { X, Sparkles, Search, ExternalLink, Globe, ArrowRight, Bot, Shield, Loader2 } from 'lucide-react';
import { Player, MatchResult } from '../types/tournament';

interface WebSource {
  uri: string;
  title: string;
}

interface AIScoutModalProps {
  isOpen: boolean;
  players: Player[];
  results: MatchResult[];
  onClose: () => void;
}

export const AIScoutModal: React.FC<AIScoutModalProps> = ({
  isOpen,
  players,
  results,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [sources, setSources] = useState<WebSource[]>([]);
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Prevent background layer web scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const quickPrompts = [
    'Current eFootball meta formations & best tactics update',
    'Best tactics & instructions to counter Quick Counter in eFootball',
    'Ethiopian esports and gaming tournaments community updates',
    'Tactics advice for high-possession game style in eFootball',
  ];

  const handleRunScout = async (promptText: string) => {
    if (!promptText.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    setSources([]);
    setSearchQueries([]);

    // Context from current tournament
    const topPlayer = players[0]?.team || 'Bilal FC';
    const tournamentContext = `Current Tournament: Ethiopian Esports League eFootball Challenge.
Number of active teams: ${players.length}.
Top ranked team: ${topPlayer} with ${players[0]?.points || 0} points.
Total matches recorded: ${results.length}.`;

    try {
      const res = await fetch('/api/ai/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          context: tournamentContext,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch scouting report');
      }

      setReport(data.text);
      setSources(data.sources || []);
      setSearchQueries(data.searchQueries || []);
    } catch (err: any) {
      setError(err.message || 'Error executing search-grounded scout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050842]/85 p-4 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative my-8 w-full max-w-2xl rounded-2xl border-2 border-[#3ce7ff] bg-gradient-to-b from-[#0a0f52] to-[#040632] p-6 shadow-[0_0_40px_rgba(60,231,255,0.3)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#3ce7ff]/20 pb-4 pr-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#eaff28] bg-[#071056] text-[#eaff28] shadow-[0_0_15px_rgba(234,255,40,0.3)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-sports text-xl text-white">AI Esports Tactics Scout</h3>
                <span className="flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-950/60 px-2 py-0.5 text-[9px] font-extrabold uppercase text-emerald-300">
                  <Globe className="h-2.5 w-2.5" />
                  <span>Google Search Grounded</span>
                </span>
              </div>
              <p className="text-xs text-[#8e9bd4]">
                Grounded with live Google Search via Gemini 3.5 Flash for verified up-to-date meta & intelligence.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-[#8e9bd4] transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Input box */}
        <div className="mt-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRunScout(query);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e9bd4]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask eFootball meta, formation counters, or esports news..."
                className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#060a48] py-2.5 pl-9 pr-4 text-xs text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none focus:ring-1 focus:ring-[#eaff28]"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-[#eaff28] px-4 py-2 text-xs font-extrabold uppercase text-[#050842] shadow-md transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              <span>Scout</span>
            </button>
          </form>

          {/* Quick presets */}
          <div className="mt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#b9c4f0]">
              Trending Topics:
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {quickPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setQuery(p);
                    handleRunScout(p);
                  }}
                  className="rounded-full border border-[#3ce7ff]/30 bg-[#060a48]/80 px-2.5 py-1 text-[10px] text-[#bcc7fa] transition-colors hover:border-[#eaff28] hover:text-[#eaff28]"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[#3ce7ff]/20 bg-[#060a48]/50 p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#eaff28]" />
            <p className="font-sports mt-3 text-sm uppercase tracking-wide text-white">
              Searching Google & Analyzing eFootball Intelligence...
            </p>
            <p className="mt-1 text-xs text-[#8e9bd4]">
              Grounding analysis with live web search results via Gemini 3.5 Flash
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Scout Result Report */}
        {report && (
          <div className="mt-5 space-y-4 max-h-80 overflow-y-auto pr-1">
            <div className="rounded-xl border border-[#3ce7ff]/30 bg-[#060a48] p-4 text-xs leading-relaxed text-[#e0e7ff] shadow-inner whitespace-pre-line">
              {report}
            </div>

            {/* Google Search Grounding Sources */}
            {sources.length > 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-[#050842] p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  <Globe className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Verified Google Search Sources ({sources.length})</span>
                </div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {sources.map((s, idx) => (
                    <a
                      key={`${s.uri}-${idx}`}
                      href={s.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border border-[#3ce7ff]/20 bg-[#071056] p-2 text-[10px] text-[#bcc7fa] transition-colors hover:border-[#eaff28] hover:text-white"
                    >
                      <span className="truncate pr-2 font-medium">{s.title || s.uri}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-[#3ce7ff]" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
