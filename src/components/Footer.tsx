import React, { useRef } from 'react';
import { Mail, Send, Instagram, KeyRound, Unlock } from 'lucide-react';
import { NavSection } from './Navbar';

const EFootballNeonIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg
    viewBox="0 0 100 100"
    className={`${className} shrink-0 drop-shadow-[0_0_8px_rgba(0,229,255,0.85)]`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="eFootball"
  >
    <defs>
      <linearGradient id="efootball-cyan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4df3ff" />
        <stop offset="45%" stopColor="#00e5ff" />
        <stop offset="100%" stopColor="#00b4d8" />
      </linearGradient>
    </defs>
    {/* eFootball Top Arc */}
    <path
      d="M 9.6 36.2 A 42 42 0 0 1 90.4 36.2 L 76.2 36.2 A 27.5 27.5 0 0 0 23.8 36.2 Z"
      fill="url(#efootball-cyan-grad)"
      stroke="#0096c7"
      strokeWidth="0.8"
    />
    {/* eFootball Middle Bar */}
    <rect
      x="5.8"
      y="44"
      width="72.4"
      height="12.5"
      rx="2.5"
      fill="url(#efootball-cyan-grad)"
      stroke="#0096c7"
      strokeWidth="0.8"
    />
    {/* eFootball Bottom Arc */}
    <path
      d="M 9.6 63.8 A 42 42 0 0 0 90.4 63.8 L 76.2 63.8 A 27.5 27.5 0 0 1 23.8 63.8 Z"
      fill="url(#efootball-cyan-grad)"
      stroke="#0096c7"
      strokeWidth="0.8"
    />
  </svg>
);

interface FooterProps {
  isAdmin: boolean;
  onNavigateSection: (section: NavSection) => void;
}

export const Footer: React.FC<FooterProps> = ({
  isAdmin,
  onNavigateSection,
}) => {
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSecretTriggerClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      onNavigateSection('admin');
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 700);
    }
  };

  return (
    <footer className="mt-14 border-t border-[#3ce7ff]/30 bg-[#060a48] py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-[#eaff28]">
              Ethiopian eFootball League
            </p>
            <h2 className="font-efootball-stencil mt-2 text-2xl sm:text-3xl text-white font-bold">PLAY. REPORT. RISE.</h2>

            {/* Secret Admin Trigger: Triple Click on this text */}
            <div className="mt-4 flex items-center gap-2">
              <p
                id="owner-secret-trigger"
                onClick={handleSecretTriggerClick}
                className="cursor-pointer select-none text-xs font-semibold text-[#b9c4f0] transition-colors hover:text-[#eaff28]"
                title="Triple-click for Owner Access"
              >
                Produced by Mubarek Zeru
              </p>
              <button
                type="button"
                onClick={() => onNavigateSection('admin')}
                className="text-[#8e9bd4] transition-colors hover:text-[#eaff28]"
                title="Tournament Administrator"
                aria-label="Open Tournament Administrator"
              >
                {isAdmin ? <Unlock className="h-3 w-3 text-emerald-400" /> : <KeyRound className="h-3 w-3" />}
              </button>
            </div>

            <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#8e9bd4]">
              A focused esports tournament space for competitive fixtures, verified results, and live league-table momentum.
            </p>
          </div>

          {/* Contact Box */}
          <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#050842]/80 p-4 shadow-lg">
            <h3 className="font-sports text-base text-[#eaff28]">Official Organizer Contact</h3>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 md:grid-cols-1">
              <a
                href="mailto:Mubarekzeru@gmail.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-[#3ce7ff]/30 bg-[#071056] px-3.5 py-1.5 text-white no-underline transition-all hover:border-[#eaff28] hover:text-[#eaff28]"
              >
                <Mail className="h-3.5 w-3.5 text-[#3ce7ff]" />
                <span>Mubarekzeru@gmail.com</span>
              </a>

              <a
                href="https://t.me/mubyzeru"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-[#3ce7ff]/30 bg-[#071056] px-3.5 py-1.5 text-white no-underline transition-all hover:border-[#eaff28] hover:text-[#eaff28]"
              >
                <Send className="h-3.5 w-3.5 text-[#3ce7ff]" />
                <span>Telegram: @mubyzeru</span>
              </a>

              <a
                href="https://www.tiktok.com/@mubyzeru"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-[#3ce7ff]/30 bg-[#071056] px-3.5 py-1.5 text-white no-underline transition-all hover:border-[#eaff28] hover:text-[#eaff28]"
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-[#3ce7ff]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298 0 .585.04.86.11V9.4a6.33 6.33 0 0 0-6.62 6.32A6.34 6.34 0 0 0 10.05 22a6.34 6.34 0 0 0 6.32-6.33V9.05a8.16 8.16 0 0 0 4.9 1.63v-3.44a4.85 4.85 0 0 1-1.68-.55z" />
                </svg>
                <span>TikTok: @mubyzeru</span>
              </a>

              <a
                href="https://www.instagram.com/mubyzeru/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-[#3ce7ff]/30 bg-[#071056] px-3.5 py-1.5 text-white no-underline transition-all hover:border-[#eaff28] hover:text-[#eaff28]"
              >
                <Instagram className="h-3.5 w-3.5 text-[#3ce7ff]" />
                <span>Instagram: @mubyzeru</span>
              </a>

              <div
                className="flex items-center gap-2 rounded-full border border-[#3ce7ff]/40 bg-[#071056] px-3.5 py-1.5 text-white shadow-sm"
              >
                <EFootballNeonIcon className="h-4 w-4" />
                <span>eFootball: <strong className="text-[#3ce7ff]">mubyzeru</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-[#3ce7ff]/15 pt-4 text-center text-[11px] text-[#8e9bd4]">
          © {new Date().getFullYear()} Ethiopian eFootball Tournament Challenge · All rights reserved.
        </div>
      </div>
    </footer>
  );
};
