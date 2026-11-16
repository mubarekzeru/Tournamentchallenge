import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Bot,
  Paperclip,
  X,
  Power,
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
    | 'postponed_announcement'
    | 'ai_assistant'
    | 'error';
  matchday?: number;
  summary: string;
  detail?: string;
}

interface AssistantActionRecord {
  tool: string;
  ok: boolean;
  summary: string;
  graphicPreviewBase64?: string;
  graphicType?: string;
}

interface AssistantChatItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachedPreview?: string;
  actions?: AssistantActionRecord[];
}

interface MatchdayProgressItem {
  matchday: number;
  total: number;
  completed: number;
  isComplete: boolean;
  graphicPosted: boolean;
}

interface TelegramStatusSnapshot {
  botEnabled: boolean;
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
  autoRecordScreenshots: boolean;
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
  const [botEnabled, setBotEnabled] = useState(false);
  const [autoPost, setAutoPost] = useState(false);
  const [autoRecord, setAutoRecord] = useState(false);

  // AI Assistant state
  const [aiMessages, setAiMessages] = useState<AssistantChatItem[]>([
    {
      id: 'welcome-ai',
      role: 'assistant',
      text: 'ሰላም! የቶርናመንቱ ቦት AI አሲስታንት ነኝ። ስለ ቶርናመንቱ መረጃ መጠየቅ፣ አዳዲስ ዜና ወደ ግሩፑ ማስተላለፍ፣ የዌብሳይቱን ግራፊክስ ፎቶዎች (Standings, Matchday Results, Upcoming Schedule) ወይም የተራዘሙ ጨዋታዎችን ፖስት ማድረግ ትችላላችሁ።',
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{
    base64: string;
    mimeType: string;
    name: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const fetchStatus = useCallback(async (syncInputs = false) => {
    try {
      const res = await fetch('/api/telegram/status');
      const json = await res.json();
      if (json.success && json.data) {
        const data: TelegramStatusSnapshot = json.data;
        setStatus(data);
        if (syncInputs) {
          setGroupInput(data.groupChatId ? String(data.groupChatId) : '');
          setBotEnabled(Boolean(data.botEnabled));
          setAutoPost(Boolean(data.autoPostMatchdayGraphic));
          setAutoRecord(Boolean(data.autoRecordScreenshots));
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

  const handleSaveConfig = async (overrides?: {
    botEnabled?: boolean;
    autoPost?: boolean;
    autoRecord?: boolean;
  }) => {
    const botEnabledVal =
      overrides?.botEnabled !== undefined ? overrides.botEnabled : botEnabled;
    const autoPostVal =
      overrides?.autoPost !== undefined ? overrides.autoPost : autoPost;
    const autoRecordVal =
      overrides?.autoRecord !== undefined ? overrides.autoRecord : autoRecord;
    setSavingConfig(true);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botEnabled: botEnabledVal,
          groupChatId: groupInput.trim() || null,
          autoPostMatchdayGraphic: autoPostVal,
          autoRecordScreenshots: autoRecordVal,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setStatus(json.data);
        setBotEnabled(Boolean(json.data.botEnabled));
        setAutoPost(Boolean(json.data.autoPostMatchdayGraphic));
        setAutoRecord(Boolean(json.data.autoRecordScreenshots));
        if (onToast) {
          onToast(
            overrides?.botEnabled === false
              ? 'Telegram Bot completely turned OFF (100% Manual Mode).'
              : overrides?.botEnabled === true
              ? 'Telegram Bot turned ON.'
              : 'Telegram Group Bot settings updated.',
            overrides?.botEnabled === false ? 'info' : 'success'
          );
        }
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

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onToast?.('Please select an image file (PNG/JPG).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = String(reader.result || '');
      if (resultStr) {
        setAttachedImage({
          base64: resultStr,
          mimeType: file.type,
          name: file.name,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendAiPrompt = async (overrideText?: string) => {
    const promptText = (overrideText !== undefined ? overrideText : aiInput).trim();
    if (!promptText && !attachedImage) return;

    const currentAttachment = attachedImage;
    const userMsg: AssistantChatItem = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: promptText || `Attached: ${currentAttachment?.name || 'Graphic'}`,
      attachedPreview: currentAttachment?.base64,
    };

    const nextHistory = [...aiMessages, userMsg];
    setAiMessages(nextHistory);
    if (overrideText === undefined) setAiInput('');
    setAttachedImage(null);
    setAiBusy(true);

    setTimeout(() => {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 50);

    try {
      const res = await fetch('/api/telegram/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          history: aiMessages
            .filter((m) => m.id !== 'welcome-ai')
            .slice(-8)
            .map((m) => ({ role: m.role, text: m.text })),
          imageBase64: currentAttachment?.base64,
          imageMimeType: currentAttachment?.mimeType,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.data) setStatus(json.data);
        setAiMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: json.reply || 'Done.',
            actions: Array.isArray(json.actions) ? json.actions : [],
          },
        ]);
        const postedOk = Array.isArray(json.actions) && json.actions.some((a: AssistantActionRecord) => a.ok);
        if (postedOk) {
          onToast?.('Telegram group updated by AI Assistant!', 'success');
        }
      } else {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `a-err-${Date.now()}`,
            role: 'assistant',
            text: `⚠️ ${json.error || 'Could not process request.'}`,
          },
        ]);
        onToast?.(json.error || 'AI Assistant error.', 'error');
      }
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `a-net-${Date.now()}`,
          role: 'assistant',
          text: '⚠️ Network error contacting AI Assistant.',
        },
      ]);
      onToast?.('Network error contacting AI Assistant.', 'error');
    } finally {
      setAiBusy(false);
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 80);
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
              {status?.botEnabled && status?.pollingActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE · @{botUsername}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-400/50 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
                  <Power className="h-3 w-3" />
                  {loading ? 'Checking...' : 'COMPLETELY OFF · Manual Mode'}
                </span>
              )}
            </div>
            <h3 className="font-sports text-xl sm:text-2xl text-white font-black tracking-wide mt-1">
              Telegram Manual Poster &amp; Bot Controls
            </h3>
            <p className="text-xs text-[#b9c4f0]">
              When turned OFF, all background polling, AI replies, screenshot reading, and auto-announcements stop completely — only your manual button clicks post to Telegram.
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

      {/* Master Power Switch */}
      <div
        className={`mb-5 rounded-xl border-2 p-4 flex flex-wrap items-center justify-between gap-4 transition-all ${
          botEnabled
            ? 'border-emerald-400/50 bg-emerald-950/25'
            : 'border-rose-500/50 bg-rose-950/25'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
              botEnabled
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                : 'border-rose-400/60 bg-rose-500/20 text-rose-300'
            }`}
          >
            <Power className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-sports text-sm sm:text-base font-black uppercase tracking-wider text-white">
                Master Bot Power: {botEnabled ? 'ON (Automated)' : 'COMPLETELY OFF (100% Manual Mode)'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#c7d3ff]">
              {botEnabled
                ? 'Bot polling and enabled automations are active. Turn OFF anytime to switch back to 100% manual score recording & posting.'
                : 'Bot polling, AI assistant replies, automatic screenshot recording, auto Matchday posting, and clock timers are completely stopped. Record & post match results yourself with zero bot interference.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={savingConfig}
          onClick={() => {
            const next = !botEnabled;
            setBotEnabled(next);
            if (!next) {
              setAutoRecord(false);
              setAutoPost(false);
              handleSaveConfig({ botEnabled: false, autoRecord: false, autoPost: false });
            } else {
              handleSaveConfig({ botEnabled: true });
            }
          }}
          className={`shrink-0 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-50 ${
            botEnabled
              ? 'border-rose-400 bg-rose-500/20 text-rose-200 hover:bg-rose-500 hover:text-white'
              : 'border-emerald-400 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500 hover:text-[#050842]'
          }`}
        >
          <Power className="h-4 w-4" />
          <span>{botEnabled ? 'Turn Bot OFF' : 'Turn Bot ON'}</span>
        </button>
      </div>

      {/* Group Linking & Auto-Post Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <div className="lg:col-span-4 rounded-xl border border-[#3ce7ff]/25 bg-[#05093e] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#3ce7ff] flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Linked Telegram Group
              </span>
              {status?.groupChatId ? (
                <span className="rounded-md bg-emerald-500/15 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-mono text-emerald-300 truncate max-w-[160px]">
                  {status.groupChatTitle
                    ? `${status.groupChatTitle}`
                    : `ID: ${status.groupChatId}`}
                </span>
              ) : (
                <span className="rounded-md bg-amber-500/15 border border-amber-400/40 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                  Auto-detecting
                </span>
              )}
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 mt-2">
              <input
                type="text"
                value={groupInput}
                onChange={(e) => setGroupInput(e.target.value)}
                placeholder="Group ID / @handle"
                className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#060a48] px-3 py-2 text-xs font-mono text-white placeholder-[#8e9bd4]/70 focus:border-[#eaff28] focus:outline-none"
              />
              <button
                type="button"
                disabled={savingConfig}
                onClick={() => handleSaveConfig()}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#3ce7ff] hover:bg-[#6ef0ff] text-[#050842] px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>{savingConfig ? '...' : 'Save'}</span>
              </button>
            </div>
          </div>
          <p className="mt-2.5 text-[11px] text-[#8e9bd4]">
            Make <span className="font-mono text-[#eaff28]">@{botUsername}</span> an admin in your group and send <span className="font-mono text-[#3ce7ff]">/status</span> to link.
          </p>
        </div>

        {/* Manual Safe Mode vs AI Auto-Record Toggle */}
        <div
          className={`lg:col-span-4 rounded-xl border border-[#3ce7ff]/25 bg-[#05093e] p-4 flex flex-col justify-between ${
            !botEnabled ? 'opacity-55' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#3ce7ff] flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" />
                Auto-Record Screenshots
              </span>
              <p className="mt-1 text-[11px] text-[#b9c4f0]">
                {!botEnabled
                  ? 'Stopped because Master Bot Power is OFF.'
                  : autoRecord
                  ? 'Bot reads Telegram screenshots automatically, while preserving any scores you entered manually on the website.'
                  : 'Paused (Manual Mode): Bot ignores Telegram screenshots & stops group error messages so you can record matches manually.'}
              </p>
            </div>
            <button
              type="button"
              disabled={savingConfig || !botEnabled}
              onClick={() => {
                const next = !autoRecord;
                setAutoRecord(next);
                handleSaveConfig({ autoRecord: next });
              }}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black uppercase border transition-all cursor-pointer disabled:cursor-not-allowed ${
                botEnabled && autoRecord
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                  : 'border-amber-400/60 bg-amber-500/15 text-amber-300'
              }`}
            >
              {botEnabled && autoRecord ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#3ce7ff]/15 flex items-center justify-between text-[11px] text-[#8e9bd4]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Manual website scores always protected
            </span>
            <span className={`font-mono ${botEnabled && autoRecord ? 'text-emerald-300' : 'text-amber-300'}`}>
              {botEnabled && autoRecord ? 'AI Active' : 'Manual'}
            </span>
          </div>
        </div>

        <div
          className={`lg:col-span-4 rounded-xl border border-[#3ce7ff]/25 bg-[#05093e] p-4 flex flex-col justify-between ${
            !botEnabled ? 'opacity-55' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#eaff28] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Single-Matchday Auto-Post
              </span>
              <p className="mt-1 text-[11px] text-[#b9c4f0]">
                {!botEnabled
                  ? 'Stopped because Master Bot Power is OFF. Use the manual Post button below when ready.'
                  : 'Automatically renders and posts that single Matchday&apos;s PNG results poster to the Telegram group once 100% of its fixtures end.'}
              </p>
            </div>
            <button
              type="button"
              disabled={savingConfig || !botEnabled}
              onClick={() => {
                const next = !autoPost;
                setAutoPost(next);
                handleSaveConfig({ autoPost: next });
              }}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black uppercase border transition-all cursor-pointer disabled:cursor-not-allowed ${
                botEnabled && autoPost
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                  : 'border-slate-500 bg-slate-800/60 text-slate-300'
              }`}
            >
              {botEnabled && autoPost ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#3ce7ff]/15 flex items-center justify-between text-[11px] text-[#8e9bd4]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#3ce7ff]" />
              Posts 1 Matchday per graphic
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

      {/* Bot AI Assistant & Group Broadcaster */}
      <div className="rounded-xl border border-[#3ce7ff]/35 bg-[#05093e] p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3ce7ff]/15 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#3ce7ff]/15 border border-[#3ce7ff]/40 text-[#3ce7ff]">
              <Bot className="h-4.5 w-4.5" />
            </div>
            <div>
              <h4 className="font-sports text-sm uppercase tracking-wider text-white">
                Bot AI Assistant · News, Graphics &amp; Postponed Broadcaster
              </h4>
              <p className="text-[11px] text-[#8e9bd4]">
                Ask tournament questions in Amharic or English, tell the bot news to share, request website PNG graphics, or post postponed matches. Also works in Telegram via <span className="font-mono text-[#3ce7ff]">/ask</span> or DM to <span className="font-mono text-[#eaff28]">@{botUsername}</span>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href="/api/telegram/graphic/standings"
              download="efootball-standings.png"
              className="inline-flex items-center gap-1 rounded-lg border border-[#3ce7ff]/35 bg-[#071360] hover:border-[#3ce7ff] px-2.5 py-1 text-[10px] font-bold text-[#3ce7ff]"
            >
              <Download className="h-3 w-3" />
              <span>Standings PNG</span>
            </a>
            <a
              href="/api/telegram/graphic/upcoming"
              download="efootball-upcoming-fixtures.png"
              className="inline-flex items-center gap-1 rounded-lg border border-[#3ce7ff]/35 bg-[#071360] hover:border-[#3ce7ff] px-2.5 py-1 text-[10px] font-bold text-[#3ce7ff]"
            >
              <Download className="h-3 w-3" />
              <span>Upcoming PNG</span>
            </a>
            <a
              href="/api/telegram/graphic/postponed"
              download="efootball-postponed-matches.png"
              className="inline-flex items-center gap-1 rounded-lg border border-amber-400/35 bg-[#071360] hover:border-amber-400 px-2.5 py-1 text-[10px] font-bold text-amber-300"
            >
              <Download className="h-3 w-3" />
              <span>Postponed PNG</span>
            </a>
          </div>
        </div>

        {/* Chat Messages */}
        <div
          ref={chatScrollRef}
          className="space-y-3 max-h-72 overflow-y-auto pr-1 mb-3"
        >
          {aiMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[82%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#081a7a] border border-[#3ce7ff]/40 text-white'
                    : 'bg-[#040730] border border-[#eaff28]/25 text-[#e4eaff]'
                }`}
              >
                {msg.attachedPreview && (
                  <img
                    src={msg.attachedPreview}
                    alt="Attached graphic"
                    className="mb-2 max-h-36 rounded-lg border border-[#3ce7ff]/30 object-contain"
                  />
                )}
                <p>{msg.text}</p>
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2.5 space-y-2 border-t border-white/10 pt-2">
                    {msg.actions.map((act, aIdx) => (
                      <div
                        key={`${msg.id}-act-${aIdx}`}
                        className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                          act.ok
                            ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                            : 'border-rose-400/40 bg-rose-500/10 text-rose-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          {act.ok ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{act.summary}</span>
                        </div>
                        {act.graphicPreviewBase64 && (
                          <img
                            src={act.graphicPreviewBase64}
                            alt={act.graphicType || 'Posted Graphic'}
                            className="mt-2 max-h-44 rounded-lg border border-[#3ce7ff]/30 object-contain"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {aiBusy && (
            <div className="flex items-start">
              <div className="rounded-xl bg-[#040730] border border-[#3ce7ff]/25 px-3.5 py-2 text-xs text-[#3ce7ff]">
                Thinking &amp; preparing Telegram action...
              </div>
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          {[
            {
              label: '❓ የቶርናመንት ሁኔታ',
              prompt: 'የቶርናመንቱን አሁን ያለ ሁኔታ፣ ደረጃ ሰንጠረዥ እና የዛሬ ጨዋታዎችን ንገረኝ።',
              sendNow: true,
            },
            {
              label: '📊 Standings ፎቶ ፖስት',
              prompt: 'የደረጃ ሰንጠረዥ (Standings) ግራፊክ ፎቶ ከዌብሳይቱ አውጥተህ ወደ Telegram ግሩፑ ፖስት አድርግ።',
              sendNow: true,
            },
            {
              label: '📅 ቀጣይ ጨዋታዎች ፎቶ ፖስት',
              prompt: 'የቀጣይ Matchday ጨዋታዎች (Upcoming Fixtures) ግራፊክ ፎቶ ወደ ግሩፑ ፖስት አድርግ።',
              sendNow: true,
            },
            {
              label: '⏳ የተራዘመ ጨዋታ ፖስት',
              prompt: 'የተራዘሙ ጨዋታዎች ካሉ ከግራፊክ ፎቶ ጋር ወደ ግሩፑ ፖስት አድርግ።',
              sendNow: true,
            },
            {
              label: '📢 አዲስ ዜና ጻፍ',
              prompt: 'አዲስ ዜና ወደ Telegram ግሩፑ ፖስት አድርግልኝ: ',
              sendNow: false,
            },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={aiBusy}
              onClick={() => {
                if (chip.sendNow) {
                  handleSendAiPrompt(chip.prompt);
                } else {
                  setAiInput(chip.prompt);
                }
              }}
              className="rounded-lg border border-[#3ce7ff]/30 bg-[#071360]/80 hover:border-[#eaff28] hover:text-[#eaff28] px-2.5 py-1 text-[10.5px] font-bold text-[#c7d3ff] transition-colors disabled:opacity-40 cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Attached Graphic Preview */}
        {attachedImage && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[#3ce7ff]/40 bg-[#071360] px-3 py-1.5 text-xs text-[#3ce7ff]">
            <div className="flex items-center gap-2 truncate">
              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-mono">{attachedImage.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="text-rose-300 hover:text-rose-200 cursor-pointer"
              title="Remove attachment"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendAiPrompt();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleAttachFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={aiBusy}
            title="Attach exported website PNG graphic or photo"
            className="shrink-0 rounded-xl border border-[#3ce7ff]/40 bg-[#060a48] hover:border-[#eaff28] p-2.5 text-[#3ce7ff] hover:text-[#eaff28] transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            disabled={aiBusy}
            placeholder="ቦቱን ይጠይቁ ወይም ዜና/ግራፊክ/የተራዘመ ጨዋታ ወደ ግሩፑ እንዲልክ ይንገሩት..."
            className="w-full rounded-xl border border-[#3ce7ff]/50 bg-[#060a48] px-3.5 py-2 text-xs text-white placeholder-[#8e9bd4]/75 focus:border-[#eaff28] focus:outline-none"
          />
          <button
            type="submit"
            disabled={aiBusy || (!aiInput.trim() && !attachedImage)}
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#eaff28] hover:bg-[#d8ec1f] text-[#050842] px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>{aiBusy ? '...' : 'Ask Bot'}</span>
          </button>
        </form>
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
                ev.type === 'clock_announcement' ||
                ev.type === 'postponed_announcement' ||
                ev.type === 'ai_assistant';
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
