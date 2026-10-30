import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  Trophy,
  Swords,
  CheckCircle2,
  Clock,
  Download,
  Share2,
  Search,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Shield,
  Medal,
  Lock,
  X,
  ExternalLink,
  Flame,
  LayoutGrid,
  GitBranch,
  Smartphone,
  Monitor,
  Move,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { exportElementToPng, downloadDataUrl } from '../utils/exportImage';
import {
  Player,
  MatchResult,
  TournamentFormat,
  GroupStageConfig,
  Fixture,
} from '../types/tournament';
import {
  buildSymmetricalBracket,
  BracketTieModel,
  BracketRoundColumn,
  getPlayerPathMatchIds,
} from '../utils/bracketEngine';
import { DEFAULT_GROUP_CONFIG } from '../utils/groupStage';

interface BracketPageProps {
  players: Player[];
  results: MatchResult[];
  fixtures?: Fixture[];
  tournamentFormat?: TournamentFormat;
  config?: GroupStageConfig;
  isAdmin?: boolean;
  isRegistrationOpen?: boolean;
  onSelectFixtureToRecord?: (fixture: Fixture, existingResult?: MatchResult) => void;
  onSelectPlayer?: (player: Player) => void;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onToggleRegistration?: (ended?: boolean) => void;
}

// Centerpiece Trophy SVG component
const GrandTrophy: React.FC<{ className?: string }> = ({ className = 'h-16 w-16' }) => (
  <svg
    viewBox="0 0 100 100"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="trophyGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffff00" stopOpacity="0.8" />
        <stop offset="60%" stopColor="#eaff28" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#3ce7ff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fff899" />
        <stop offset="35%" stopColor="#eaff28" />
        <stop offset="70%" stopColor="#e5a800" />
        <stop offset="100%" stopColor="#966d00" />
      </linearGradient>
      <linearGradient id="silverStem" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#b9c4f0" />
        <stop offset="50%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#6372b8" />
      </linearGradient>
    </defs>
    {/* Aura */}
    <circle cx="50" cy="45" r="42" fill="url(#trophyGlow)" opacity="0.6" />
    {/* Cup Handles */}
    <path
      d="M26 28 C14 28 14 50 28 55 L31 52 C20 48 20 34 29 32 Z"
      fill="url(#goldGrad)"
    />
    <path
      d="M74 28 C86 28 86 50 72 55 L69 52 C80 48 80 34 71 32 Z"
      fill="url(#goldGrad)"
    />
    {/* Cup Main Body */}
    <path
      d="M28 22 L72 22 C72 22 73 48 50 56 C27 48 28 22 28 22 Z"
      fill="url(#goldGrad)"
    />
    {/* Cup Rim */}
    <ellipse cx="50" cy="22" rx="22" ry="4" fill="#fff899" />
    {/* Cup Stem */}
    <path d="M46 56 L54 56 L53 68 L47 68 Z" fill="url(#silverStem)" />
    {/* Base Collar */}
    <path d="M41 68 L59 68 L58 72 L42 72 Z" fill="url(#goldGrad)" />
    {/* Trophy Pedestal */}
    <path d="M36 72 L64 72 L66 84 L34 84 Z" fill="#040b3e" stroke="#3ce7ff" strokeWidth="2" />
    <rect x="38" y="75" width="24" height="6" rx="2" fill="#071360" stroke="#eaff28" strokeWidth="0.8" />
    {/* Star Crest */}
    <polygon
      points="50,30 52,36 58,36 53,40 55,46 50,42 45,46 47,40 42,36 48,36"
      fill="#050842"
    />
  </svg>
);

// Dimensions and layout standards for symmetrical tournament cup graphics
const CARD_WIDTH = 210;
const COL_GAP = 24;
const CENTER_WIDTH = 230;
const MAIN_GAP = 24;
const PADDING_X = 48; // 24px left + 24px right (p-6)

export const BracketPage: React.FC<BracketPageProps> = ({
  players,
  results,
  fixtures = [],
  tournamentFormat = 'group_stage',
  config = DEFAULT_GROUP_CONFIG,
  isAdmin = false,
  isRegistrationOpen = false,
  onSelectFixtureToRecord,
  onSelectPlayer,
  onToast,
  onToggleRegistration,
}) => {
  const bracketRef = useRef<HTMLDivElement>(null);

  // Interaction State
  const [selectedTie, setSelectedTie] = useState<BracketTieModel | null>(null);
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [resultsStageFilter, setResultsStageFilter] = useState<'all' | 'finals' | 'semis' | 'quarters' | 'r16'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Mobile navigation & view state
  const [mobileRoundIdx, setMobileRoundIdx] = useState(0);
  const [viewLayout, setViewLayout] = useState<'symmetrical' | 'tree' | 'tabs'>('symmetrical');
  const [fitToWidth, setFitToWidth] = useState<boolean>(true);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 1260;
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const graphicContainerRef = useRef<HTMLDivElement>(null);

  // Full-screen modal interaction state
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const playerMap = useMemo(() => new Map<string, Player>(players.map((p) => [p.user, p])), [players]);

  // Compute Symmetrical Bracket
  const bracketData = useMemo(() => {
    return buildSymmetricalBracket(players, results, tournamentFormat, config);
  }, [players, results, tournamentFormat, config]);

  // Dynamic layout dimensions based on actual tournament bracket rounds
  const roundsCount = Math.max(1, bracketData.rounds.length);
  const wingWidth = useMemo(() => {
    return roundsCount * CARD_WIDTH + Math.max(0, roundsCount - 1) * COL_GAP;
  }, [roundsCount]);

  const totalGraphicWidth = useMemo(() => {
    return wingWidth * 2 + CENTER_WIDTH + MAIN_GAP * 2 + PADDING_X;
  }, [wingWidth]);

  const baseGraphicHeight = useMemo(() => {
    return roundsCount >= 3 ? 960 : 810;
  }, [roundsCount]);

  const [measuredHeight, setMeasuredHeight] = useState<number>(baseGraphicHeight);

  // Measure rendered bracket height to prevent any vertical cropping
  useEffect(() => {
    if (bracketRef.current) {
      const h = bracketRef.current.scrollHeight;
      if (h > 450) {
        setMeasuredHeight(h);
      }
    }
  }, [bracketData, roundsCount]);

  const totalGraphicHeight = measuredHeight || baseGraphicHeight;

  // Measure container width for responsive auto-fit scaling
  useEffect(() => {
    const updateSize = () => {
      if (graphicContainerRef.current) {
        setContainerWidth(graphicContainerRef.current.clientWidth);
      } else {
        setContainerWidth(window.innerWidth);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    let observer: ResizeObserver | null = null;
    if (graphicContainerRef.current) {
      observer = new ResizeObserver(updateSize);
      observer.observe(graphicContainerRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateSize);
      if (observer) observer.disconnect();
    };
  }, []);

  // Calculate perfect 100% fit scale for the modal so nothing is EVER cropped on any screen
  const fitModalToScreen = useCallback(() => {
    const padX = 24;
    const padY = 125; // header + floating thumb close button
    const availW = Math.max(260, window.innerWidth - padX);
    const availH = Math.max(300, window.innerHeight - padY);
    const scaleW = availW / totalGraphicWidth;
    const scaleH = availH / totalGraphicHeight;
    // Fit both width & height so the entire bracket fits completely without any cropping
    const bestFit = Math.min(scaleW, scaleH);
    const finalScale = Math.min(1.2, Math.max(0.16, Number(bestFit.toFixed(3))));
    setZoomLevel(finalScale);
    setPanOffset({ x: 0, y: 0 });
  }, [totalGraphicWidth, totalGraphicHeight]);

  // When opening full screen modal, immediately auto-fit
  useEffect(() => {
    if (isFullScreenOpen) {
      fitModalToScreen();
    }
  }, [isFullScreenOpen, fitModalToScreen]);

  // Keyboard accessibility: Escape closes full screen and detail modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullScreenOpen) setIsFullScreenOpen(false);
        if (selectedTie) setSelectedTie(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreenOpen, selectedTie]);

  // Mouse & Touch Pan Drag handlers for full screen modal
  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      panX: panOffset.x,
      panY: panOffset.y,
    };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setPanOffset({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Scroll to section helper in 1:1 scroll view
  const scrollToSection = (section: 'left' | 'center' | 'right') => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    if (section === 'left') {
      container.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (section === 'center') {
      const scrollPos = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
      container.scrollTo({ left: scrollPos, behavior: 'smooth' });
    } else if (section === 'right') {
      container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
    }
  };

  // Player Path Highlight Set
  const highlightedMatchIds = useMemo(() => {
    if (!highlightedPlayer) return new Set<string>();
    return getPlayerPathMatchIds(highlightedPlayer, bracketData.allTies);
  }, [highlightedPlayer, bracketData.allTies]);

  // Download bracket as high-resolution PNG image
  const handleDownloadBracket = useCallback(async () => {
    if (!bracketRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await exportElementToPng(bracketRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#020520',
      });
      downloadDataUrl(dataUrl, `ethiopian-efootball-bracket-${Date.now()}`);
      if (onToast) onToast('High-resolution cup bracket downloaded as PNG!', 'success');
    } catch (err) {
      console.error('Bracket export failed:', err);
      if (onToast) onToast('Failed to export bracket image.', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [onToast]);

  // Share bracket link or image
  const handleShareBracket = useCallback(() => {
    if (navigator.share) {
      navigator
        .share({
          title: 'Ethiopian eFootball Tournament - Cup Bracket',
          text: 'Check out the official knockout bracket and champion race!',
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      if (onToast) onToast('Bracket link copied to clipboard!', 'info');
    }
  }, [onToast]);

  // Filter check
  const isTieVisible = useCallback(
    (tie: BracketTieModel) => {
      if (filterMode === 'completed' && !tie.isCompleted) return false;
      if (filterMode === 'upcoming' && tie.isCompleted) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      const h = tie.home?.user.toLowerCase() || '';
      const a = tie.away?.user.toLowerCase() || '';
      const hTeam = tie.home?.player?.team.toLowerCase() || '';
      const aTeam = tie.away?.player?.team.toLowerCase() || '';
      return h.includes(q) || a.includes(q) || hTeam.includes(q) || aTeam.includes(q);
    },
    [filterMode, searchQuery]
  );

  // Render individual participant row in a tie card
  const renderParticipant = (
    p: BracketTieModel['home'],
    isWinner: boolean,
    isLoser: boolean,
    isOpponentWinner: boolean,
    penaltyScore?: number | null,
    isHighlightedUser?: boolean
  ) => {
    if (!p) {
      return (
        <div className="flex items-center justify-center py-2 px-2 rounded-lg bg-[#030628]/80 border border-[#3ce7ff]/20">
          <Lock className="h-3 w-3 text-[#3ce7ff]/40 shrink-0" />
        </div>
      );
    }

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          setHighlightedPlayer((prev) => (prev === p.user ? null : p.user));
        }}
        className={`flex items-center justify-between py-1 px-2 rounded-lg transition-all cursor-pointer ${
          isHighlightedUser
            ? 'ring-2 ring-[#eaff28] bg-[#0c1870] shadow-[0_0_12px_rgba(234,255,40,0.4)]'
            : isWinner
            ? 'bg-[#eaff28]/15 border border-[#eaff28]/50 text-white font-bold'
            : isLoser || isOpponentWinner
            ? 'opacity-45 text-[#8e9bd4]'
            : 'text-[#f4f6ff] hover:bg-[#071360]'
        }`}
        title={`Click to trace ${p.user}'s path through bracket`}
      >
        <div
          onClick={(e) => {
            if (p.player && onSelectPlayer) {
              e.stopPropagation();
              onSelectPlayer(p.player);
            }
          }}
          className={`flex items-center gap-2 truncate min-w-0 pr-1 ${p.player && onSelectPlayer ? 'hover:opacity-90 group/player cursor-pointer' : ''}`}
          title={p.player ? `View ${p.player.team || p.user}'s card` : undefined}
        >
          <img
            src={p.player?.avatarUrl}
            alt={p.player?.team || p.user}
            className={`h-5 w-5 rounded-full object-cover shrink-0 border transition-transform ${
              p.player && onSelectPlayer ? 'group-hover/player:scale-110' : ''
            } ${
              isWinner
                ? 'border-[#eaff28] ring-1 ring-[#eaff28]'
                : isHighlightedUser
                ? 'border-[#3ce7ff] ring-1 ring-[#3ce7ff]'
                : 'border-[#3ce7ff]/50'
            }`}
            referrerPolicy="no-referrer"
          />
          <div className="truncate">
            <span className={`block font-sports text-xs truncate leading-none transition-colors ${
              p.player && onSelectPlayer ? 'group-hover/player:text-[#eaff28]' : ''
            }`}>
              {p.player?.team || p.user}
            </span>
            <span className="block text-[9px] text-[#3ce7ff] font-mono truncate leading-tight">
              @{p.user}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {penaltyScore !== null && penaltyScore !== undefined && (
            <span className="text-[9px] text-[#eaff28] font-mono font-bold">
              ({penaltyScore}p)
            </span>
          )}
          <span
            className={`font-sports text-sm font-black px-1.5 py-0.2 rounded ${
              isWinner
                ? 'text-[#eaff28] bg-[#050842] border border-[#eaff28]/60 shadow-[0_0_8px_rgba(234,255,40,0.4)]'
                : 'text-white/80'
            }`}
          >
            {p.score !== null ? p.score : '—'}
          </span>
        </div>
      </div>
    );
  };

  // Render a compact Cup Tie card
  const renderTieCard = (tie: BracketTieModel, isCenter: boolean = false, isFlexibleWidth: boolean = false) => {
    const isSelected = selectedTie?.id === tie.id;
    const isPathActive = highlightedMatchIds.has(tie.id);
    const hasKnownPlayers = tie.home !== null && tie.away !== null;
    const isDimmed = !isTieVisible(tie);

    return (
      <div
        key={tie.id}
        onClick={() => setSelectedTie(tie)}
        className={`relative ${
          isFlexibleWidth ? 'w-full max-w-[340px] sm:w-[210px]' : 'w-[210px]'
        } rounded-xl border transition-all cursor-pointer p-2 shadow-lg backdrop-blur-sm select-none ${
          isDimmed ? 'opacity-30' : 'opacity-100'
        } ${
          isSelected
            ? 'border-[#eaff28] bg-[#0d1778] ring-2 ring-[#eaff28] shadow-[0_0_22px_rgba(234,255,40,0.5)] z-20 scale-105'
            : isPathActive
            ? 'border-[#3ce7ff] bg-[#081266] shadow-[0_0_18px_rgba(60,231,255,0.4)] z-10'
            : hasKnownPlayers
            ? 'border-[#3ce7ff]/35 bg-[#050a48]/90 hover:border-[#3ce7ff] hover:bg-[#071158]'
            : 'border-[#3ce7ff]/20 bg-[#030628]/80'
        }`}
      >
        {/* Tie header badge */}
        <div className="flex items-center justify-between border-b border-[#3ce7ff]/15 pb-1 mb-1.5 text-[10px]">
          <span className="font-sports font-bold tracking-wider text-[#3ce7ff] uppercase">
            {tie.stageBadge}
          </span>

          {tie.isCompleted ? (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-300">
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span>Full Time</span>
            </span>
          ) : tie.isLive ? (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-400 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <span>LIVE</span>
            </span>
          ) : hasKnownPlayers ? (
            <span className="text-[9px] text-[#8e9bd4] font-mono">
              Scheduled
            </span>
          ) : (
            <Lock className="h-2.5 w-2.5 text-[#3ce7ff]/40" />
          )}
        </div>

        {/* Competitor rows */}
        <div className="space-y-1">
          {renderParticipant(
            tie.home,
            tie.home?.isWinner ?? false,
            tie.home?.isLoser ?? false,
            tie.away?.isWinner ?? false,
            tie.penaltyHomeScore,
            tie.home?.user === highlightedPlayer
          )}
          {renderParticipant(
            tie.away,
            tie.away?.isWinner ?? false,
            tie.away?.isLoser ?? false,
            tie.home?.isWinner ?? false,
            tie.penaltyAwayScore,
            tie.away?.user === highlightedPlayer
          )}
        </div>

        {/* Penalty score indicator */}
        {tie.penaltyWinner && (
          <div className="mt-1 pt-1 border-t border-[#3ce7ff]/10 text-center text-[9px] text-[#eaff28] font-mono">
            Full-Time Draw · ({tie.penaltyHomeScore ?? 4}–{tie.penaltyAwayScore ?? 3} pen)
          </div>
        )}
      </div>
    );
  };

  // Empty state handling
  if (!bracketData.isReady) {
    return (
      <section id="bracket" className="py-10 border-b border-[#3ce7ff]/20 scroll-mt-24">
        <div className="rounded-3xl border border-[#3ce7ff]/30 bg-gradient-to-b from-[#09115d] to-[#040632] p-8 sm:p-12 text-center max-w-3xl mx-auto shadow-2xl">
          <GrandTrophy className="mx-auto h-20 w-20 mb-4 animate-pulse" />
          <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#eaff28]">
            {bracketData.title}
          </p>
          <h2 className="font-sports mt-2 text-2xl sm:text-3xl text-white">
            {players.length === 0 ? 'MATCH STARTS SOON' : 'Cup Bracket Awaiting Activation'}
          </h2>
          <p className="mt-3 text-sm text-[#b9c4f0] max-w-lg mx-auto leading-relaxed">
            {players.length === 0
              ? 'Player registration is currently underway. The championship elimination bracket will unlock as soon as competitors are registered.'
              : bracketData.emptyStateReason}
          </p>
        </div>
      </section>
    );
  }

  // Reusable Symmetrical Cup Draw Graphic Container
  const renderSymmetricalGraphic = () => (
    <div
      ref={bracketRef}
      style={{ width: `${totalGraphicWidth}px`, minWidth: `${totalGraphicWidth}px` }}
      className="rounded-3xl border-2 border-[#3ce7ff]/30 bg-gradient-to-b from-[#050d4a] via-[#03072c] to-[#01041b] p-6 shadow-2xl relative select-none box-border"
    >
      {/* Graphic Background Glow Watermark */}
      <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
        <GrandTrophy className="h-[480px] w-[480px]" />
      </div>

      {/* Graphic Header Bar */}
      <div className="text-center mb-8 relative z-10">
        <p className="font-sports text-[11px] font-black uppercase tracking-[0.35em] text-[#eaff28]">
          OFFICIAL CUP DRAW &middot; ETHIOPIAN eFOOTBALL
        </p>
        <h1 className="font-sports text-3xl lg:text-4xl font-black text-white tracking-wider mt-0.5">
          GRAND CHAMPIONSHIP BRACKET
        </h1>
        <p className="text-xs text-[#3ce7ff] font-mono mt-1">
          {bracketData.stats.completedTies}/{bracketData.stats.totalTies} Matches Decided &middot; {bracketData.stats.totalGoals} Goals Recorded
        </p>
      </div>

      {/* Round Header Column Badges */}
      <div className="flex items-center justify-center gap-6 mb-6 relative z-10 border-b border-[#3ce7ff]/20 pb-3">
        {/* Left Wing Round Badges */}
        <div style={{ width: `${wingWidth}px` }} className="flex items-center gap-6 justify-end">
          {bracketData.rounds.map((round) => (
            <div key={`badge-left-${round.stage}`} className="text-center w-[210px] shrink-0">
              <span className="block font-sports text-xs font-black uppercase tracking-wider text-[#3ce7ff]">
                {round.title}
              </span>
              <span className="block text-[9px] text-[#8e9bd4] uppercase tracking-widest font-mono">
                Left Wing
              </span>
            </div>
          ))}
        </div>

        {/* Center Trophy / Final Badge */}
        <div style={{ width: `${CENTER_WIDTH}px` }} className="text-center shrink-0">
          <span className="block font-sports text-sm font-black uppercase tracking-widest text-[#eaff28] animate-pulse">
            🏆 GRAND FINAL
          </span>
          <span className="block text-[9px] text-[#3ce7ff] uppercase font-mono">
            Championship Match
          </span>
        </div>

        {/* Right Wing Round Badges */}
        <div style={{ width: `${wingWidth}px` }} className="flex items-center gap-6 flex-row-reverse justify-start">
          {bracketData.rounds.map((round) => (
            <div key={`badge-right-${round.stage}`} className="text-center w-[210px] shrink-0">
              <span className="block font-sports text-xs font-black uppercase tracking-wider text-[#3ce7ff]">
                {round.title}
              </span>
              <span className="block text-[9px] text-[#8e9bd4] uppercase tracking-widest font-mono">
                Right Wing
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Symmetrical Dual-Wing Grid */}
      <div className="flex items-center justify-center gap-6 relative z-10">
        {/* 1. LEFT WING */}
        <div style={{ width: `${wingWidth}px` }} className="flex items-center gap-6 justify-end">
          {bracketData.rounds.map((round) => (
            <div
              key={`col-left-${round.stage}`}
              className="flex flex-col justify-around gap-6 h-full py-2 w-[210px] items-center shrink-0"
            >
              {round.leftTies.map((tie) => renderTieCard(tie))}
            </div>
          ))}
        </div>

        {/* 2. CENTER PIECE: Grand Trophy, Final Match, & 3rd Place Match */}
        <div style={{ width: `${CENTER_WIDTH}px` }} className="flex flex-col items-center justify-center gap-5 text-center shrink-0">
          {/* Grand Golden Trophy */}
          <div className="relative group cursor-pointer" onClick={() => handleShareBracket()}>
            <GrandTrophy className="h-20 w-20 transition-transform group-hover:scale-110" />
            <span className="mt-1 block font-sports text-[10px] font-black uppercase tracking-widest text-[#eaff28]">
              Cup Winner Trophy
            </span>
          </div>

          {/* The Grand Final Tie Card */}
          {bracketData.finalTie && renderTieCard(bracketData.finalTie, true)}

          {/* 3rd Place Match Card */}
          {bracketData.thirdPlaceTie && (
            <div className="mt-2 text-center w-full flex flex-col items-center">
              <div className="flex items-center justify-center gap-1 mb-1 text-[10px] font-sports font-bold text-[#b9c4f0]">
                <Medal className="h-3 w-3 text-amber-400" />
                <span>3RD PLACE PLAYOFF 🥉</span>
              </div>
              {renderTieCard(bracketData.thirdPlaceTie)}
            </div>
          )}
        </div>

        {/* 3. RIGHT WING */}
        <div style={{ width: `${wingWidth}px` }} className="flex items-center gap-6 flex-row-reverse justify-start">
          {bracketData.rounds.map((round) => (
            <div
              key={`col-right-${round.stage}`}
              className="flex flex-col justify-around gap-6 h-full py-2 w-[210px] items-center shrink-0"
            >
              {round.rightTies.map((tie) => renderTieCard(tie))}
            </div>
          ))}
        </div>
      </div>

      {/* Champion Coronation Banner on Graphic */}
      {bracketData.champion && (
        <div className="mt-8 rounded-2xl border-2 border-[#eaff28] bg-gradient-to-r from-[#050b44] via-[#0f1d82] to-[#050b44] p-4 text-center shadow-[0_0_30px_rgba(234,255,40,0.3)] relative z-10">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <GrandTrophy className="h-10 w-10 text-[#eaff28] animate-bounce shrink-0" />
            <div>
              <span className="block font-sports text-[11px] font-black uppercase tracking-[0.3em] text-[#eaff28]">
                🏆 TOURNAMENT CHAMPION CROWNED 🏆
              </span>
              <h2 className="font-sports text-2xl font-black text-white tracking-wider">
                {bracketData.champion.team || bracketData.champion.user} (@{bracketData.champion.user})
              </h2>
            </div>
            {bracketData.finalTie?.loserUser && (
              <span className="text-xs text-[#3ce7ff] font-mono border-l border-[#3ce7ff]/30 pl-3">
                Runner-up: {playerMap.get(bracketData.finalTie.loserUser)?.team || bracketData.finalTie.loserUser}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Official Cup Draw Match Results & Decided Scores List on Graphic */}
      <div className="mt-8 rounded-2xl border border-[#3ce7ff]/30 bg-[#030733]/90 p-4 relative z-10 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#3ce7ff]/20 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h3 className="font-sports text-xs font-black uppercase tracking-wider text-white">
              CUP DRAW MATCH RESULTS &amp; RECORDED SCORES ({bracketData.stats.completedTies}/{bracketData.stats.totalTies} ENDED)
            </h3>
          </div>
          <span className="text-[10px] text-[#eaff28] font-mono font-bold">
            {bracketData.stats.totalGoals} Total Goals Scored
          </span>
        </div>

        {/* List of Match Results */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {bracketData.allTies.map((tie) => {
            const homeTeam = tie.home?.player?.team || tie.home?.user || 'TBD';
            const awayTeam = tie.away?.player?.team || tie.away?.user || 'TBD';
            const isCompleted = tie.isCompleted;

            return (
              <div
                key={`graphic-res-${tie.id}`}
                className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                  isCompleted
                    ? 'border-emerald-500/40 bg-[#061056]'
                    : 'border-[#3ce7ff]/20 bg-[#04083a]/70 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                  <span className="font-sports text-[10px] font-black uppercase text-[#3ce7ff] px-1.5 py-0.5 rounded bg-[#020528] shrink-0">
                    {tie.stageBadge}
                  </span>
                  <div className="truncate">
                    <span className={`block font-sports text-[11px] truncate leading-tight ${tie.home?.isWinner ? 'text-[#eaff28] font-black' : 'text-white'}`}>
                      {homeTeam}
                    </span>
                    <span className={`block font-sports text-[11px] truncate leading-tight ${tie.away?.isWinner ? 'text-[#eaff28] font-black' : 'text-white'}`}>
                      {awayTeam}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 pl-1">
                  {isCompleted ? (
                    <>
                      <span className="font-sports text-sm font-black text-[#eaff28] bg-[#020528] px-2 py-0.5 rounded border border-[#eaff28]/40 leading-none">
                        {tie.home?.score ?? 0} – {tie.away?.score ?? 0}
                      </span>
                      {tie.penaltyWinner ? (
                        <span className="text-[8px] text-[#3ce7ff] font-mono mt-0.5 font-bold">
                          ({tie.penaltyHomeScore ?? 'P'}-{tie.penaltyAwayScore ?? 'P'} pen)
                        </span>
                      ) : (
                        <span className="text-[8px] text-emerald-300 font-mono mt-0.5 font-bold uppercase">
                          Full Time
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[9px] text-[#8e9bd4] font-mono px-1.5 py-0.5 rounded bg-[#020528]">
                      Scheduled
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Graphic Footer Stamp */}
      <div className="mt-8 pt-4 border-t border-[#3ce7ff]/15 flex items-center justify-between text-[10px] text-[#8e9bd4] font-mono">
        <span>Official Cup Draw &middot; Ethiopian eFootball League</span>
        <span>Verified Results &middot; Anti-Tamper Secured</span>
      </div>
    </div>
  );

  return (
    <section id="bracket" className="py-4 sm:py-6 border-b border-[#3ce7ff]/20 scroll-mt-[105px] w-full px-0 sm:px-1">
      {/* Title Header & Control Bar: Fully edge-to-edge */}
      <div className="mb-5 sm:mb-6 flex flex-wrap items-end justify-between gap-3 px-2 sm:px-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#eaff28] animate-ping" />
            <p className="text-[10px] font-extrabold tracking-[0.25em] uppercase text-[#eaff28]">
              Official Cup Graphic
            </p>
          </div>
          <h2 className="font-sports mt-1 text-2xl sm:text-3xl md:text-4xl text-white tracking-wide">
            ETHIOPIAN eFOOTBALL TOURNAMENT
          </h2>
          <p className="text-xs text-[#3ce7ff] mt-0.5">
            Symmetrical Championship Cup Draw · Road to the Grand Final
          </p>
        </div>

        {/* Global Toolbar: Filter, Search, Download, Share, Full-screen */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Search box */}
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8e9bd4]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player or team..."
              className="w-full rounded-full border border-[#3ce7ff]/60 bg-[#060a48] py-1.5 pl-8 pr-3 text-xs text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-[#050842] p-1 rounded-xl border border-[#3ce7ff]/30 text-xs shrink-0">
            {(['all', 'upcoming', 'completed'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                className={`rounded-lg px-2 sm:px-2.5 py-1 text-[11px] font-bold uppercase transition-colors ${
                  filterMode === mode
                    ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-sm'
                    : 'text-[#b9c4f0] hover:text-white'
                }`}
              >
                {mode === 'all' ? 'All' : mode === 'upcoming' ? 'Pending' : 'Final'}
              </button>
            ))}
          </div>

          {/* Share Button */}
          <button
            type="button"
            onClick={handleShareBracket}
            className="flex items-center gap-1.5 rounded-full border border-[#3ce7ff]/60 bg-[#071360] px-3 py-1.5 text-xs font-bold text-[#3ce7ff] hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors shrink-0"
            title="Share bracket link"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Full Screen / Zoom Modal button */}
          <button
            type="button"
            onClick={() => setIsFullScreenOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-[#3ce7ff]/60 bg-[#071360] px-3 py-1.5 text-xs font-bold text-[#3ce7ff] hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors shrink-0"
            title="Open interactive zoom & pan canvas"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Full Graphic</span>
            <span className="xs:hidden">Zoom</span>
          </button>
        </div>
      </div>

      {/* Registration Open notice for bracket */}
      {isRegistrationOpen && results.length === 0 && (
        <div className="mb-4 rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-[#071360] to-amber-500/15 p-3.5 text-center shadow-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/20 border border-amber-400/50 text-amber-300 shrink-0">
                <Lock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h4 className="font-sports text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wide">
                  Bracket Pairings Hidden During Registration
                </h4>
                <p className="text-[11px] sm:text-xs text-[#b9c4f0] truncate sm:whitespace-normal">
                  Player registration is currently active. Official knockout brackets will be finalized once competitor enlistment concludes.
                </p>
              </div>
            </div>

            {isAdmin && onToggleRegistration && (
              <button
                type="button"
                onClick={() => onToggleRegistration(true)}
                className="rounded-xl border border-amber-400 bg-amber-400/25 px-3.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400 hover:text-[#050842] transition-colors shrink-0 whitespace-nowrap"
              >
                End Registration
              </button>
            )}
          </div>
        </div>
      )}

      {/* Path highlight indicator */}
      {highlightedPlayer && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[#eaff28]/60 bg-[#071360] px-3.5 py-2 text-xs text-white">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-[#eaff28] animate-bounce" />
            <span>
              Tracing tournament path for{' '}
              <strong className="text-[#eaff28]">@{highlightedPlayer}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setHighlightedPlayer(null)}
            className="text-[10px] uppercase font-bold text-[#3ce7ff] hover:underline"
          >
            Clear Highlight
          </button>
        </div>
      )}

      {/* Grand Champion Celebration Banner (Visible when Final has a winner) */}
      {bracketData.champion && (
        <div className="mb-8 rounded-3xl border-2 border-[#eaff28] bg-gradient-to-r from-[#0d1a70] via-[#1a2b90] to-[#0d1a70] p-6 text-center shadow-[0_0_40px_rgba(234,255,40,0.35)] relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#3ce7ff] via-[#eaff28] to-[#3ce7ff]" />
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <div className="relative">
              <img
                src={bracketData.champion.avatarUrl}
                alt={bracketData.champion.team}
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-4 border-[#eaff28] object-cover shadow-[0_0_25px_rgba(234,255,40,0.5)]"
                referrerPolicy="no-referrer"
              />
              <span className="absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-full bg-[#eaff28] text-base font-black text-[#050842] shadow-lg">
                🏆
              </span>
            </div>
            <div className="text-center sm:text-left">
              <span className="inline-block rounded-full bg-[#eaff28] px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#050842]">
                Tournament Champion
              </span>
              <h3 className="font-sports mt-1 text-2xl sm:text-3xl text-white font-black">
                {bracketData.champion.team}
              </h3>
              <p className="text-sm text-[#3ce7ff] font-mono">@{bracketData.champion.user}</p>
              <p className="text-xs text-[#eaff28] mt-1 font-semibold">
                Official Ethiopian eFootball Championship Winner
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE & SIZING CONTROLLER BAR (Directly on page without full-screen)  */}
      {/* ========================================================================= */}
      <div
        ref={graphicContainerRef}
        className="mb-4 sm:mb-5 rounded-none sm:rounded-2xl border-x-0 sm:border-x border-y border-[#3ce7ff]/30 bg-gradient-to-r from-[#050a48] via-[#071360] to-[#050a48] p-2 sm:p-3 shadow-lg w-full"
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* View Mode Switcher: Symmetrical vs Tree Roadmap vs Round Carousel */}
          <div className="grid grid-cols-3 gap-1 w-full sm:w-auto bg-[#030628] p-1 rounded-xl border border-[#3ce7ff]/25 text-center">
            <button
              type="button"
              onClick={() => setViewLayout('symmetrical')}
              className={`flex items-center justify-center gap-1 rounded-lg px-2 sm:px-3 py-1.5 text-xs font-bold transition-all ${
                viewLayout === 'symmetrical'
                  ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-md'
                  : 'text-[#b9c4f0] hover:text-white'
              }`}
            >
              <Trophy className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Cup Draw</span>
            </button>

            <button
              type="button"
              onClick={() => setViewLayout('tree')}
              className={`flex items-center justify-center gap-1 rounded-lg px-2 sm:px-3 py-1.5 text-xs font-bold transition-all ${
                viewLayout === 'tree'
                  ? 'bg-[#eaff28] text-[#050842] font-black shadow-md'
                  : 'text-[#b9c4f0] hover:text-white'
              }`}
            >
              <GitBranch className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">All Stages</span>
            </button>

            <button
              type="button"
              onClick={() => setViewLayout('tabs')}
              className={`flex items-center justify-center gap-1 rounded-lg px-2 sm:px-3 py-1.5 text-xs font-bold transition-all ${
                viewLayout === 'tabs'
                  ? 'bg-white text-[#050842] font-black shadow-md'
                  : 'text-[#b9c4f0] hover:text-white'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">By Round</span>
            </button>
          </div>

          {/* Symmetrical Graphic Fit / Sizing Controls */}
          {viewLayout === 'symmetrical' && (
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
              {/* Fit Screen vs 100% Size Switcher */}
              <div className="flex items-center bg-[#030628] p-1 rounded-xl border border-[#3ce7ff]/25 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFitToWidth(true)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-colors ${
                    fitToWidth
                      ? 'bg-[#3ce7ff] text-[#050842] font-black'
                      : 'text-[#8e9bd4] hover:text-white'
                  }`}
                  title="Auto-scale graphic to fit device width without any cutting"
                >
                  <Smartphone className="h-3.5 w-3.5 shrink-0" />
                  <span>Fit Screen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFitToWidth(false)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-colors ${
                    !fitToWidth
                      ? 'bg-[#3ce7ff] text-[#050842] font-black'
                      : 'text-[#8e9bd4] hover:text-white'
                  }`}
                  title="View at 100% full scale with smooth horizontal swipe"
                >
                  <Monitor className="h-3.5 w-3.5 shrink-0" />
                  <span>100% Swipe</span>
                </button>
              </div>

              {/* Quick Jump Navigator when viewing 1:1 scroll */}
              {!fitToWidth && (
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => scrollToSection('left')}
                    className="rounded-lg border border-[#3ce7ff]/40 bg-[#071360] px-2 py-1 text-[10px] font-bold text-[#3ce7ff] hover:bg-[#3ce7ff] hover:text-[#050842] active:scale-95 transition-all whitespace-nowrap"
                  >
                    ◀ Left
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('center')}
                    className="rounded-lg border border-[#eaff28]/50 bg-[#071360] px-2 py-1 text-[10px] font-bold text-[#eaff28] hover:bg-[#eaff28] hover:text-[#050842] active:scale-95 transition-all whitespace-nowrap"
                  >
                    🏆 Final
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('right')}
                    className="rounded-lg border border-[#3ce7ff]/40 bg-[#071360] px-2 py-1 text-[10px] font-bold text-[#3ce7ff] hover:bg-[#3ce7ff] hover:text-[#050842] active:scale-95 transition-all whitespace-nowrap"
                  >
                    Right ▶
                  </button>
                </div>
              )}

              {/* Full Screen Graphic Button */}
              <button
                type="button"
                onClick={() => setIsFullScreenOpen(true)}
                className="flex items-center gap-1 rounded-xl border border-[#eaff28] bg-[#eaff28]/15 px-2.5 sm:px-3 py-1.5 text-xs font-black uppercase text-[#eaff28] hover:bg-[#eaff28] hover:text-[#050842] transition-colors"
                title="Open zoomable full graphic modal"
              >
                <Maximize2 className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden xs:inline">Zoom Canvas</span>
                <span className="xs:hidden">Zoom</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SYMMETRICAL CUP DRAW GRAPHIC VIEW (FITS MOBILE & DESKTOP WITHOUT CUT) */}
      {/* ========================================================================= */}
      {viewLayout === 'symmetrical' && (
        <div className="w-full max-w-full overflow-hidden px-0">
          {fitToWidth ? (
            /* Auto-Scaled Viewport: Scales graphic proportionally so 100% of it fits with ZERO cutting on any phone or desktop! */
            (() => {
              const scale = Math.max(0.18, Math.min(1, containerWidth / totalGraphicWidth));
              const scaledHeight = Math.ceil(totalGraphicHeight * scale) + 12;
              return (
                <div className="w-full flex flex-col items-center">
                  <div
                    className="w-full max-w-full overflow-hidden rounded-none sm:rounded-3xl border-x-0 sm:border-x-2 border-y-2 border-[#3ce7ff]/30 bg-[#020520] shadow-2xl relative flex justify-center"
                    style={{ height: `${scaledHeight}px` }}
                  >
                    <div
                      className="absolute left-1/2 top-0"
                      style={{
                        width: `${totalGraphicWidth}px`,
                        transform: `translateX(-50%) scale(${scale})`,
                        transformOrigin: 'top center',
                      }}
                    >
                      {renderSymmetricalGraphic()}
                    </div>
                  </div>

                  {/* Mobile Quick Action Hint */}
                  <div className="mt-2 w-full flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[#8e9bd4] font-mono">
                    <span className="flex items-center gap-1 text-[#3ce7ff]">
                      <Sparkles className="h-3 w-3 text-[#eaff28]" />
                      <span>Fitted 100% to screen width</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFullScreenOpen(true)}
                      className="text-[#eaff28] hover:underline font-bold font-sports uppercase tracking-wider"
                    >
                      Tap for Interactive Zoom & Pan &rarr;
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            /* 100% Size Scroll View: Allows natural 1:1 inspection with smooth horizontal swipe and jump pills */
            <div className="w-full max-w-full">
              <div
                ref={scrollContainerRef}
                className="w-full max-w-full overflow-x-auto pb-4 relative rounded-none sm:rounded-3xl border-x-0 sm:border-x-2 border-y-2 border-[#3ce7ff]/30 bg-[#020520] shadow-2xl p-1 sm:p-6 touch-pan-x"
              >
                <div
                  style={{ width: `${totalGraphicWidth}px`, minWidth: `${totalGraphicWidth}px` }}
                  className="mx-auto"
                >
                  {renderSymmetricalGraphic()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CONNECTED TOURNAMENT TREE (ALL STAGES SHOWN TOGETHER, 100% RESPONSIVE) */}
      {/* ========================================================================= */}
      {viewLayout === 'tree' && (
        <div className="space-y-6">
          {bracketData.rounds.map((round, rIdx) => {
            const allStageTies = [...round.leftTies, ...round.rightTies];
            return (
              <div
                key={`tree-stage-${round.stage}`}
                className="rounded-2xl border border-[#3ce7ff]/30 bg-gradient-to-b from-[#071158]/90 to-[#030628]/95 p-4 sm:p-5 shadow-xl"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3ce7ff]/20 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#3ce7ff]/20 text-[#3ce7ff] font-sports text-xs font-black">
                      {rIdx + 1}
                    </span>
                    <div>
                      <h3 className="font-sports text-base sm:text-lg text-white font-bold tracking-wide">
                        {round.title}
                      </h3>
                      <p className="text-[11px] text-[#8e9bd4] font-mono">
                        {allStageTies.length} Knockout Matchups &middot; Eliminatory Bracket
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-[#050842] border border-[#3ce7ff]/40 px-3 py-1 text-[10px] font-black uppercase text-[#eaff28]">
                    Stage {rIdx + 1} of {bracketData.rounds.length + 1}
                  </span>
                </div>

                {/* Match Cards Grid - 1 col on mobile, 2 col on tablet, 4 col on desktop */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {round.leftTies.map((tie, idx) => (
                    <div key={tie.id} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-[#3ce7ff] px-1 font-mono">
                        <span>Left Wing {idx + 1}</span>
                        <span className="text-[#8e9bd4]">Path A</span>
                      </div>
                      <div className="w-full flex justify-center">
                        {renderTieCard(tie, false, true)}
                      </div>
                    </div>
                  ))}
                  {round.rightTies.map((tie, idx) => (
                    <div key={tie.id} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-[#3ce7ff] px-1 font-mono">
                        <span>Right Wing {idx + 1}</span>
                        <span className="text-[#8e9bd4]">Path B</span>
                      </div>
                      <div className="w-full flex justify-center">
                        {renderTieCard(tie, false, true)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Championship Apex: Grand Final & 3rd Place Match */}
          <div className="rounded-2xl border-2 border-[#eaff28]/40 bg-gradient-to-b from-[#0c1870] to-[#030628] p-5 sm:p-6 shadow-2xl">
            <div className="text-center mb-6">
              <GrandTrophy className="mx-auto h-14 w-14 mb-2 animate-bounce" />
              <span className="inline-block rounded-full bg-[#eaff28] px-3.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#050842] font-sports">
                CHAMPIONSHIP APEX
              </span>
              <h3 className="font-sports text-2xl sm:text-3xl text-white font-black mt-1">
                GRAND CHAMPIONSHIP FINAL &amp; PLAYOFFS
              </h3>
              <p className="text-xs text-[#3ce7ff] font-mono mt-0.5">
                The ultimate showdown for the Ethiopian eFootball Championship Crown
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
              {/* Grand Final Card */}
              {bracketData.finalTie && (
                <div className="flex flex-col items-center p-3 rounded-2xl border border-[#eaff28]/50 bg-[#071360]/80 shadow-lg">
                  <span className="flex items-center gap-1.5 font-sports text-xs font-black uppercase tracking-wider text-[#eaff28] mb-2">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>Grand Final 🏆</span>
                  </span>
                  {renderTieCard(bracketData.finalTie, true, true)}
                </div>
              )}

              {/* 3rd Place Card */}
              {bracketData.thirdPlaceTie && (
                <div className="flex flex-col items-center p-3 rounded-2xl border border-amber-400/40 bg-[#071360]/80 shadow-lg">
                  <span className="flex items-center gap-1.5 font-sports text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
                    <Medal className="h-3.5 w-3.5" />
                    <span>3rd Place Playoff 🥉</span>
                  </span>
                  {renderTieCard(bracketData.thirdPlaceTie, false, true)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ROUND-BY-ROUND CAROUSEL VIEW (OPTIONAL TABS) */}
      {/* ========================================================================= */}
      {viewLayout === 'tabs' && (
        <div className="space-y-4">
          {/* Round Selector Tabs */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-[#3ce7ff]/20">
            {bracketData.rounds.map((round, idx) => (
              <button
                key={`mob-tab-${round.stage}`}
                type="button"
                onClick={() => setMobileRoundIdx(idx)}
                className={`rounded-xl px-3 py-1.5 text-xs font-sports uppercase tracking-wider shrink-0 transition-colors border ${
                  mobileRoundIdx === idx
                    ? 'border-[#3ce7ff] bg-[#3ce7ff] text-[#050842] font-black shadow-md'
                    : 'border-[#3ce7ff]/30 bg-[#071360] text-[#b9c4f0]'
                }`}
              >
                {round.title}
              </button>
            ))}

            {/* Finals Tab */}
            <button
              type="button"
              onClick={() => setMobileRoundIdx(bracketData.rounds.length)}
              className={`rounded-xl px-3 py-1.5 text-xs font-sports uppercase tracking-wider shrink-0 transition-colors border ${
                mobileRoundIdx === bracketData.rounds.length
                  ? 'border-[#eaff28] bg-[#eaff28] text-[#050842] font-black shadow-md'
                  : 'border-[#eaff28]/40 bg-[#071360] text-[#eaff28]'
              }`}
            >
              Final &amp; 3rd Place 🏆
            </button>
          </div>

          {/* Display Current Round Ties */}
          {mobileRoundIdx < bracketData.rounds.length ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-sports text-lg text-white">
                  {bracketData.rounds[mobileRoundIdx].title}
                </h4>
                <span className="text-xs text-[#3ce7ff] font-mono">
                  {bracketData.rounds[mobileRoundIdx].leftTies.length +
                    bracketData.rounds[mobileRoundIdx].rightTies.length}{' '}
                  ties
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ...bracketData.rounds[mobileRoundIdx].leftTies,
                  ...bracketData.rounds[mobileRoundIdx].rightTies,
                ].map((tie) => (
                  <div key={tie.id} className="w-full flex justify-center">
                    {renderTieCard(tie, false, true)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Final & 3rd Place View on mobile */
            <div className="space-y-6 text-center">
              <GrandTrophy className="mx-auto h-16 w-16 mb-2" />
              <h4 className="font-sports text-xl text-[#eaff28]">Grand Championship Final</h4>

              {bracketData.finalTie && (
                <div className="flex justify-center">
                  {renderTieCard(bracketData.finalTie, true, true)}
                </div>
              )}

              {bracketData.thirdPlaceTie && (
                <div className="pt-4 border-t border-[#3ce7ff]/20">
                  <span className="font-sports text-xs font-bold text-amber-300 block mb-2">
                    3RD PLACE PLAYOFF 🥉
                  </span>
                  <div className="flex justify-center">
                    {renderTieCard(bracketData.thirdPlaceTie, false, true)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Arrows for Mobile Rounds */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={mobileRoundIdx === 0}
              onClick={() => setMobileRoundIdx((prev) => Math.max(0, prev - 1))}
              className="flex items-center gap-1 rounded-xl border border-[#3ce7ff]/40 bg-[#071360] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous Round</span>
            </button>

            <button
              type="button"
              disabled={mobileRoundIdx === bracketData.rounds.length}
              onClick={() => setMobileRoundIdx((prev) => Math.min(bracketData.rounds.length, prev + 1))}
              className="flex items-center gap-1 rounded-xl border border-[#3ce7ff]/40 bg-[#071360] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-30"
            >
              <span>Next Round</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. OFFICIAL CUP DRAW MATCH RESULTS & RECORDED SCORES HUB                  */}
      {/* ========================================================================= */}
      <div className="mt-10 rounded-3xl border-2 border-[#3ce7ff]/30 bg-gradient-to-b from-[#050e4a] via-[#03072e] to-[#01041c] p-4 sm:p-6 lg:p-7 shadow-2xl relative">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3ce7ff]/20 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border-2 border-[#eaff28] bg-[#071360] text-[#eaff28] shadow-lg shrink-0">
              <Trophy className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <p className="font-sports text-[10px] font-black uppercase tracking-[0.25em] text-[#eaff28]">
                OFFICIAL KNOCKOUT BULLETIN
              </p>
              <h3 className="font-sports text-xl sm:text-2xl text-white font-black tracking-wide">
                CUP DRAW MATCH RESULTS &amp; RECORDED SCORES
              </h3>
              <p className="text-xs text-[#3ce7ff] font-mono mt-0.5">
                {bracketData.stats.completedTies} of {bracketData.stats.totalTies} matches ended &middot; {bracketData.stats.totalGoals} total goals scored
              </p>
            </div>
          </div>

          {/* Quick Stage Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#030628] p-1 rounded-xl border border-[#3ce7ff]/30 text-xs">
            {[
              { id: 'all', label: 'All Matches' },
              { id: 'finals', label: 'Grand Final & 3rd Place' },
              { id: 'semis', label: 'Semi-finals' },
              ...(bracketData.rounds.some((r) => r.stage === 'quarter_final')
                ? [{ id: 'quarters', label: 'Quarter-finals' }]
                : []),
              ...(bracketData.rounds.some((r) => r.stage === 'round_of_16')
                ? [{ id: 'r16', label: 'Round of 16' }]
                : []),
            ].map((tab) => (
              <button
                key={`tab-${tab.id}`}
                type="button"
                onClick={() => setResultsStageFilter(tab.id as any)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-sports font-bold uppercase transition-all ${
                  resultsStageFilter === tab.id
                    ? 'bg-[#eaff28] text-[#050842] shadow-sm font-black'
                    : 'text-[#b9c4f0] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Champion Showcase Banner (if champion is crowned) */}
        {bracketData.champion && (
          <div className="mb-6 rounded-2xl border-2 border-[#eaff28] bg-gradient-to-r from-[#0c1970] via-[#071056] to-[#0c1970] p-4 text-center shadow-[0_0_25px_rgba(234,255,40,0.3)]">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <GrandTrophy className="h-10 w-10 text-[#eaff28] animate-bounce shrink-0" />
              <div>
                <span className="block font-sports text-[10px] font-black uppercase tracking-[0.3em] text-[#eaff28]">
                  👑 TOURNAMENT CHAMPION 👑
                </span>
                <h4 className="font-sports text-xl sm:text-2xl font-black text-white">
                  {bracketData.champion.team || bracketData.champion.user} (@{bracketData.champion.user})
                </h4>
              </div>
              {bracketData.finalTie?.loserUser && (
                <div className="text-left text-xs font-mono text-[#3ce7ff] border-l border-[#3ce7ff]/30 pl-3">
                  <span className="block text-[9px] uppercase text-[#8e9bd4]">Runner-Up</span>
                  <strong className="text-white">
                    {playerMap.get(bracketData.finalTie.loserUser)?.team || bracketData.finalTie.loserUser}
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Match Results Grid */}
        {(() => {
          const filteredTies = bracketData.allTies.filter((t) => {
            if (resultsStageFilter === 'finals') return t.stage === 'final' || t.stage === 'third_place';
            if (resultsStageFilter === 'semis') return t.stage === 'semi_final';
            if (resultsStageFilter === 'quarters') return t.stage === 'quarter_final';
            if (resultsStageFilter === 'r16') return t.stage === 'round_of_16';
            return true;
          });

          if (filteredTies.length === 0) {
            return (
              <div className="p-8 text-center text-xs text-[#8e9bd4] font-mono">
                No knockout match results recorded for this stage yet.
              </div>
            );
          }

          return (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTies.map((tie) => {
                const homeP = tie.home ? playerMap.get(tie.home.user) : undefined;
                const awayP = tie.away ? playerMap.get(tie.away.user) : undefined;
                const isCompleted = tie.isCompleted;

                return (
                  <div
                    key={`hub-tie-${tie.id}`}
                    onClick={() => setSelectedTie(tie)}
                    className={`rounded-2xl border p-3.5 transition-all cursor-pointer shadow-md ${
                      isCompleted
                        ? 'border-emerald-500/40 bg-[#061158]/95 hover:border-emerald-400 hover:bg-[#08166c]'
                        : 'border-[#3ce7ff]/25 bg-[#030730]/90 hover:border-[#3ce7ff]'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[#3ce7ff]/15 pb-2 mb-2.5 text-[10px]">
                      <span className="font-sports font-black uppercase tracking-wider text-[#3ce7ff] px-2 py-0.5 rounded bg-[#020528]">
                        {tie.stageBadge} &middot; {tie.stageName}
                      </span>
                      {isCompleted ? (
                        <span className="flex items-center gap-1 font-black uppercase text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Full Time</span>
                        </span>
                      ) : (
                        <span className="text-[#8e9bd4] font-mono">Scheduled</span>
                      )}
                    </div>

                    {/* Team 1 (Home) */}
                    <div className={`flex items-center justify-between py-1.5 px-2 rounded-xl mb-1 ${
                      tie.home?.isWinner ? 'bg-[#eaff28]/15 border border-[#eaff28]/50' : ''
                    }`}>
                      <div className="flex items-center gap-2 truncate pr-2">
                        <img
                          src={homeP?.avatarUrl}
                          alt=""
                          className={`h-6 w-6 rounded-full object-cover border ${
                            tie.home?.isWinner ? 'border-[#eaff28] ring-1 ring-[#eaff28]' : 'border-[#3ce7ff]/40'
                          }`}
                          referrerPolicy="no-referrer"
                        />
                        <div className="truncate">
                          <span className={`block font-sports text-xs truncate leading-tight ${
                            tie.home?.isWinner ? 'text-[#eaff28] font-bold' : 'text-white'
                          }`}>
                            {homeP?.team || tie.home?.user || 'TBD'}
                          </span>
                          <span className="block text-[9px] text-[#3ce7ff] font-mono truncate leading-tight">
                            @{tie.home?.user || 'pending'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {tie.penaltyHomeScore !== null && tie.penaltyHomeScore !== undefined && (
                          <span className="text-[9px] text-[#eaff28] font-mono">({tie.penaltyHomeScore}p)</span>
                        )}
                        <span className={`font-sports text-base font-black px-2 py-0.5 rounded ${
                          tie.home?.isWinner ? 'text-[#eaff28] bg-[#020528]' : 'text-white'
                        }`}>
                          {tie.home?.score !== null && tie.home?.score !== undefined ? tie.home.score : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Team 2 (Away) */}
                    <div className={`flex items-center justify-between py-1.5 px-2 rounded-xl ${
                      tie.away?.isWinner ? 'bg-[#eaff28]/15 border border-[#eaff28]/50' : ''
                    }`}>
                      <div className="flex items-center gap-2 truncate pr-2">
                        <img
                          src={awayP?.avatarUrl}
                          alt=""
                          className={`h-6 w-6 rounded-full object-cover border ${
                            tie.away?.isWinner ? 'border-[#eaff28] ring-1 ring-[#eaff28]' : 'border-[#3ce7ff]/40'
                          }`}
                          referrerPolicy="no-referrer"
                        />
                        <div className="truncate">
                          <span className={`block font-sports text-xs truncate leading-tight ${
                            tie.away?.isWinner ? 'text-[#eaff28] font-bold' : 'text-white'
                          }`}>
                            {awayP?.team || tie.away?.user || 'TBD'}
                          </span>
                          <span className="block text-[9px] text-[#3ce7ff] font-mono truncate leading-tight">
                            @{tie.away?.user || 'pending'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {tie.penaltyAwayScore !== null && tie.penaltyAwayScore !== undefined && (
                          <span className="text-[9px] text-[#eaff28] font-mono">({tie.penaltyAwayScore}p)</span>
                        )}
                        <span className={`font-sports text-base font-black px-2 py-0.5 rounded ${
                          tie.away?.isWinner ? 'text-[#eaff28] bg-[#020528]' : 'text-white'
                        }`}>
                          {tie.away?.score !== null && tie.away?.score !== undefined ? tie.away.score : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Footer with Venue & Admin Link */}
                    <div className="mt-2.5 pt-2 border-t border-[#3ce7ff]/10 flex items-center justify-between text-[10px] text-[#8e9bd4] font-mono">
                      <span>{tie.venue || 'PS5 • Online lobby'}</span>
                      {isAdmin && onSelectFixtureToRecord && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const matchedFixture = fixtures.find(
                              (f) =>
                                f.isKnockout &&
                                ((f.home === tie.home?.user && f.away === tie.away?.user) ||
                                  (f.home === tie.away?.user && f.away === tie.home?.user))
                            );
                            const matchedResult = results.find(
                              (r) =>
                                (r.isKnockout || !r.group) &&
                                ((r.home_user === tie.home?.user && r.away_user === tie.away?.user) ||
                                  (r.home_user === tie.away?.user && r.away_user === tie.home?.user))
                            );
                            if (matchedFixture) {
                              onSelectFixtureToRecord(matchedFixture, matchedResult);
                            }
                          }}
                          className="text-[#eaff28] hover:underline font-bold"
                        >
                          Edit in Desk &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ========================================================================= */}
      {/* 5. FULL BRACKET MODAL (CLEAR PHONE PAN & ZOOM WITH PROMINENT [X] BUTTONS) */}
      {/* ========================================================================= */}
      {isFullScreenOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#020520] flex flex-col animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          {/* Header Controls */}
          <div className="flex items-center justify-between border-b border-[#3ce7ff]/25 bg-[#050842] px-3 sm:px-4 py-2.5 shrink-0 z-20 shadow-md">
            {/* Top Left: Prominent Back button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFullScreenOpen(false)}
                className="flex items-center gap-1.5 rounded-xl border border-[#3ce7ff]/40 bg-[#071360] hover:bg-[#0c1e8a] px-3 py-1.5 text-xs font-bold text-white transition-all active:scale-95 shadow-md"
                title="Go back to tournament page"
              >
                <ChevronLeft className="h-4 w-4 text-[#3ce7ff]" />
                <span className="hidden xs:inline">Back</span>
              </button>

              <div className="flex items-center gap-1.5 text-white">
                <GrandTrophy className="h-5 w-5 text-[#eaff28]" />
                <span className="font-sports text-xs sm:text-sm font-black truncate max-w-[130px] sm:max-w-none">
                  Full Cup Bracket Graphics
                </span>
              </div>
            </div>

            {/* Center / Controls: Zoom & Fit */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={fitModalToScreen}
                className="rounded-lg border border-[#3ce7ff]/40 bg-[#071360] px-2.5 py-1 text-[11px] font-bold text-[#3ce7ff] hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors"
                title="Fit complete bracket to current screen without any cutting"
              >
                Fit Screen
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="rounded-lg border border-[#3ce7ff]/40 bg-[#071360] px-2.5 py-1 text-[11px] font-bold text-white hover:text-[#eaff28] transition-colors hidden sm:inline"
                title="View actual 1:1 size"
              >
                100%
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.18, Number((z - 0.15).toFixed(2))))}
                className="p-1.5 rounded-lg border border-[#3ce7ff]/40 bg-[#071360] text-white hover:text-[#eaff28] active:scale-95"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-[10px] font-mono text-[#3ce7ff] min-w-[34px] text-center hidden sm:inline">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
                className="p-1.5 rounded-lg border border-[#3ce7ff]/40 bg-[#071360] text-white hover:text-[#eaff28] active:scale-95"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </button>

              {/* Top-Right Prominent CLOSE [X] Button */}
              <button
                type="button"
                onClick={() => setIsFullScreenOpen(false)}
                className="flex items-center gap-1.5 rounded-xl border border-rose-400 bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1.5 text-xs font-black shadow-lg ml-2 active:scale-95 transition-all"
                title="Close Full Screen [Esc]"
              >
                <X className="h-4 w-4 stroke-[2.5]" />
                <span className="tracking-wide">CLOSE [X]</span>
              </button>
            </div>
          </div>

          {/* Mobile phone helper bar */}
          <div className="bg-[#050842]/90 border-b border-[#3ce7ff]/15 px-3 py-1 flex items-center justify-between text-[11px] text-[#8e9bd4] shrink-0 font-mono">
            <span className="flex items-center gap-1 truncate">
              <Move className="h-3 w-3 text-[#3ce7ff] shrink-0" />
              <span>Drag / swipe to pan &middot; Pinch or tap buttons to zoom &middot; Zero cropped parts</span>
            </span>
            <span className="text-[10px] text-[#eaff28] hidden md:inline">
              Press Escape to exit
            </span>
          </div>

          {/* Interactive Zoom & Pan Canvas */}
          <div
            className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing select-none bg-[#020520] flex items-center justify-center p-2"
            onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 1) {
                handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchEnd={handleDragEnd}
          >
            <div
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              {renderSymmetricalGraphic()}
            </div>
          </div>

          {/* Prominent Floating Bottom [X] Button for Easy Mobile Thumb Access */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
            <button
              type="button"
              onClick={() => setIsFullScreenOpen(false)}
              className="flex items-center gap-2 rounded-full border-2 border-white/90 bg-rose-600 hover:bg-rose-500 text-white px-6 py-2.5 text-xs font-black uppercase tracking-wider shadow-[0_0_30px_rgba(225,29,72,0.7)] active:scale-95 transition-transform"
            >
              <X className="h-4 w-4 stroke-[3]" />
              <span>Exit Full Graphics (X)</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TIE DETAIL MODAL (WHEN A TIE IS TAPPED) */}
      {/* ========================================================================= */}
      {selectedTie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border-2 border-[#3ce7ff] bg-gradient-to-b from-[#09115d] to-[#040632] p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 text-left">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#3ce7ff]/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[#eaff28] px-2.5 py-0.5 text-xs font-black text-[#050842] uppercase font-sports">
                  {selectedTie.stageBadge}
                </span>
                <h3 className="font-sports text-lg text-white font-bold">
                  {selectedTie.stageName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTie(null)}
                className="text-[#8e9bd4] hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Matchup Scoreboard */}
            <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#050842] p-4 text-center">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                {/* Home */}
                <div className="flex flex-col items-center">
                  {selectedTie.home ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedTie.home?.player && onSelectPlayer) {
                          onSelectPlayer(selectedTie.home.player);
                        }
                      }}
                      className="flex flex-col items-center group/card cursor-pointer focus:outline-none"
                      title={selectedTie.home?.player ? `View ${selectedTie.home.player.team}'s card` : undefined}
                    >
                      <img
                        src={selectedTie.home.player?.avatarUrl}
                        alt={selectedTie.home.player?.team || selectedTie.home.user}
                        className="h-14 w-14 rounded-full border-2 border-[#3ce7ff] object-cover shadow-md group-hover/card:scale-105 group-hover/card:border-[#eaff28] transition-all"
                        referrerPolicy="no-referrer"
                      />
                      <strong className="font-sports mt-2 block text-sm text-white truncate max-w-[130px] group-hover/card:text-[#eaff28] transition-colors">
                        {selectedTie.home.player?.team || selectedTie.home.user}
                      </strong>
                      <span className="text-[10px] text-[#3ce7ff] font-mono">
                        @{selectedTie.home.user}
                      </span>
                    </button>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-20 w-20 rounded-2xl bg-[#030628]/80 border border-[#3ce7ff]/20">
                      <Lock className="h-6 w-6 text-[#3ce7ff]/40" />
                    </div>
                  )}
                </div>

                {/* Score */}
                <div className="flex flex-col items-center px-2">
                  <div className="flex items-center gap-2 font-sports text-3xl font-black text-[#eaff28]">
                    <span>{selectedTie.home?.score !== null ? selectedTie.home?.score : '—'}</span>
                    <span className="text-[#8e9bd4] text-xl">:</span>
                    <span>{selectedTie.away?.score !== null ? selectedTie.away?.score : '—'}</span>
                  </div>
                  {selectedTie.penaltyWinner && (
                    <span className="mt-1 text-[10px] text-[#eaff28] font-mono font-bold">
                      ({selectedTie.penaltyHomeScore ?? 4}–{selectedTie.penaltyAwayScore ?? 3} on PK)
                    </span>
                  )}
                  <span className="mt-1 text-[9px] uppercase font-bold text-emerald-400">
                    {selectedTie.isCompleted
                      ? 'Official Score Recorded'
                      : 'Knockout Tie'}
                  </span>
                </div>

                {/* Away */}
                <div className="flex flex-col items-center">
                  {selectedTie.away ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedTie.away?.player && onSelectPlayer) {
                          onSelectPlayer(selectedTie.away.player);
                        }
                      }}
                      className="flex flex-col items-center group/card cursor-pointer focus:outline-none"
                      title={selectedTie.away?.player ? `View ${selectedTie.away.player.team}'s card` : undefined}
                    >
                      <img
                        src={selectedTie.away.player?.avatarUrl}
                        alt={selectedTie.away.player?.team || selectedTie.away.user}
                        className="h-14 w-14 rounded-full border-2 border-[#3ce7ff] object-cover shadow-md group-hover/card:scale-105 group-hover/card:border-[#eaff28] transition-all"
                        referrerPolicy="no-referrer"
                      />
                      <strong className="font-sports mt-2 block text-sm text-white truncate max-w-[130px] group-hover/card:text-[#eaff28] transition-colors">
                        {selectedTie.away.player?.team || selectedTie.away.user}
                      </strong>
                      <span className="text-[10px] text-[#3ce7ff] font-mono">
                        @{selectedTie.away.user}
                      </span>
                    </button>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-20 w-20 rounded-2xl bg-[#030628]/80 border border-[#3ce7ff]/20">
                      <Lock className="h-6 w-6 text-[#3ce7ff]/40" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tournament Records for each competitor */}
            {(selectedTie.home?.player || selectedTie.away?.player) && (
              <div className="rounded-xl border border-[#3ce7ff]/25 bg-[#050842] p-3 text-xs">
                <span className="block text-[10px] font-black uppercase tracking-wider text-[#eaff28] mb-2">
                  Tournament Record (P · W · D · L · GF : GA)
                </span>
                <div className="grid grid-cols-2 gap-3 divide-x divide-[#3ce7ff]/20">
                  <div className="pr-2">
                    <strong className="block text-white truncate text-[11px]">
                      {selectedTie.home?.player?.team || selectedTie.home?.user || 'Slot 1'}
                    </strong>
                    {selectedTie.home?.player ? (
                      <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-[#b9c4f0]">
                        <span>P: <strong className="text-white">{selectedTie.home.player.played}</strong></span>
                        <span>W: <strong className="text-emerald-400">{selectedTie.home.player.w}</strong></span>
                        <span>D: <strong className="text-amber-300">{selectedTie.home.player.d}</strong></span>
                        <span>L: <strong className="text-rose-400">{selectedTie.home.player.l}</strong></span>
                        <span>Goals: <strong className="text-[#eaff28]">{selectedTie.home.player.gf}:{selectedTie.home.player.ga}</strong></span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#8e9bd4] italic">Not decided</span>
                    )}
                  </div>

                  <div className="pl-3">
                    <strong className="block text-white truncate text-[11px]">
                      {selectedTie.away?.player?.team || selectedTie.away?.user || 'Slot 2'}
                    </strong>
                    {selectedTie.away?.player ? (
                      <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-[#b9c4f0]">
                        <span>P: <strong className="text-white">{selectedTie.away.player.played}</strong></span>
                        <span>W: <strong className="text-emerald-400">{selectedTie.away.player.w}</strong></span>
                        <span>D: <strong className="text-amber-300">{selectedTie.away.player.d}</strong></span>
                        <span>L: <strong className="text-rose-400">{selectedTie.away.player.l}</strong></span>
                        <span>Goals: <strong className="text-[#eaff28]">{selectedTie.away.player.gf}:{selectedTie.away.player.ga}</strong></span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#8e9bd4] italic">Not decided</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Match Information */}
            <div className="rounded-xl border border-[#3ce7ff]/20 bg-[#060a48] p-3 text-xs text-[#b9c4f0] space-y-1.5">
              <div className="flex justify-between">
                <span>Venue / Platform:</span>
                <strong className="text-white">{selectedTie.venue}</strong>
              </div>
              {selectedTie.dateStr && (
                <div className="flex justify-between">
                  <span>Recorded Date:</span>
                  <strong className="text-white">
                    {new Date(selectedTie.dateStr).toLocaleDateString()}
                  </strong>
                </div>
              )}
            </div>

            {/* Actions: Admin Edit / Trace Path */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {isAdmin && onSelectFixtureToRecord && (
                <button
                  type="button"
                  onClick={() => {
                    const matchedFixture = fixtures.find(
                      (f) =>
                        f.isKnockout &&
                        ((f.home === selectedTie.home?.user && f.away === selectedTie.away?.user) ||
                          (f.home === selectedTie.away?.user && f.away === selectedTie.home?.user))
                    );
                    const matchedResult = results.find(
                      (r) =>
                        r.isKnockout &&
                        ((r.home_user === selectedTie.home?.user && r.away_user === selectedTie.away?.user) ||
                          (r.home_user === selectedTie.away?.user && r.away_user === selectedTie.home?.user))
                    );
                    if (matchedFixture) {
                      onSelectFixtureToRecord(matchedFixture, matchedResult);
                      setSelectedTie(null);
                    }
                  }}
                  className="rounded-xl border border-[#eaff28] bg-[#eaff28]/15 px-4 py-2 text-xs font-black uppercase text-[#eaff28] hover:bg-[#eaff28] hover:text-[#050842] transition-colors"
                >
                  Edit / Record in Admin Desk
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedTie(null)}
                className="ml-auto rounded-xl border border-[#3ce7ff]/40 bg-[#071056] px-4 py-2 text-xs font-bold text-white hover:bg-[#091572]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
