import React, { useRef, useEffect } from 'react';
import { Sparkles, User } from 'lucide-react';
import { AppUserProfile } from '../lib/firebase';
import { TournamentFormat } from '../types/tournament';

import { EFootballLogo } from './EFootballLogo';

export type SectionId = 'hub' | 'players' | 'fixtures' | 'bracket' | 'table' | 'rules' | 'admin';
export type NavSection = SectionId;

interface NavbarProps {
  isAdmin?: boolean;
  activeSection: SectionId;
  currentUser: AppUserProfile | null;
  tournamentFormat?: TournamentFormat;
  onNavigateSection: (section: SectionId) => void;
  onOpenAIScout: () => void;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeSection,
  currentUser,
  tournamentFormat = 'league_double',
  onNavigateSection,
  onOpenAIScout,
  onOpenAuthModal,
}) => {
  const isPureKnockout =
    tournamentFormat === 'knockout' || tournamentFormat === 'knockout_cup';
  const hasKnockout =
    tournamentFormat === 'knockout' ||
    tournamentFormat === 'group_knockout' ||
    tournamentFormat === 'knockout_cup' ||
    tournamentFormat === 'group_stage';
  const hasTable = !isPureKnockout;
  const isGroupFormat =
    tournamentFormat === 'group_stage' || tournamentFormat === 'group_knockout';

  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeSection]);

  const tabs: { id: SectionId; label: string }[] = [
    { id: 'hub', label: 'Tournament Hub' },
    { id: 'fixtures', label: 'Fixtures' },
    ...(hasKnockout
      ? [
          {
            id: 'bracket' as SectionId,
            label: isPureKnockout ? 'Knockout Bracket' : 'Knockout Stage',
          },
        ]
      : []),
    ...(hasTable
      ? [
          {
            id: 'table' as SectionId,
            label: isGroupFormat ? 'Group Tables' : 'League Table',
          },
        ]
      : []),
    { id: 'rules', label: 'Rules' },
    { id: 'admin', label: 'Administrator' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-[#3ce7ff]/30 bg-[#050842]/95 backdrop-blur-md shadow-xl">
      <div className="w-full px-1.5 sm:px-3 md:px-5">
        {/* Upper Brand & Actions Bar: Fully fitted edge-to-edge for mobile & tab */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 py-1.5 sm:py-2.5 min-h-[48px] sm:min-h-[56px] w-full">
          {/* Brand Wordmark */}
          <button
            type="button"
            onClick={() => onNavigateSection('hub')}
            className="group flex items-center gap-1.5 sm:gap-2.5 text-left text-white no-underline transition-transform hover:scale-[1.02] shrink-0 min-w-0"
            aria-label="Go to tournament hub"
          >
            <div className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl border-2 border-[#eaff28] bg-[#000e8a] p-1 shadow-[0_0_15px_rgba(234,255,40,0.35)] transition-shadow group-hover:shadow-[0_0_22px_rgba(234,255,40,0.6)] shrink-0">
              <EFootballLogo className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="font-efootball-stencil m-0 text-[8px] sm:text-[9px] font-extrabold tracking-[0.16em] sm:tracking-[0.24em] text-[#eaff28] truncate">
                ETHIOPIAN ESPORTS LEAGUE
              </p>
              <p className="font-efootball-stencil m-0 text-xs sm:text-base leading-none text-white tracking-wide truncate font-bold">
                EFOOTBALL
              </p>
            </div>
          </button>

          {/* Action buttons: AI Tactics Scout & Firebase User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* AI Scout Button */}
            <button
              type="button"
              onClick={onOpenAIScout}
              className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-[#eaff28]/60 bg-[#eaff28]/10 px-2 sm:px-3 py-1 text-xs font-bold text-[#eaff28] shadow-[0_0_12px_rgba(234,255,40,0.2)] transition-all hover:bg-[#eaff28] hover:text-[#050842]"
              title="Open AI Tactics Scout with Live Google Search"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="font-sports text-[11px] uppercase tracking-wider">
                Scout
              </span>
            </button>

            {/* Google Sign-in / User Profile Button with eFootball Account Logo */}
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-[#3ce7ff]/50 bg-[#071056] px-2 sm:px-3 py-1 text-xs font-bold text-white transition-all hover:border-[#3ce7ff] hover:bg-[#0c1670]"
              title={
                currentUser
                  ? `Logged in as ${currentUser.displayName || currentUser.email}`
                  : 'Sign in with Google'
              }
            >
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="h-4 w-4 rounded-full object-cover border border-[#3ce7ff] shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <EFootballLogo className="h-4 w-4 shrink-0" />
              )}
              <span className="text-[11px] font-medium hidden sm:inline max-w-[90px] truncate">
                {currentUser?.displayName
                  ? currentUser.displayName.split(' ')[0]
                  : 'Sign In'}
              </span>
            </button>
          </div>
        </div>

        {/* Navigation tabs Bar: Clear gap between tabs, zero overlap on mobile */}
        <nav
          aria-label="Tournament navigation"
          className="flex w-full items-stretch justify-start text-xs font-bold uppercase tracking-wider pb-1 pt-0.5 gap-2 sm:gap-3 overflow-x-auto scrollbar-none no-scrollbar flex-nowrap px-1 sm:px-2 scroll-smooth"
        >
          {tabs.map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                ref={isActive ? activeTabRef : null}
                type="button"
                onClick={() => onNavigateSection(tab.id)}
                className={`w-auto shrink-0 whitespace-nowrap border-b-2 transition-all pb-1.5 pt-1 px-3 sm:px-3.5 rounded-t-lg font-sports tracking-normal cursor-pointer ${
                  isActive
                    ? 'border-[#eaff28] text-[#eaff28] bg-[#eaff28]/15 shadow-[0_2px_12px_rgba(234,255,40,0.3)] font-black'
                    : 'border-transparent text-[#bcc7fa] hover:border-[#3ce7ff]/60 hover:text-white hover:bg-white/5 font-semibold'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

