import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldAlert,
  CheckCircle2,
  RotateCcw,
  Download,
  Upload,
  UserPlus,
  Edit3,
  Unlock,
  AlertCircle,
  Users,
} from 'lucide-react';
import { Fixture, MatchResult, Player } from '../types/tournament';

interface OwnerDeskProps {
  isAdmin: boolean;
  players: Player[];
  fixtures: Fixture[];
  isRegistrationOpen: boolean;
  activeFixtureToEdit: { fixture: Fixture; existingResult?: MatchResult } | null;
  onClearActiveFixture: () => void;
  onSaveResult: (result: Omit<MatchResult, 'id' | 'submitted_at'>, existingId?: string) => void;
  onResetData: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenRegisterPlayer: () => void;
  onOpenEditPlayer: (player: Player) => void;
}

export const OwnerDesk: React.FC<OwnerDeskProps> = ({
  isAdmin,
  players,
  fixtures,
  isRegistrationOpen,
  activeFixtureToEdit,
  onClearActiveFixture,
  onSaveResult,
  onResetData,
  onExportData,
  onImportData,
  onOpenRegisterPlayer,
  onOpenEditPlayer,
}) => {
  const [matchday, setMatchday] = useState<number>(1);
  const [selectedFixtureIdx, setSelectedFixtureIdx] = useState<number>(0);
  const [homeScore, setHomeScore] = useState<string>('');
  const [awayScore, setAwayScore] = useState<string>('');
  const [venue, setVenue] = useState<string>('PS5 • Online lobby');
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);

  const totalMatchdays =
    fixtures.length > 0 ? Math.max(...fixtures.map((f) => f.matchday)) : 14;

  const availableFixtures = fixtures.filter((f) => f.matchday === matchday);

  // When activeFixtureToEdit changes from clicking "Score / Edit" on fixture row
  useEffect(() => {
    if (activeFixtureToEdit) {
      setMatchday(activeFixtureToEdit.fixture.matchday);
      const matchdayFixtures = fixtures.filter(
        (f) => f.matchday === activeFixtureToEdit.fixture.matchday
      );
      const idx = matchdayFixtures.findIndex(
        (f) =>
          f.home === activeFixtureToEdit.fixture.home &&
          f.away === activeFixtureToEdit.fixture.away
      );
      setSelectedFixtureIdx(idx >= 0 ? idx : 0);

      if (activeFixtureToEdit.existingResult) {
        setHomeScore(String(activeFixtureToEdit.existingResult.home_score));
        setAwayScore(String(activeFixtureToEdit.existingResult.away_score));
        setVenue(activeFixtureToEdit.existingResult.venue);
      } else {
        setHomeScore('');
        setAwayScore('');
      }
    }
  }, [activeFixtureToEdit, fixtures]);

  if (!isAdmin) {
    return null;
  }

  const currentFixture = availableFixtures[selectedFixtureIdx];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFixture) {
      setFeedback({ text: 'Please select a valid fixture.', isError: true });
      return;
    }

    if (homeScore === '' || awayScore === '') {
      setFeedback({ text: 'Please provide both home and away scores.', isError: true });
      return;
    }

    const hs = parseInt(homeScore, 10);
    const as = parseInt(awayScore, 10);

    if (isNaN(hs) || isNaN(as) || hs < 0 || as < 0) {
      setFeedback({ text: 'Scores must be positive numbers.', isError: true });
      return;
    }

    onSaveResult(
      {
        matchday,
        home_user: currentFixture.home,
        away_user: currentFixture.away,
        home_score: hs,
        away_score: as,
        venue: venue.trim() || 'PS5 • Online lobby',
        isKnockout: currentFixture.isKnockout,
        stage: currentFixture.stage,
        group: currentFixture.group,
      },
      activeFixtureToEdit?.existingResult?.id
    );

    setFeedback({
      text: `Score saved: ${currentFixture.home} ${hs} — ${as} ${currentFixture.away}!`,
      isError: false,
    });

    setHomeScore('');
    setAwayScore('');
    onClearActiveFixture();

    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  return (
    <section id="owner-desk" className="py-10 border-b border-[#3ce7ff]/30">
      <div className="rounded-2xl border-2 border-[#3ce7ff] bg-gradient-to-br from-[#0c1264] via-[#070b4a] to-[#040632] p-5 sm:p-7 shadow-[0_0_35px_rgba(60,231,255,0.18)]">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3ce7ff]/30 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#3ce7ff]">
                Owner Verified Desk
              </p>
            </div>
            <h3 className="font-sports mt-1 text-2xl text-white">
              {activeFixtureToEdit?.existingResult ? 'Edit Match Result' : 'Tournament Administration'}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onResetData}
              className="flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/40 px-3 py-1 text-[11px] font-bold text-rose-300 transition-colors hover:border-rose-400 hover:text-white"
              title="Reset results to sample state or start fresh"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Scores</span>
            </button>

            <button
              type="button"
              onClick={onExportData}
              className="flex items-center gap-1 rounded-full border border-[#3ce7ff]/40 bg-[#060a48] px-3 py-1 text-[11px] font-bold text-[#b9c4f0] transition-colors hover:border-[#3ce7ff] hover:text-white"
              title="Export tournament data to JSON"
            >
              <Download className="h-3 w-3" />
              <span>Export</span>
            </button>

            <label className="flex cursor-pointer items-center gap-1 rounded-full border border-[#3ce7ff]/40 bg-[#060a48] px-3 py-1 text-[11px] font-bold text-[#b9c4f0] transition-colors hover:border-[#3ce7ff] hover:text-white">
              <Upload className="h-3 w-3" />
              <span>Import</span>
              <input
                type="file"
                accept=".json"
                onChange={onImportData}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Section 1: Player Registration & Roster Management */}
        <div className="mt-5 rounded-xl border border-[#3ce7ff]/30 bg-[#060a48]/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#eaff28]" />
                <h4 className="font-sports text-lg text-white">Player Registration & Profiles</h4>
                {isRegistrationOpen ? (
                  <span className="flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-950/60 px-2 py-0.5 text-[9px] font-extrabold text-emerald-300">
                    <Unlock className="h-2.5 w-2.5" />
                    <span>Open (Before Matches Start)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-950/60 px-2 py-0.5 text-[9px] font-extrabold text-amber-300">
                    <Lock className="h-2.5 w-2.5" />
                    <span>Locked (Matches Underway)</span>
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#b9c4f0]">
                {isRegistrationOpen
                  ? `Register players now. Round-robin fixtures are automatically generated for all ${players.length} players.`
                  : `Tournament is underway (${fixtures.length} matches scheduled). Registration is closed until scores are reset.`}
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenRegisterPlayer}
              disabled={!isRegistrationOpen}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold uppercase tracking-wider transition-all ${
                isRegistrationOpen
                  ? 'bg-[#eaff28] text-[#08104e] hover:scale-105 active:scale-95 shadow-md'
                  : 'border border-gray-600 bg-gray-800 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Register New Player</span>
            </button>
          </div>

          {/* Quick Roster Manager List */}
          <div className="mt-3.5 flex flex-wrap gap-2">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-xl border border-[#3ce7ff]/30 bg-[#071056] py-1.5 pl-2 pr-2.5 text-xs text-white"
              >
                <img
                  src={p.avatarUrl}
                  alt={p.user}
                  className="h-6 w-6 rounded-full border border-[#3ce7ff] object-cover"
                />
                <span className="font-sports text-sm font-bold text-white">{p.team}</span>
                <span className="text-[10px] font-mono text-[#3ce7ff]">(@{p.user})</span>
                <button
                  type="button"
                  onClick={() => onOpenEditPlayer(p)}
                  className="ml-1 text-[#8e9bd4] hover:text-[#eaff28] transition-colors"
                  title={`Edit ${p.user}'s name or profile picture`}
                >
                  <Edit3 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Submit / Edit Match Result Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-sports text-lg text-[#3ce7ff]">
              {activeFixtureToEdit?.existingResult ? 'Edit Match Result' : 'Submit Match Result'}
            </h4>
            <span className="text-xs text-[#b9c4f0]">
              Total Matchdays: <strong className="text-white">{totalMatchdays}</strong>
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Matchday Select */}
            <div>
              <label className="mb-1 block text-xs font-bold text-[#b9c4f0]" htmlFor="owner-matchday">
                Matchday (1 to {totalMatchdays})
              </label>
              <select
                id="owner-matchday"
                value={matchday}
                onChange={(e) => {
                  setMatchday(Number(e.target.value));
                  setSelectedFixtureIdx(0);
                }}
                className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#060a48] px-3.5 py-2.5 text-xs font-semibold text-white focus:border-[#eaff28] focus:outline-none"
              >
                {Array.from({ length: totalMatchdays }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Matchday {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Fixture Select */}
            <div>
              <label className="mb-1 block text-xs font-bold text-[#b9c4f0]" htmlFor="owner-fixture">
                Pairing / Fixture
              </label>
              <select
                id="owner-fixture"
                value={selectedFixtureIdx}
                onChange={(e) => setSelectedFixtureIdx(Number(e.target.value))}
                className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#060a48] px-3.5 py-2.5 text-xs font-semibold text-white focus:border-[#eaff28] focus:outline-none"
              >
                {availableFixtures.length > 0 ? (
                  availableFixtures.map((f, idx) => (
                    <option key={f.id} value={idx}>
                      {f.home} vs {f.away}
                    </option>
                  ))
                ) : (
                  <option value={0}>No fixtures for this matchday</option>
                )}
              </select>
            </div>

            {/* Home Score */}
            <div>
              <label className="mb-1 block text-xs font-bold text-[#b9c4f0]" htmlFor="owner-home-score">
                {currentFixture ? `${currentFixture.home} (Home)` : 'Home Score'}
              </label>
              <input
                id="owner-home-score"
                type="number"
                min="0"
                max="99"
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                placeholder="0"
                required
                className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#060a48] px-3.5 py-2 text-sm font-bold text-[#eaff28] text-center focus:border-[#eaff28] focus:outline-none"
              />
            </div>

            {/* Away Score */}
            <div>
              <label className="mb-1 block text-xs font-bold text-[#b9c4f0]" htmlFor="owner-away-score">
                {currentFixture ? `${currentFixture.away} (Away)` : 'Away Score'}
              </label>
              <input
                id="owner-away-score"
                type="number"
                min="0"
                max="99"
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                placeholder="0"
                required
                className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#060a48] px-3.5 py-2 text-sm font-bold text-[#eaff28] text-center focus:border-[#eaff28] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 pt-2">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-xs font-bold text-[#b9c4f0]" htmlFor="owner-venue">
                Lobby / Venue
              </label>
              <input
                id="owner-venue"
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="PS5 • Online lobby"
                className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#060a48] px-3.5 py-2 text-xs text-white focus:border-[#eaff28] focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              {activeFixtureToEdit && (
                <button
                  type="button"
                  onClick={onClearActiveFixture}
                  className="rounded-xl border border-[#3ce7ff]/40 bg-[#080d51] px-4 py-2 text-xs font-bold uppercase text-[#b9c4f0] hover:text-white"
                >
                  Cancel Edit
                </button>
              )}

              <button
                type="submit"
                className="rounded-xl bg-[#3ce7ff] px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider text-[#08104e] shadow-lg transition-transform hover:scale-105 hover:bg-[#eaff28] active:scale-95"
              >
                {activeFixtureToEdit?.existingResult ? 'Update Score' : 'Save Match Result'}
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                feedback.isError
                  ? 'border border-rose-500/50 bg-rose-950/60 text-rose-300'
                  : 'border border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
              }`}
            >
              {feedback.isError ? <ShieldAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>{feedback.text}</span>
            </div>
          )}
        </form>
      </div>
    </section>
  );
};
