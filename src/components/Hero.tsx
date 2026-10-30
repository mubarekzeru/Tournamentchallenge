import React from 'react';
import { Users, Trophy, PlayCircle, Sparkles, Clock } from 'lucide-react';
import { Player, MatchResult, TournamentFormat, Fixture, GroupStageConfig, MatchClockConfig } from '../types/tournament';
import { CountryMatchClockBanner } from './CountryMatchClockBanner';
import { getDefaultClockConfig } from '../utils/countryClock';

interface HeroProps {
  players: Player[];
  results: MatchResult[];
  fixtures?: Fixture[];
  totalMatches?: number;
  totalMatchdays?: number;
  tournamentFormat?: TournamentFormat;
  config?: GroupStageConfig;
  showCountdown?: boolean;
  countdownTargetDate?: string;
  matchClockConfig?: MatchClockConfig;
  isAdmin?: boolean;
  onNavigateToAdminClock?: () => void;
  onToggleShowCountdown?: () => void;
  onScrollToFixtures: () => void;
  onScrollToTable: () => void;
  onOpenAIScout?: () => void;
  onSelectPlayer?: (player: Player) => void;
}

export const Hero: React.FC<HeroProps> = ({
  players,
  results,
  fixtures = [],
  totalMatches = 42,
  totalMatchdays = 14,
  tournamentFormat = 'league_double',
  config,
  showCountdown = true,
  countdownTargetDate,
  matchClockConfig,
  isAdmin = false,
  onNavigateToAdminClock,
  onToggleShowCountdown,
  onScrollToFixtures,
  onScrollToTable,
  onOpenAIScout,
  onSelectPlayer,
}) => {
  const effectiveClockConfig: MatchClockConfig = matchClockConfig || {
    ...getDefaultClockConfig(),
    enabled: showCountdown,
    startDate: countdownTargetDate || getDefaultClockConfig().startDate,
  };
  const leader = players[0];
  const completedMatches = results.filter((r) => !r.isPostponed).length;
  const postponedMatches = results.filter((r) => r.isPostponed).length;
  const progressPct =
    totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

  const formatDescription =
    players.length === 0
      ? 'Tournament roster is awaiting player registration. Matches will start soon!'
      : tournamentFormat === 'knockout' ||
        tournamentFormat === 'group_knockout' ||
        tournamentFormat === 'knockout_cup'
      ? `${players.length} contestants battling in direct single-elimination Knockout. High-stakes sudden-death ties through Quarter-Finals, Semi-Finals, 3rd Place Playoff, and Grand Final.`
      : tournamentFormat === 'group_stage'
      ? `${players.length} players partitioned into groups on a single league. Top promoted players face off in the single-leg Knockout Stage.`
      : tournamentFormat === 'league_single'
      ? `${players.length} players · ${totalMatchdays} matchdays. Single round-robin league where every participant faces each rival once. The unified table crowns the champion.`
      : `${players.length} players · ${totalMatchdays} matchdays. Complete Premier Championship where every participant meets all competitors twice (Home & Away).`;

  return (
    <section id="challenge" className="relative pt-3 sm:pt-5 pb-4 sm:pb-6 border-b border-[#3ce7ff]/20 scroll-mt-[105px] w-full px-2 sm:px-4 font-efootball-stencil">
      <div className="mx-auto max-w-4xl md:max-w-5xl lg:max-w-6xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#eaff28]/40 bg-[#071056]/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#eaff28] font-efootball-stencil">
          <span className="h-1.5 w-1.5 rounded-full bg-[#eaff28] animate-pulse" />
          Season One · Official Championship
        </div>

        <h1 className="font-efootball-stencil mt-2 text-2xl sm:text-4xl md:text-5xl leading-[1.1] tracking-tight text-white font-bold">
          eFootball tournament <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3ce7ff] via-white to-[#eaff28]">challenge</span>
        </h1>

        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#c5cef9] max-w-xl md:max-w-2xl mx-auto font-efootball-stencil">
          {formatDescription}
        </p>

        {/* Quick Badges */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:gap-3 font-efootball-stencil w-full md:max-w-3xl mx-auto">
          <div className="flex items-center gap-1.5 rounded-full border border-[#3ce7ff]/50 bg-[#071056] px-3 py-1 text-xs font-bold text-[#3ce7ff]">
            <Users className="h-3.5 w-3.5" />
            <span>{players.length} PLAYERS</span>
          </div>

          <button
            type="button"
            onClick={onScrollToFixtures}
            className="flex items-center gap-1.5 rounded-full bg-[#eaff28] px-3.5 py-1 text-xs font-bold text-[#071056] transition-transform hover:scale-105 active:scale-95 cursor-pointer font-efootball-stencil"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            <span>{totalMatches} MATCHES</span>
          </button>

          <button
            type="button"
            onClick={onScrollToTable}
            className="flex items-center gap-1.5 rounded-full border border-[#3ce7ff]/30 bg-[#080d51] px-3 py-1 text-xs font-bold text-[#b9c4f0] transition-colors hover:border-[#3ce7ff] hover:text-white cursor-pointer font-efootball-stencil"
          >
            <Trophy className="h-3.5 w-3.5 text-[#eaff28]" />
            <span>{totalMatchdays} MATCHDAYS</span>
          </button>

          {onOpenAIScout && (
            <button
              type="button"
              onClick={onOpenAIScout}
              className="flex items-center gap-1.5 rounded-full border border-[#eaff28]/60 bg-[#eaff28]/15 px-3 py-1 text-xs font-bold text-[#eaff28] shadow-[0_0_15px_rgba(234,255,40,0.2)] transition-transform hover:scale-105 cursor-pointer font-efootball-stencil"
              title="Open AI Tactics Scout with Live Google Search"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI SCOUT</span>
            </button>
          )}
        </div>

        {/* Live Country Clock, Match Starting Date & Ending Due Date Countdown Banner */}
        {effectiveClockConfig.enabled && (
          <div className="mt-5">
            <CountryMatchClockBanner
              config={effectiveClockConfig}
              isAdmin={isAdmin}
              onNavigateToAdminClock={onNavigateToAdminClock}
              onScrollToFixtures={onScrollToFixtures}
            />
          </div>
        )}

        {/* Match Starts Soon Announcement Banner when no players are registered */}
        {players.length === 0 && (
          <div className="mt-4 mx-auto max-w-lg md:max-w-2xl lg:max-w-3xl rounded-2xl border-2 border-[#eaff28] bg-gradient-to-r from-[#071056] via-[#0d1872] to-[#071056] p-4 sm:p-5 text-center shadow-[0_0_35px_rgba(234,255,40,0.3)] font-efootball-stencil w-full">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#eaff28] px-3 py-1 text-xs font-black uppercase text-[#050842] shadow-sm">
              <Clock className="h-3.5 w-3.5" />
              <span>Season Kickoff Pending</span>
            </div>
            <h2 className="mt-2.5 font-efootball-stencil font-sports text-2xl sm:text-3xl font-black text-white tracking-wide">
              MATCH STARTS SOON
            </h2>
            <p className="mt-1 text-xs text-[#3ce7ff] font-mono leading-relaxed">
              Official player registration is underway. Live fixtures, matchday schedules, and championship table will appear as soon as competitors are registered.
            </p>
          </div>
        )}

        {/* Live Leaderboard Teaser */}
        {leader && leader.played > 0 && (
          <div className="mt-4 mx-auto max-w-md md:max-w-2xl lg:max-w-3xl rounded-xl border border-[#3ce7ff]/30 bg-gradient-to-r from-[#071056]/80 via-[#0d1675]/80 to-[#071056]/80 p-2.5 sm:p-3.5 shadow-lg font-efootball-stencil w-full">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#eaff28] text-[10px] font-bold text-[#050842]">
                  1
                </span>
                <span className="font-bold text-white">Current Leader:</span>
                <span className="font-efootball-stencil font-club-name text-sm text-[#eaff28] font-bold" data-club-name="true">{leader.team || leader.user}</span>
                <span className="text-[10px] text-[#b9c4f0]">({leader.points} PTS)</span>
              </div>
              <div className="text-[11px] font-medium text-[#3ce7ff]">
                {completedMatches}/{totalMatches} Matches Played ({progressPct}%)
                {postponedMatches > 0 && (
                  <span className="ml-1.5 text-amber-300 font-semibold">
                    · {postponedMatches} postponed
                  </span>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#050842]">
              <div
                className="h-full bg-gradient-to-r from-[#3ce7ff] to-[#eaff28] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

