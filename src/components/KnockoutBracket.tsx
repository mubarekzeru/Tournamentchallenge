import React from 'react';
import { Trophy, Medal, Swords, CheckCircle2 } from 'lucide-react';
import { Fixture, MatchResult, Player } from '../types/tournament';

interface KnockoutBracketProps {
  knockoutFixtures: Fixture[];
  results: MatchResult[];
  playerMap: Map<string, Player>;
  onSelectFixture?: (fixture: Fixture, result?: MatchResult) => void;
  onSelectPlayer?: (player: Player) => void;
}

export const KnockoutBracket: React.FC<KnockoutBracketProps> = ({
  knockoutFixtures,
  results,
  playerMap,
  onSelectFixture,
  onSelectPlayer,
}) => {
  if (knockoutFixtures.length === 0) {
    return null;
  }

  // Group fixtures by knockout stage
  const qfMatches = knockoutFixtures.filter((f) => f.knockoutStage === 'quarter_final');
  const sfMatches = knockoutFixtures.filter((f) => f.knockoutStage === 'semi_final');
  const finalMatches = knockoutFixtures.filter((f) => f.knockoutStage === 'final');
  const thirdPlaceMatches = knockoutFixtures.filter((f) => f.knockoutStage === 'third_place');

  const renderMatchCard = (f: Fixture, label?: string) => {
    const res = results.find(
      (r) =>
        r.isKnockout &&
        ((r.home_user === f.home && r.away_user === f.away) ||
          (r.home_user === f.away && r.away_user === f.home))
    );

    const isPlayed = !!res && !res.isPostponed;
    const homeP = playerMap.get(f.home);
    const awayP = playerMap.get(f.away);

    const isHomeWinner =
      isPlayed &&
      (res.home_score > res.away_score ||
        (res.penaltyWinner && res.penaltyWinner === f.home));
    const isAwayWinner =
      isPlayed &&
      (res.away_score > res.home_score ||
        (res.penaltyWinner && res.penaltyWinner === f.away));

    return (
      <div
        key={f.id}
        onClick={() => onSelectFixture && onSelectFixture(f, res)}
        className="group relative cursor-pointer overflow-hidden rounded-xl border border-[#3ce7ff]/30 bg-[#060a48] p-3 shadow-md transition-all hover:border-[#3ce7ff] hover:bg-[#071158]"
      >
        <div className="flex items-center justify-between text-[10px] text-[#3ce7ff] font-bold uppercase tracking-wider mb-2 border-b border-[#3ce7ff]/15 pb-1">
          <span>{label || f.stage || 'Knockout Match'}</span>
          {isPlayed && (
            <span className="flex items-center gap-1 text-emerald-400 font-black">
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span>Full Time</span>
            </span>
          )}
        </div>

        {/* Home row */}
        <div
          onClick={(e) => {
            if (homeP && onSelectPlayer) {
              e.stopPropagation();
              onSelectPlayer(homeP);
            }
          }}
          className={`flex items-center justify-between py-1 px-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/10 ${
            isHomeWinner
              ? 'bg-[#eaff28]/15 border border-[#eaff28]/40 font-bold text-white'
              : 'text-[#b9c4f0]'
          }`}
          title={homeP ? `View ${homeP.team} (@${f.home}) Profile Card` : undefined}
        >
          <div className="flex items-center gap-2 truncate">
            <img
              src={homeP?.avatarUrl}
              alt={homeP?.team || f.home}
              className="h-5 w-5 rounded-full border border-[#3ce7ff] object-cover shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0 flex-1 truncate">
              <span className="text-[11px] truncate block font-efootball-stencil font-club-name font-sports text-white font-bold leading-tight tracking-normal" data-club-name="true">
                {homeP?.team || f.home}
              </span>
              <span className="text-[8px] text-[#3ce7ff] font-mono block truncate leading-none mt-0.5">
                @{f.home}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {res?.penaltyWinner === f.home && (
              <span className="text-[9px] text-[#eaff28] font-bold uppercase">(pens)</span>
            )}
            <span
              className={`font-sports text-sm font-black ${
                isHomeWinner ? 'text-[#eaff28]' : 'text-white/80'
              }`}
            >
              {isPlayed ? res.home_score : '—'}
            </span>
          </div>
        </div>

        {/* Away row */}
        <div
          onClick={(e) => {
            if (awayP && onSelectPlayer) {
              e.stopPropagation();
              onSelectPlayer(awayP);
            }
          }}
          className={`mt-1 flex items-center justify-between py-1 px-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/10 ${
            isAwayWinner
              ? 'bg-[#eaff28]/15 border border-[#eaff28]/40 font-bold text-white'
              : 'text-[#b9c4f0]'
          }`}
          title={awayP ? `View ${awayP.team} (@${f.away}) Profile Card` : undefined}
        >
          <div className="flex items-center gap-2 truncate">
            <img
              src={awayP?.avatarUrl}
              alt={awayP?.team || f.away}
              className="h-5 w-5 rounded-full border border-[#3ce7ff] object-cover shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0 flex-1 truncate">
              <span className="text-[11px] truncate block font-efootball-stencil font-club-name font-sports text-white font-bold leading-tight tracking-normal" data-club-name="true">
                {awayP?.team || f.away}
              </span>
              <span className="text-[8px] text-[#3ce7ff] font-mono block truncate leading-none mt-0.5">
                @{f.away}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {res?.penaltyWinner === f.away && (
              <span className="text-[9px] text-[#eaff28] font-bold uppercase">(pens)</span>
            )}
            <span
              className={`font-sports text-sm font-black ${
                isAwayWinner ? 'text-[#eaff28]' : 'text-white/80'
              }`}
            >
              {isPlayed ? res.away_score : '—'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-none sm:rounded-2xl border-x-0 sm:border-x border-y border-[#3ce7ff]/30 bg-gradient-to-b from-[#09115d] to-[#040632] p-3 sm:p-6 shadow-xl my-4 sm:my-6 w-full">
      <div className="flex items-center gap-2.5 border-b border-[#3ce7ff]/20 pb-3 mb-5">
        <div className="grid h-8 w-8 place-items-center rounded-xl border border-[#eaff28] bg-[#071360] text-[#eaff28]">
          <Swords className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-sports text-xl text-white">Knockout Playoff Bracket</h3>
          <p className="text-xs text-[#b9c4f0]">
            Official knockout pairings with confirmed qualified players
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Quarter Finals (if applicable) */}
        {qfMatches.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#3ce7ff]">
              <span>Quarter-Finals</span>
              <span className="rounded bg-[#071360] px-1.5 py-0.2 text-[9px] text-[#eaff28]">
                {qfMatches.length} Matches
              </span>
            </div>
            <div className="space-y-3">
              {qfMatches.map((f, i) => renderMatchCard(f, `QF ${i + 1}`))}
            </div>
          </div>
        )}

        {/* Semi Finals */}
        {sfMatches.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#3ce7ff]">
              <span>Semi-Finals</span>
              <span className="rounded bg-[#071360] px-1.5 py-0.2 text-[9px] text-[#eaff28]">
                {sfMatches.length} Matches
              </span>
            </div>
            <div className="space-y-3">
              {sfMatches.map((f, i) => renderMatchCard(f, `Semi-Final ${i + 1}`))}
            </div>
          </div>
        )}

        {/* Grand Final & 3rd Place */}
        {(finalMatches.length > 0 || thirdPlaceMatches.length > 0) && (
          <div className="space-y-4">
            {finalMatches.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#eaff28]">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>Grand Final 🏆</span>
                </div>
                {finalMatches.map((f) => renderMatchCard(f, 'Championship Final'))}
              </div>
            )}

            {thirdPlaceMatches.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#3ce7ff]/15">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                  <Medal className="h-3.5 w-3.5" />
                  <span>3rd Place Playoff 🥉</span>
                </div>
                {thirdPlaceMatches.map((f) => renderMatchCard(f, '3rd Place Match'))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
