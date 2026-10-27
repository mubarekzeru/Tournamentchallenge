import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Edit3,
  PlusCircle,
  PlayCircle,
  Search,
  Filter,
  Swords,
  Trophy,
} from 'lucide-react';
import { Fixture, MatchResult, Player, TournamentFormat, GroupStageConfig } from '../types/tournament';
import { MatchdayHistory, MatchdayFilter } from './MatchdayHistory';
import { KnockoutBracket } from './KnockoutBracket';
import { filterRealMatchesOnly } from '../utils/groupStage';

interface FixturesSectionProps {
  fixtures: Fixture[];
  results: MatchResult[];
  players: Player[];
  isAdmin: boolean;
  tournamentFormat?: TournamentFormat;
  config?: GroupStageConfig;
  onSelectFixtureToRecord: (fixture: Fixture, existingResult?: MatchResult) => void;
  onDeleteResult: (resultId: string) => void;
  onNavigateToBracket?: () => void;
  onSelectPlayer?: (player: Player) => void;
}

// Clean Club Name & Username Display: Club name on top, player username strictly under it on its own line
const ClubNameBadge: React.FC<{
  name: string;
  username: string;
  isHome: boolean;
}> = ({ name, username, isHome }) => {
  return (
    <div
      className={`w-full min-w-0 flex flex-col justify-center overflow-hidden ${
        isHome ? 'text-right items-end pr-0.5' : 'text-left items-start pl-0.5'
      }`}
    >
      <span
        className="font-efootball-stencil font-club-name font-sports block text-[10px] sm:text-[11px] md:text-xs font-bold text-white group-hover:text-[#eaff28] transition-colors leading-tight truncate max-w-full tracking-normal"
        title={name}
        data-club-name="true"
      >
        {name}
      </span>
      <span className="block text-[7.5px] sm:text-[8.5px] md:text-[9px] text-[#3ce7ff] font-mono leading-none truncate max-w-full mt-0.5 font-medium tracking-normal">
        @{username}
      </span>
    </div>
  );
};

export const FixturesSection: React.FC<FixturesSectionProps> = ({
  fixtures: rawFixtures,
  results,
  players,
  isAdmin,
  tournamentFormat = 'league_double',
  onSelectFixtureToRecord,
  onDeleteResult,
  onNavigateToBracket,
  onSelectPlayer,
}) => {
  // CRITICAL: NEVER show placeholder matches or unknown matchups
  const fixtures = useMemo(() => filterRealMatchesOnly(rawFixtures), [rawFixtures]);

  const isKnockout =
    tournamentFormat === 'knockout' ||
    tournamentFormat === 'group_knockout' ||
    tournamentFormat === 'knockout_cup';
  const isGroupStage = tournamentFormat === 'group_stage';
  const [matchdayFilter, setMatchdayFilter] = useState<MatchdayFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showBracket, setShowBracket] = useState<boolean>(false);

  const playerMap = useMemo(
    () => new Map<string, Player>(players.map((p) => [p.user, p])),
    [players]
  );

  // Match lookup key: `matchday-home-away`
  const resultMap = useMemo(() => {
    const map = new Map<string, MatchResult>();
    results.forEach((r) => {
      map.set(`${r.matchday}-${r.home_user}-${r.away_user}`, r);
      map.set(`${r.matchday}-${r.away_user}-${r.home_user}`, r);
      if (r.isKnockout) {
        map.set(`ko-${r.home_user}-${r.away_user}`, r);
        map.set(`ko-${r.away_user}-${r.home_user}`, r);
      }
    });
    return map;
  }, [results]);

  const isFixtureCompleted = (f: Fixture) => {
    const res = f.isKnockout
      ? resultMap.get(`ko-${f.home}-${f.away}`)
      : resultMap.get(`${f.matchday}-${f.home}-${f.away}`);
    return !!res && !res.isPostponed;
  };

  const isFixturePostponed = (f: Fixture) => {
    const res = f.isKnockout
      ? resultMap.get(`ko-${f.home}-${f.away}`)
      : resultMap.get(`${f.matchday}-${f.home}-${f.away}`);
    return !!res && !!res.isPostponed;
  };

  const isAll = matchdayFilter === 'all';
  const isPastOnly = matchdayFilter === 'past';
  const isUpcomingOnly = matchdayFilter === 'upcoming';
  const isPostponedOnly = matchdayFilter === 'postponed';
  const isSingleDay = typeof matchdayFilter === 'number';
  const isGroupFilter = typeof matchdayFilter === 'string' && matchdayFilter.startsWith('group_');
  const isKnockoutFilter = typeof matchdayFilter === 'string' && matchdayFilter.startsWith('ko_');

  const totalMatchdays =
    fixtures.length > 0 ? Math.max(...fixtures.map((f) => f.matchday)) : 14;

  const isMatchSearch = (f: Fixture) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const homeP = playerMap.get(f.home);
    const awayP = playerMap.get(f.away);
    return (
      f.home.toLowerCase().includes(q) ||
      f.away.toLowerCase().includes(q) ||
      (homeP?.team && homeP.team.toLowerCase().includes(q)) ||
      (awayP?.team && awayP.team.toLowerCase().includes(q))
    );
  };


  // Filter fixtures
  const filteredFixtures = useMemo(() => {
    let list = fixtures;
    if (matchdayFilter === 'past') {
      list = fixtures.filter(isFixtureCompleted);
    } else if (matchdayFilter === 'upcoming') {
      list = fixtures.filter((f) => !isFixtureCompleted(f) && !isFixturePostponed(f));
    } else if (matchdayFilter === 'postponed') {
      list = fixtures.filter(isFixturePostponed);
    } else if (typeof matchdayFilter === 'number') {
      list = fixtures.filter((f) => f.matchday === matchdayFilter);
    } else if (isGroupFilter) {
      const letter = (matchdayFilter as string).replace('group_', '');
      list = fixtures.filter((f) => f.group === letter);
    } else if (isKnockoutFilter) {
      const stageType = (matchdayFilter as string).replace('ko_', '');
      list = fixtures.filter((f) => f.knockoutStage === stageType);
    }
    return list.filter(isMatchSearch);
  }, [matchdayFilter, fixtures, results, isGroupFilter, isKnockoutFilter, searchQuery]);

  // Counts for summary line
  const groupMatchesCount = useMemo(() => fixtures.filter((f) => !f.isKnockout).length, [fixtures]);
  const knockoutMatchesCount = useMemo(() => fixtures.filter((f) => f.isKnockout).length, [fixtures]);
  const knockoutFixturesList = useMemo(() => fixtures.filter((f) => f.isKnockout), [fixtures]);

  // Section Grouping:
  // In Group Stage mode: group by Group A, Group B, Group C... then Knockout stages!
  // In League mode: group by Matchday
  const groupedSections = useMemo(() => {
    interface FixtureSectionItem {
      key: string;
      title: string;
      subtitle: string;
      fixtures: Fixture[];
      rest?: string | null;
      isKnockout?: boolean;
    }

    if (isKnockout) {
      // Direct Knockout Mode: Group by knockout rounds
      const sections: FixtureSectionItem[] = [];
      const koStages: { type: string; title: string }[] = [
        { type: 'quarter_final', title: 'QUARTER-FINALS' },
        { type: 'semi_final', title: 'SEMI-FINALS' },
        { type: 'third_place', title: '3RD PLACE PLAYOFF 🥉' },
        { type: 'final', title: 'GRAND FINAL 🏆' },
      ];

      koStages.forEach((st) => {
        const stageFixtures = filteredFixtures.filter((f) => f.isKnockout && f.knockoutStage === st.type);
        if (stageFixtures.length > 0) {
          sections.push({
            key: `ko-${st.type}`,
            title: st.title,
            subtitle: `${stageFixtures.length} match(es) · Knockout Tie`,
            fixtures: stageFixtures,
            isKnockout: true,
          });
        }
      });
      return sections;
    }

    if (!isGroupStage) {
      // Group by matchday (League mode)
      const days = Array.from(new Set(filteredFixtures.map((f) => f.matchday))).sort((a, b) => a - b);
      return days.map((day): FixtureSectionItem => ({
        key: `md-${day}`,
        title: `Matchday ${day}`,
        subtitle: `${fixtures.filter((f) => f.matchday === day).length} matches`,
        fixtures: filteredFixtures.filter((f) => f.matchday === day),
        rest: fixtures.filter((f) => f.matchday === day)[0]?.rest,
        isKnockout: false,
      }));
    }

    // In Group Stage mode:
    const sections: FixtureSectionItem[] = [];

    // Distinct groups present
    const groupLetters = Array.from(
      new Set(filteredFixtures.filter((f) => !f.isKnockout && f.group).map((f) => f.group!))
    ).sort();

    groupLetters.forEach((letter) => {
      const grpFixtures = filteredFixtures.filter((f) => !f.isKnockout && f.group === letter);
      if (grpFixtures.length > 0) {
        sections.push({
          key: `group-${letter}`,
          title: `GROUP ${letter}`,
          subtitle: `${grpFixtures.length} matches · Round-robin`,
          fixtures: grpFixtures,
          isKnockout: false,
        });
      }
    });

    // Knockout groups (Quarter-finals, Semi-finals, Finals)
    const koStages: { type: string; title: string }[] = [
      { type: 'quarter_final', title: 'QUARTER-FINALS' },
      { type: 'semi_final', title: 'SEMI-FINALS' },
      { type: 'third_place', title: '3RD PLACE PLAYOFF' },
      { type: 'final', title: 'GRAND FINAL 🏆' },
    ];

    koStages.forEach((st) => {
      const stageFixtures = filteredFixtures.filter((f) => f.isKnockout && f.knockoutStage === st.type);
      if (stageFixtures.length > 0) {
        sections.push({
          key: `ko-${st.type}`,
          title: st.title,
          subtitle: `${stageFixtures.length} match(es) · Knockout Playoff`,
          fixtures: stageFixtures,
          isKnockout: true,
        });
      }
    });

    return sections;
  }, [isKnockout, isGroupStage, filteredFixtures, fixtures]);

  // Match label resolver (e.g. "Group A · Round 2" or "Semi-final 1")
  const getMatchStageLabel = (fixture: Fixture) => {
    if (fixture.isKnockout) {
      return fixture.stage || 'Knockout Match';
    }
    if (isGroupStage && fixture.group) {
      return `Group ${fixture.group} · Round ${fixture.round || fixture.matchday}`;
    }
    return `Matchday ${fixture.matchday}`;
  };


  const renderFixtureRow = (fixture: Fixture) => {
    const key = fixture.isKnockout
      ? `ko-${fixture.home}-${fixture.away}`
      : `${fixture.matchday}-${fixture.home}-${fixture.away}`;
    const result = resultMap.get(key);
    const isPostponed = !!result?.isPostponed;
    const isCompleted = !!result && !isPostponed;

    const homeP = playerMap.get(fixture.home);
    const awayP = playerMap.get(fixture.away);

    return (
      <div
        key={fixture.id}
        className={`group relative flex items-center justify-between rounded-lg sm:rounded-xl border px-1 py-1 sm:px-2 sm:py-1.5 transition-all ${
          isPostponed
            ? 'border-amber-400/40 bg-[#0d104a]/85 hover:border-amber-400 hover:bg-[#121658]'
            : 'border-[#3ce7ff]/20 bg-[#080c50]/75 hover:border-[#3ce7ff]/60 hover:bg-[#0d1466]'
        }`}
      >
        {/* Round Badge inside row on larger screens */}
        {isGroupStage && (
          <div className="shrink-0 hidden md:block mr-1.5">
            <span className="rounded border border-[#3ce7ff]/30 bg-[#040632] px-1 py-0.5 text-[8.5px] font-mono font-bold text-[#3ce7ff]">
              {fixture.isKnockout
                ? (fixture.knockoutStage === 'final' ? 'Final' : fixture.stage?.split(' ')[0] || 'KO')
                : `R${fixture.round || fixture.matchday}`}
            </span>
          </div>
        )}

        {/* Home & Away Grid: Interactive player triggers to pop up Player Dossier Modal */}
        <div className="grid w-full flex-1 grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-2 min-w-0">
          {/* Home Player Trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (homeP && onSelectPlayer) onSelectPlayer(homeP);
            }}
            className="flex items-center justify-end gap-1 sm:gap-2 min-w-0 flex-1 overflow-hidden cursor-pointer group/home text-right hover:opacity-95 transition-all rounded-lg p-0.5 focus:outline-none focus:ring-1 focus:ring-[#3ce7ff]"
            title={`View ${homeP?.team || fixture.home} (@${fixture.home}) Profile Card`}
          >
            <ClubNameBadge
              name={homeP?.team || fixture.home}
              username={fixture.home}
              isHome={true}
            />
            <img
              className="h-5 w-5 sm:h-6 sm:w-6 rounded-full border border-[#3ce7ff]/60 object-cover shrink-0 shadow-sm group-hover/home:border-[#eaff28] group-hover/home:scale-105 transition-all"
              src={homeP?.avatarUrl}
              alt={homeP?.team || fixture.home}
              referrerPolicy="no-referrer"
            />
          </button>

          {/* Score or VS in center with tiny status indicator */}
          <div className="flex flex-col items-center justify-center shrink-0 min-w-[36px] sm:min-w-[44px] px-0.5 text-center">
            {isCompleted ? (
              <div className="flex flex-col items-center">
                <span className="rounded border border-[#3ce7ff]/50 bg-[#050842] px-1 sm:px-1.5 py-0.5 font-sports text-[10px] sm:text-[11px] font-black text-[#eaff28] shadow-sm leading-tight">
                  {result.home_score} - {result.away_score}
                </span>
                {result.penaltyWinner ? (
                  <span className="text-[7px] sm:text-[7.5px] font-bold text-[#eaff28] uppercase mt-0.5 leading-none">
                    (pens)
                  </span>
                ) : (
                  <span className="text-[7px] sm:text-[7.5px] font-mono font-bold text-emerald-400 mt-0.5 leading-none">
                    FT
                  </span>
                )}
              </div>
            ) : isPostponed ? (
              <div className="flex flex-col items-center">
                <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[7.5px] sm:text-[8px] font-bold text-amber-300 border border-amber-500/40 leading-tight">
                  PPD
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="rounded border border-[#3ce7ff]/30 bg-[#050842]/85 px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold text-[#b9c4f0] leading-tight">
                  VS
                </span>
                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[7px] sm:text-[7.5px] font-mono text-[#8e9bd4] leading-none">
                  <Clock className="h-2 w-2 text-[#3ce7ff]" />
                  <span>SCH</span>
                </span>
              </div>
            )}
          </div>

          {/* Away Player Trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (awayP && onSelectPlayer) onSelectPlayer(awayP);
            }}
            className="flex items-center justify-start gap-1 sm:gap-2 min-w-0 flex-1 overflow-hidden cursor-pointer group/away text-left hover:opacity-95 transition-all rounded-lg p-0.5 focus:outline-none focus:ring-1 focus:ring-[#3ce7ff]"
            title={`View ${awayP?.team || fixture.away} (@${fixture.away}) Profile Card`}
          >
            <img
              className="h-5 w-5 sm:h-6 sm:w-6 rounded-full border border-[#3ce7ff]/60 object-cover shrink-0 shadow-sm group-hover/away:border-[#eaff28] group-hover/away:scale-105 transition-all"
              src={awayP?.avatarUrl}
              alt={awayP?.team || fixture.away}
              referrerPolicy="no-referrer"
            />
            <ClubNameBadge
              name={awayP?.team || fixture.away}
              username={fixture.away}
              isHome={false}
            />
          </button>
        </div>

        {/* Admin Quick Action Button (compact and right-aligned) */}
        {isAdmin && (
          <div className="ml-1 sm:ml-2 shrink-0">
            <button
              type="button"
              onClick={() => onSelectFixtureToRecord(fixture, result)}
              className="flex items-center gap-1 rounded bg-[#eaff28]/15 border border-[#eaff28]/50 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold text-[#eaff28] hover:bg-[#eaff28] hover:text-[#08104e] transition-colors"
              title="Edit Score"
            >
              <Edit3 className="h-2.5 w-2.5" />
              <span className="hidden sm:inline">{isCompleted ? 'Edit' : 'Score'}</span>
            </button>
          </div>
        )}
      </div>
    );
  };


  return (
    <section id="fixtures" className="py-4 sm:py-6 border-b border-[#3ce7ff]/20 scroll-mt-[105px] w-full px-0 sm:px-1">
      {/* Title Header */}
      <div className="flex flex-wrap items-end justify-between gap-2.5 mb-3 px-2 sm:px-1">
        <div>
          <p className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#eaff28]">
            {isKnockout ? 'Knockout Fixtures & Bracket Ties' : isGroupStage ? 'Group Stage Fixtures & Playoffs' : 'Match Schedule'}
          </p>
          <h2 className="font-efootball-stencil mt-0.5 text-xl sm:text-2xl text-white font-bold">
            {isKnockout ? 'Knockout Tournament Fixtures' : isGroupStage ? 'Tournament Fixtures' : 'Match Fixtures'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Knockout Bracket Toggle Button */}
          {isGroupStage && knockoutFixturesList.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBracket((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-sports font-bold tracking-wider transition-all ${
                showBracket
                  ? 'border-[#eaff28] bg-[#eaff28] text-[#050842] shadow-[0_0_12px_rgba(234,255,40,0.4)]'
                  : 'border-[#3ce7ff] bg-[#071360] text-white hover:border-[#eaff28]'
              }`}
            >
              <Swords className="h-3.5 w-3.5" />
              <span>{showBracket ? 'Hide Bracket' : 'View Playoff Bracket'}</span>
            </button>
          )}

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8e9bd4]" />
            <input
              id="schedule-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team or player..."
              className="w-full rounded-full border border-[#3ce7ff]/60 bg-[#060a48] py-1.5 pl-8 pr-3 text-xs text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Bracket View (if toggled) */}
      {isGroupStage && showBracket && knockoutFixturesList.length > 0 && (
        <KnockoutBracket
          knockoutFixtures={knockoutFixturesList}
          results={results}
          playerMap={playerMap}
          onSelectFixture={(f, r) => {
            if (isAdmin) onSelectFixtureToRecord(f, r);
          }}
          onSelectPlayer={onSelectPlayer}
        />
      )}

      {/* Dedicated Navigator */}
      <MatchdayHistory
        totalMatchdays={totalMatchdays}
        currentFilter={matchdayFilter}
        fixtures={fixtures}
        results={results}
        tournamentFormat={tournamentFormat}
        onSelectFilter={(filter) => setMatchdayFilter(filter)}
        onNavigateToBracket={onNavigateToBracket}
      />

      {/* Summary line: MUST only count listed matches and use correct words */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-none sm:rounded-xl border-x-0 sm:border-x border-y border-[#3ce7ff]/20 bg-[#071056]/60 px-3 py-2 text-xs text-[#b9c4f0] w-full">
        <span>
          {isGroupStage ? (
            isAll ? (
              knockoutMatchesCount > 0
                ? `${groupMatchesCount} group matches · ${knockoutMatchesCount} knockout matches (${fixtures.length} total)`
                : `${groupMatchesCount} group matches (all groups)`
            ) : isPastOnly ? (
              `Past Games · ${filteredFixtures.length} completed matches with official results`
            ) : isUpcomingOnly ? (
              `Upcoming Matches · ${filteredFixtures.length} pending fixtures`
            ) : isGroupFilter ? (
              `GROUP ${(matchdayFilter as string).replace('group_', '')} · Showing ${filteredFixtures.length} matches`
            ) : (
              `Showing ${filteredFixtures.length} listed matches`
            )
          ) : (
            isAll ? (
              `All matches (${fixtures.length} total) across all ${totalMatchdays} matchdays`
            ) : isPastOnly ? (
              `Past Games · Showing ${filteredFixtures.length} completed matches`
            ) : isUpcomingOnly ? (
              `Upcoming Matches · Showing ${filteredFixtures.length} pending fixtures`
            ) : (
              `Matchday ${matchdayFilter} · ${filteredFixtures.length} matches`
            )
          )}
        </span>
        <span className="text-[10px] uppercase font-bold text-[#3ce7ff]">
          {filteredFixtures.length} Real Matches
        </span>
      </div>

      {/* Fixtures List: Fully edge-to-edge without gaps */}
      <div className="mt-3 overflow-hidden rounded-none sm:rounded-2xl border-x-0 sm:border-x border-y border-[#3ce7ff]/30 bg-gradient-to-b from-[#0a0f52]/90 to-[#050842]/95 shadow-xl w-full">
        {groupedSections.length > 0 ? (
          <div className="divide-y divide-[#3ce7ff]/15">
            {groupedSections.map((section) => (
              <div key={section.key} className="p-1.5 sm:p-3 md:p-4">
                {/* Section Header: e.g. GROUP A, GROUP B, or SEMI-FINALS */}
                <div className="mb-2 flex items-center justify-between border-b border-[#3ce7ff]/20 pb-1.5 px-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-sports rounded px-2 py-0.5 text-xs sm:text-sm font-black ${
                        section.isKnockout
                          ? 'bg-gradient-to-r from-[#eaff28] to-[#99ff33] text-[#050842] shadow-[0_0_12px_rgba(234,255,40,0.35)]'
                          : 'bg-[#071360] border border-[#3ce7ff]/40 text-[#eaff28]'
                      }`}
                    >
                      {section.title}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-[#3ce7ff] font-mono">
                      ({section.fixtures.length} {section.fixtures.length === 1 ? 'match' : 'matches'})
                    </span>
                  </div>

                  {!isGroupStage && section.rest && (
                    <span className="text-[10px] sm:text-[11px] text-[#b9c4f0]">
                      Resting: <strong className="text-[#eaff28]">{section.rest}</strong>
                    </span>
                  )}
                </div>

                <div className="space-y-1 sm:space-y-1.5">
                  {section.fixtures.map((f) => renderFixtureRow(f))}
                </div>
              </div>
            ))}
          </div>
        ) : players.length === 0 ? (
          <div className="p-10 text-center font-efootball-stencil">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#eaff28] bg-gradient-to-br from-[#071360] to-[#01062b] text-[#eaff28] shadow-[0_0_25px_rgba(234,255,40,0.3)]">
              <Clock className="h-8 w-8" />
            </div>
            <h3 className="font-efootball-stencil font-sports mt-4 text-2xl sm:text-3xl font-black text-white tracking-wide">
              MATCH STARTS SOON
            </h3>
            <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-[#3ce7ff] font-mono leading-relaxed">
              Official schedule, pairings, and kickoff times will appear here as soon as tournament competitors are registered.
            </p>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[#b9c4f0]">
            No fixtures match the current filter "{String(matchdayFilter)}".
          </div>
        )}
      </div>

    </section>
  );
};
