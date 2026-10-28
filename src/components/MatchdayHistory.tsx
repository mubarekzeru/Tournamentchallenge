import React, { useRef, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flame,
  Layers,
  Swords,
  Trophy,
} from 'lucide-react';
import { Fixture, MatchResult, TournamentFormat } from '../types/tournament';

export type MatchdayFilter = 'all' | 'past' | 'upcoming' | 'postponed' | number | string;

interface MatchdayHistoryProps {
  totalMatchdays: number;
  currentFilter: MatchdayFilter;
  fixtures: Fixture[];
  results: MatchResult[];
  tournamentFormat?: TournamentFormat;
  onSelectFilter: (filter: MatchdayFilter) => void;
  onNavigateToBracket?: () => void;
}

export const MatchdayHistory: React.FC<MatchdayHistoryProps> = ({
  totalMatchdays,
  currentFilter,
  fixtures,
  results,
  tournamentFormat = 'league_double',
  onSelectFilter,
  onNavigateToBracket,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isGroupStage = tournamentFormat === 'group_stage';

  // Quick stats - only counting real matches passed in
  const totalMatches = fixtures.length;
  const completedMatches = results.filter((r) => !r.isPostponed).length;
  const postponedMatches = results.filter((r) => r.isPostponed).length;
  const upcomingMatches = Math.max(0, totalMatches - (completedMatches + postponedMatches));

  // Match lookup key: `matchday-home-away`
  const resultMap = new Set<string>();
  results.forEach((r) => {
    resultMap.add(`${r.matchday}-${r.home_user}-${r.away_user}`);
    resultMap.add(`${r.matchday}-${r.away_user}-${r.home_user}`);
  });

  // Unique groups in fixtures (Group A, Group B, Group C...)
  const groupList = useMemo(() => {
    const set = new Set<string>();
    fixtures.forEach((f) => {
      if (f.group) set.add(f.group);
    });
    return Array.from(set).sort();
  }, [fixtures]);

  // Existing knockout stages with real known players in fixtures
  const existingKnockoutStages = useMemo(() => {
    const stageMap: { id: string; name: string; count: number }[] = [];
    const qf = fixtures.filter((f) => f.knockoutStage === 'quarter_final');
    if (qf.length > 0) stageMap.push({ id: 'ko_quarter_final', name: 'Quarter-finals', count: qf.length });

    const sf = fixtures.filter((f) => f.knockoutStage === 'semi_final');
    if (sf.length > 0) stageMap.push({ id: 'ko_semi_final', name: 'Semi-finals', count: sf.length });

    const third = fixtures.filter((f) => f.knockoutStage === 'third_place');
    if (third.length > 0) stageMap.push({ id: 'ko_third_place', name: '3rd Place', count: third.length });

    const fin = fixtures.filter((f) => f.knockoutStage === 'final');
    if (fin.length > 0) stageMap.push({ id: 'ko_final', name: 'Final', count: fin.length });

    return stageMap;
  }, [fixtures]);

  // Calculate status for each matchday (for League Format)
  const matchdayStats = useMemo(() => {
    return Array.from({ length: totalMatchdays }, (_, i) => {
      const day = i + 1;
      const dayFixtures = fixtures.filter((f) => f.matchday === day);
      const dayTotal = dayFixtures.length;
      let dayCompleted = 0;
      let dayPostponed = 0;
      dayFixtures.forEach((f) => {
        const res = results.find(
          (r) =>
            r.matchday === f.matchday &&
            ((r.home_user === f.home && r.away_user === f.away) ||
              (r.home_user === f.away && r.away_user === f.home))
        );
        if (res) {
          if (res.isPostponed) {
            dayPostponed += 1;
          } else {
            dayCompleted += 1;
          }
        }
      });

      const isFullyPlayed = dayTotal > 0 && dayCompleted === dayTotal;
      const isPartiallyPlayed = dayCompleted > 0 && dayCompleted < dayTotal;
      const isUpcoming = dayCompleted === 0 && dayPostponed === 0;

      return {
        day,
        dayTotal,
        dayCompleted,
        dayPostponed,
        isFullyPlayed,
        isPartiallyPlayed,
        isUpcoming,
      };
    });
  }, [totalMatchdays, fixtures, results]);

  const nextActiveDay =
    matchdayStats.find((s) => !s.isFullyPlayed)?.day || 1;

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -220, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 220, behavior: 'smooth' });
    }
  };

  return (
    <div className="rounded-none sm:rounded-2xl border-x-0 sm:border-x border-y border-[#3ce7ff]/30 bg-gradient-to-b from-[#091055]/90 to-[#050842]/95 p-2.5 sm:p-4 shadow-xl mb-4 w-full">
      {/* Top Title & Quick Filters Row: Fully fitted edge-to-edge */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#3ce7ff]/15 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#eaff28]/50 bg-[#071056] text-[#eaff28]">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-sports text-sm sm:text-base text-white tracking-wide">
              {isGroupStage ? 'Group Stage & Knockout Navigator' : 'Matchday History & Fixture Navigator'}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-[#b9c4f0]">
              {isGroupStage
                ? 'Filter by groups, active knockout stages, or past and upcoming games'
                : 'Filter past results, upcoming matches, or toggle specific matchdays'}
            </p>
          </div>
        </div>

        {/* View Mode Pills: All | Past Games | Upcoming Matches (Full Fit Edge to Edge) */}
        <div className="flex items-center justify-between gap-1 bg-[#040632] p-1 rounded-xl border border-[#3ce7ff]/25 text-xs font-bold w-full sm:w-auto md:min-w-[440px]">
          <button
            type="button"
            onClick={() => onSelectFilter('all')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 text-[10.5px] sm:text-[11px] transition-all ${
              currentFilter === 'all'
                ? 'bg-[#3ce7ff] text-[#050842] shadow-[0_0_12px_rgba(60,231,255,0.4)] font-black'
                : 'text-[#b9c4f0] hover:text-white hover:bg-[#071056]'
            }`}
          >
            <span>All Fixtures</span>
            <span className="rounded-full bg-[#050842]/30 px-1 text-[9px]">
              {totalMatches}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectFilter('past')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1 text-[11px] transition-all ${
              currentFilter === 'past'
                ? 'bg-emerald-400 text-[#050842] shadow-[0_0_12px_rgba(52,211,153,0.4)] font-black'
                : 'text-[#b9c4f0] hover:text-white hover:bg-[#071056]'
            }`}
            title="Filter past played games with recorded scores"
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>Past Games</span>
            <span className="rounded-full bg-[#050842]/30 px-1 text-[9px]">
              {completedMatches}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectFilter('upcoming')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1 text-[11px] transition-all ${
              currentFilter === 'upcoming'
                ? 'bg-[#eaff28] text-[#050842] shadow-[0_0_12px_rgba(234,255,40,0.4)] font-black'
                : 'text-[#b9c4f0] hover:text-white hover:bg-[#071056]'
            }`}
            title="Filter upcoming pending fixtures"
          >
            <Clock className="h-3 w-3" />
            <span>Upcoming Matches</span>
            <span className="rounded-full bg-[#050842]/30 px-1 text-[9px]">
              {upcomingMatches}
            </span>
          </button>

          {postponedMatches > 0 && (
            <button
              type="button"
              onClick={() => onSelectFilter('postponed')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] transition-all ${
                currentFilter === 'postponed'
                  ? 'bg-amber-400 text-[#050842] shadow-[0_0_12px_rgba(251,191,36,0.5)] font-black'
                  : 'text-amber-300 hover:text-white hover:bg-amber-500/20'
              }`}
              title="Filter postponed matches"
            >
              <span>⏸</span>
              <span>Postponed</span>
              <span className="rounded-full bg-[#050842]/30 px-1 text-[9px] font-bold">
                {postponedMatches}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Group Stage Navigator: Group Chips + Confirmed Knockout Chips */}
      {isGroupStage ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#b9c4f0] mr-1">
            Browse By Stage:
          </span>

          {/* Bracket Chip: Takes visitor straight to the official bracket */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateToBracket) {
                onNavigateToBracket();
              } else {
                const el = document.getElementById('bracket');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-sports uppercase transition-all border border-[#eaff28]/60 bg-[#071360] text-[#eaff28] hover:bg-[#eaff28] hover:text-[#050842] shadow-[0_0_12px_rgba(234,255,40,0.25)]"
            title="Jump to the official cup knockout bracket"
          >
            <Trophy className="h-3.5 w-3.5 text-[#eaff28]" />
            <span>Bracket 🏆</span>
          </button>

          {/* Group Chips: Group A, Group B, Group C... */}
          {groupList.map((letter) => {
            const filterKey = `group_${letter}`;
            const isSelected = currentFilter === filterKey;
            const grpFixtures = fixtures.filter((f) => f.group === letter);
            const grpCompleted = results.filter(
              (r) =>
                grpFixtures.some(
                  (f) =>
                    f.matchday === r.matchday &&
                    f.home === r.home_user &&
                    f.away === r.away_user
                ) && !r.isPostponed
            ).length;

            return (
              <button
                key={letter}
                type="button"
                onClick={() => onSelectFilter(filterKey)}
                className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-sports uppercase transition-all border ${
                  isSelected
                    ? 'border-[#eaff28] bg-gradient-to-r from-[#eaff28] to-[#99ff33] text-[#050842] shadow-[0_0_15px_rgba(234,255,40,0.4)] font-black scale-105'
                    : 'border-[#3ce7ff]/30 bg-[#060a48] text-white hover:border-[#3ce7ff]'
                }`}
              >
                <span>GROUP {letter}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono ${
                    isSelected ? 'bg-[#050842] text-[#eaff28]' : 'bg-[#040632] text-[#3ce7ff]'
                  }`}
                >
                  {grpCompleted}/{grpFixtures.length}
                </span>
              </button>
            );
          })}

          {/* Knockout Chips: ONLY rendered if at least one match has both players known! */}
          {existingKnockoutStages.map((stage) => {
            const isSelected = currentFilter === stage.id;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelectFilter(stage.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-sports uppercase transition-all border ${
                  isSelected
                    ? 'border-[#eaff28] bg-gradient-to-r from-[#eaff28] to-[#99ff33] text-[#050842] shadow-[0_0_15px_rgba(234,255,40,0.4)] font-black scale-105'
                    : 'border-[#3ce7ff] bg-[#071360] text-[#eaff28] hover:border-[#eaff28]'
                }`}
              >
                <Swords className="h-3 w-3" />
                <span>{stage.name}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono ${
                    isSelected ? 'bg-[#050842] text-[#eaff28]' : 'bg-[#040632] text-white'
                  }`}
                >
                  {stage.count}m
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* League Format: Specific Matchdays Horizontal Carousel Bar */
        <div className="mt-3 relative flex items-center w-full">
          <button
            type="button"
            onClick={scrollLeft}
            className="hidden sm:flex shrink-0 h-7 w-7 items-center justify-center rounded-lg border border-[#3ce7ff]/30 bg-[#060a48] text-white hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors mr-1.5 z-10"
            aria-label="Scroll matchdays left"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div
            ref={scrollContainerRef}
            className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 scrollbar-none scroll-smooth w-full md:justify-between"
          >
            {matchdayStats.map((stat) => {
              const isSelected = currentFilter === stat.day;
              const isNextUp = stat.day === nextActiveDay && !stat.isFullyPlayed;

              return (
                <button
                  key={stat.day}
                  type="button"
                  onClick={() => onSelectFilter(stat.day)}
                  className={`group shrink-0 md:shrink md:flex-1 flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-sports uppercase transition-all border ${
                    isSelected
                      ? 'border-[#eaff28] bg-gradient-to-r from-[#eaff28] to-[#99ff33] text-[#050842] shadow-[0_0_15px_rgba(234,255,40,0.4)] font-black scale-105'
                      : isNextUp
                      ? 'border-[#3ce7ff] bg-[#071360] text-white hover:border-[#eaff28]'
                      : stat.isFullyPlayed
                      ? 'border-emerald-500/40 bg-[#061e38]/70 text-[#9fe6bc] hover:border-emerald-400'
                      : 'border-[#3ce7ff]/25 bg-[#050842]/80 text-[#b9c4f0] hover:border-[#3ce7ff] hover:text-white'
                  }`}
                >
                  <span>Matchday {stat.day}</span>

                  {stat.isFullyPlayed ? (
                    <span
                      className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-mono ${
                        isSelected
                          ? 'bg-[#050842] text-emerald-300'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                      }`}
                      title="All matches completed"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      <span>Done</span>
                    </span>
                  ) : isNextUp ? (
                    <span
                      className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-mono ${
                        isSelected
                          ? 'bg-[#050842] text-[#eaff28]'
                          : 'bg-[#eaff28]/15 text-[#eaff28] border border-[#eaff28]/40 animate-pulse'
                      }`}
                      title="Current active / upcoming matchday"
                    >
                      <Flame className="h-2.5 w-2.5" />
                      <span>Next</span>
                    </span>
                  ) : stat.isPartiallyPlayed ? (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono ${
                        isSelected
                          ? 'bg-[#050842] text-[#3ce7ff]'
                          : 'bg-[#071056] text-[#3ce7ff] border border-[#3ce7ff]/30'
                      }`}
                    >
                      {stat.dayCompleted}/{stat.dayTotal}
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono ${
                        isSelected ? 'bg-[#050842] text-gray-300' : 'text-[#8e9bd4]'
                      }`}
                    >
                      {stat.dayTotal}m
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={scrollRight}
            className="hidden sm:flex shrink-0 h-7 w-7 items-center justify-center rounded-lg border border-[#3ce7ff]/30 bg-[#060a48] text-white hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors ml-1.5 z-10"
            aria-label="Scroll matchdays right"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
