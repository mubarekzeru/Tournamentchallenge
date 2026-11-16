import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  RefreshCw,
  CheckCircle2,
  Clock,
  Download,
  Image as ImageIcon,
  AlertTriangle,
  Users,
  Sparkles,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { Fixture, MatchResult, Player } from '../types/tournament';

interface TelegramBotEvent {
  id: string;
  timestamp: string;
  type:
    | 'screenshot_recorded'
    | 'screenshot_duplicate'
    | 'screenshot_unmatched'
    | 'matchday_graphic_posted'
    | 'clock_announcement'
    | 'error';
  matchday?: number;
  summary: string;
  detail?: string;
}

interface MatchdayProgressItem {
  matchday: number;
  total: number;
  completed: number;
  isComplete: boolean;
  graphicPosted: boolean;
}

interface TelegramStatusSnapshot {
  configured: boolean;
  pollingActive: boolean;
  botInfo: {
    id: number;
    username: string;
    first_name: string;
  } | null;
  groupChatId: string | number | null;
  groupChatTitle: string;
  autoPostMatchdayGraphic: boolean;
  postedMatchdays: number[];
  sentClockReminders?: string[];
  activeDeadlineEndIso?: string | null;
  recentEvents: TelegramBotEvent[];
  matchdayProgress: MatchdayProgressItem[];
}

interface TelegramBotPanelProps {
  players: Player[];
  fixtures: Fixture[];
  results: MatchResult[];
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const TelegramBotPanel: React.FC<TelegramBotPanelProps> = ({
  results,
  onToast,
}) => {
  const [status, setStatus] = useState<TelegramStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [postingMd, setPostingMd] = useState<number | null>(null);
  const [sendingNotice, setSendingNotice] = useState<'reminder' | 'ended' | null>(null);
  const [groupInput, setGroupInput] = useState('');
  const [autoPost, setAutoPost] = useState(true);

  const fetchStatus = useCallback(async (syncInputs = false) => {
    try {
      const res = await fetch('/api/telegram/status');
      const json = await res.json();
      if (json.success && json.data) {
        const data: TelegramStatusSnapshot = json.data;
        setStatus(data);
        if (syncInputs) {
          setGroupInput(data.groupChatId ? String(data.groupChatId) : '');
          setAutoPost(Boolean(data.autoPostMatchdayGraphic));
        }
      }
    } catch {
      // Ignore transient network failures during polling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus(true);
    const interval = setInterval(() => fetchStatus(false), 15_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Refresh panel promptly whenever live match results change
  useEffect(() => {
    fetchStatus(false);
  }, [results.length, fetchStatus]);

  const handleSaveConfig = async (nextAutoPost?: boolean) => {
    const autoPostVal = nextAutoPost !== undefined ? nextAutoPost : autoPost;
    setSavingConfig(true);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupChatId: groupInput.trim() || null,
          autoPostMatchdayGraphic: autoPostVal,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setStatus(json.data);
        setAutoPost(Boolean(json.data.autoPostMatchdayGraphic));
        if (onToast) onToast('Telegram Group Bot settings updated.', 'success');
      } else if (onToast) {
        onToast(json.error || 'Failed to save Telegram settings.', 'error');
      }
    } catch {
      if (onToast) onToast('Network error saving Telegram settings.', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handlePostMatchday = async (matchday: number) => {
    setPostingMd(matchday);
    try {
      const res = await fetch('/api/telegram/post-matchday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchday }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.data) setStatus(json.data);
        if (onToast) {
          onToast(
            `Matchday ${matchday} Results Graphic posted to Telegram group!`,
            'success'
          );
        }
      } else {
        if (onToast) {
          onToast(
            json.error || `Could not post Matchday ${matchday} graphic.`,
            'error'
          );
        }
      }
    } catch {
      if (onToast) onToast('Network error posting graphic to Telegram.', 'error');
    } finally {
      setPostingMd(null);
    }
  };

  const handleSendClockNotice = async (type: 'reminder' | 'ended') => {
    setSendingNotice(type);
    try {
      const res = await fetch('/api/telegram/send-clock-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.data) setStatus(json.data);
        if (onToast) {
          onToast(
            type === 'reminder'
              ? 'Amharic hours-remaining reminder sent to Telegram group!'
              : 'Amharic matchday closing message sent to Telegram group!',
            'success'
          );
        }
      } else if (onToast) {
        onToast(json.error || 'Failed sending Telegram notice.', 'error');
      }
    } catch {
      if (onToast) onToast('Network error sending Telegram announcement.', 'error');
    } finally {
      setSendingNotice(null);
    }
  };

  const botUsername = status?.botInfo?.username || 'MetaRefereeBot';
  const matchdayList = status?.matchdayProgress || [];

  return (
    <section className="rounded-2xl border-2 border-[#3ce7ff]/40 bg-gradient-to-b from-[#070e52] to-[#040732] p-5 sm:p-7 shadow-[0_0_30px_rgba(60,231,255,0.12)] my-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3ce7ff]/20 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#3ce7ff] to-[#071360] text-[#050842] shadow-lg">
            <Send className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#eaff28] px-2.5 py-0.5 text-[9px] font-black uppercase text-[#050842]">
                Telegram Group Auto-Referee
              </span>
              {status?.pollingActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE · @{botUsername}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/50 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                  <Clock className="h-3 w-3" />
                  {loading ? 'Connecting...' : 'Waiting to Connect'}
                </span>
              )}
            </div>
            <h3 className="font-sports text-xl sm:text-2xl text-white font-black tracking-wide mt-1">
              Telegram Screenshot Matcher &amp; Matchday Auto-Poster
            </h3>
            <p className="text-xs text-[#b9c4f0]">
              Players post their eFootball Match History or Full Time screenshots in your Telegram group — the bot matches club logos, club names, or usernames to publish scores live, and automatically posts each completed Matchday&apos;s PNG graphic.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchStatus(false)}
          className="flex items-center gap-1.5 rounded-xl border border-[#3ce7ff]/40 bg-[#060a48] hover:border-[#3ce7ff] px-3.5 py-2 text-xs font-bold text-[#3ce7ff] transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Bot Status</span>
        </button>
      </div>

      {/* Group Linking & Auto-Post Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <div className="lg:col-span-7 rounded-xl border border-[#3ce7ff]/25 bg-[#05093e] p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#3ce7ff] flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Linked Telegram Group
            </span>
            {status?.groupChatId ? (
              <span className="rounded-md bg-emerald-500/15 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                {status.groupChatTitle
                  ? `${status.groupChatTitle} (${status.groupChatId})`
                  : `ID: ${status.groupChatId}`}
              </span>
            ) : (
              <span className="rounded-md bg-amber-500/15 border border-amber-400/40 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                Auto-detecting on next group message
              </span>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 mt-2">
            <input
              type="text"
              value={groupInput}
              onChange={(e) => setGroupInput(e.target.value)}
              placeholder="Auto-filled on group activity (or enter @group_handle / -100... ID)"
              className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#060a48] px-3 py-2 text-xs font-mono text-white placeholder-[#8e9bd4]/70 focus:border-[#eaff28] focus:outline-none"
            />
            <button
              type="button"
              disabled={savingConfig}
              onClick={() => handleSaveConfig()}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#3ce7ff] hover:bg-[#6ef0ff] text-[#050842] px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>{savingConfig ? 'Saving...' : 'Save Group'}</span>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#8e9bd4]">
            Tip: Make <span className="font-mono text-[#eaff28]">@{botUsername}</span> an admin in your Telegram tournament group and send <span className="font-mono text-[#3ce7ff]">/status</span> or any photo to link automatically.
          </p>
        </div>

        <div className="lg:col-span-5 rounded-xl border border-[#3ce7ff]/25 bg-[#05093e] p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#eaff28] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Single-Matchday Auto-Post
              </span>
              <p className="mt-1 text-[11px] text-[#b9c4f0]">
                Automatically renders and posts that single Matchday&apos;s PNG results poster to the Telegram group once 100% of its fixtures end.
              </p>
            </div>
            <button
              type="button"
              disabled={savingConfig}
              onClick={() => {
                const next = !autoPost;
                setAutoPost(next);
                handleSaveConfig(next);
              }}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black uppercase border transition-all cursor-pointer ${
                autoPost
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                  : 'border-slate-500 bg-slate-800/60 text-slate-300'
              }`}
            >
              {autoPost ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#3ce7ff]/15 flex items-center justify-between text-[11px] text-[#8e9bd4]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#3ce7ff]" />
              Posts 1 Matchday per graphic (never full season)
            </span>
            <span className="font-mono text-[#eaff28]">
              {status?.postedMatchdays?.length || 0} posted
            </span>
          </div>
        </div>
      </div>

      {/* Automatic Amharic Countdown & Closing Announcements */}
      <div className="rounded-xl border border-[#eaff28]/30 bg-[#05093e] p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#eaff28] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Automatic Amharic Matchday Countdown &amp; Closing Alerts
            </span>
            <p className="mt-1 text-[11px] text-[#b9c4f0]">
              Bot automatically sends hours-remaining reminders before the due time (3h, 2h, 1h left) and posts the closing announcement when the clock finishes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={sendingNotice !== null}
              onClick={() => handleSendClockNotice('reminder')}
              className="rounded-lg border border-[#3ce7ff]/50 bg-[#071360] hover:bg-[#3ce7ff] hover:text-[#050842] px-3 py-1.5 text-[11px] font-bold text-[#3ce7ff] transition-colors disabled:opacity-40 cursor-pointer"
            >
              {sendingNotice === 'reminder' ? 'Sending...' : 'Send Hours-Left Alert'}
            </button>
            <button
              type="button"
              disabled={sendingNotice !== null}
              onClick={() => handleSendClockNotice('ended')}
              className="rounded-lg border border-[#eaff28]/60 bg-[#eaff28]/15 hover:bg-[#eaff28] hover:text-[#050842] px-3 py-1.5 text-[11px] font-bold text-[#eaff28] transition-colors disabled:opacity-40 cursor-pointer"
            >
              {sendingNotice === 'ended' ? 'Sending...' : 'Send Closing Alert'}
            </button>
          </div>
        </div>
      </div>

      {/* Matchday Completion & Telegram Dispatch Grid */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-sports text-sm uppercase tracking-wider text-white flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-[#eaff28]" />
            <span>Single-Matchday Graphics &amp; Telegram Broadcast</span>
          </h4>
          <span className="text-[11px] font-mono text-[#3ce7ff]">
            {matchdayList.length} Matchdays scheduled
          </span>
        </div>

        {matchdayList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#3ce7ff]/25 bg-[#05093e]/60 p-4 text-center text-xs text-[#8e9bd4]">
            End player registration or generate fixtures to inspect Matchday Telegram auto-posting status.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {matchdayList.map((md) => {
              const pct =
                md.total > 0 ? Math.round((md.completed / md.total) * 100) : 0;
              return (
                <div
                  key={`tg-md-${md.matchday}`}
                  className={`rounded-xl border p-3.5 transition-all ${
                    md.isComplete
                      ? 'border-emerald-400/50 bg-[#06124d]'
                      : 'border-[#3ce7ff]/25 bg-[#05093e]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-sports text-sm font-black text-white">
                      MATCHDAY {md.matchday}
                    </span>
                    {md.graphicPosted ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-400/50 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Posted
                      </span>
                    ) : md.isComplete ? (
                      <span className="rounded-md bg-[#eaff28]/20 border border-[#eaff28]/50 px-2 py-0.5 text-[10px] font-bold text-[#eaff28]">
                        Complete
                      </span>
                    ) : (
                      <span className="rounded-md bg-[#3ce7ff]/15 border border-[#3ce7ff]/30 px-2 py-0.5 text-[10px] font-mono text-[#3ce7ff]">
                        {md.completed}/{md.total}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-[#020520] overflow-hidden mb-3">
                    <div
                      className={`h-full transition-all ${
                        md.isComplete ? 'bg-emerald-400' : 'bg-[#3ce7ff]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/telegram/matchday-graphic/${md.matchday}`}
                      download={`efootball-matchday-${md.matchday}-results.png`}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-[#3ce7ff]/40 bg-[#071360] hover:border-[#3ce7ff] px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors"
                    >
                      <Download className="h-3 w-3 text-[#3ce7ff]" />
                      <span>PNG</span>
                    </a>

                    <button
                      type="button"
                      disabled={!md.isComplete || postingMd === md.matchday}
                      onClick={() => handlePostMatchday(md.matchday)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-[#eaff28] hover:bg-[#d8ec1f] text-[#050842] px-2.5 py-1.5 text-[11px] font-black uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title={
                        md.isComplete
                          ? `Post Matchday ${md.matchday} PNG graphic to Telegram group`
                          : `Complete all ${md.total} matches first`
                      }
                    >
                      <Send className="h-3 w-3 stroke-[2.5]" />
                      <span>
                        {postingMd === md.matchday
                          ? 'Posting...'
                          : md.graphicPosted
                          ? 'Repost'
                          : 'Post'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Verification Activity Feed */}
      <div>
        <h4 className="font-sports text-sm uppercase tracking-wider text-white mb-2.5">
          Recent Telegram Screenshot Verifications
        </h4>
        {!status?.recentEvents || status.recentEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#3ce7ff]/20 bg-[#05093e]/50 p-3.5 text-xs text-[#8e9bd4]">
            No Telegram screenshot events recorded yet. Once players post match screenshots in your Telegram group, verified matches and auto-posted Matchday graphics will appear here.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {status.recentEvents.slice(0, 10).map((ev) => {
              const isSuccess =
                ev.type === 'screenshot_recorded' ||
                ev.type === 'matchday_graphic_posted' ||
                ev.type === 'clock_announcement';
              const isWarn =
                ev.type === 'screenshot_duplicate' ||
                ev.type === 'screenshot_unmatched';
              return (
                <div
                  key={ev.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[#3ce7ff]/20 bg-[#05093e] px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {isSuccess ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : isWarn ? (
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{ev.summary}</p>
                      {ev.detail && (
                        <p className="text-[11px] text-[#8e9bd4] truncate mt-0.5">
                          {ev.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-mono text-[#3ce7ff]">
                    {new Date(ev.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
