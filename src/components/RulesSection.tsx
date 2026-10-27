import React from 'react';
import { Timer, ClipboardCheck, Handshake, AlertTriangle, ShieldCheck } from 'lucide-react';

export const RulesSection: React.FC = () => {
  return (
    <section id="rules" className="py-4 sm:py-6 border-b-0 scroll-mt-[105px]">
      <div>
        <p className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-[#eaff28]">
          Tournament Guide
        </p>
        <h2 className="font-efootball-stencil mt-1 text-2xl sm:text-3xl text-white font-bold">Match Rules & Code of Conduct</h2>
      </div>

      <div className="mt-5 rounded-2xl border border-[#3ce7ff]/30 bg-gradient-to-br from-[#0a0f52] to-[#050842] p-5 sm:p-7 shadow-xl">
        <div className="space-y-5">
          {/* Rule 1 */}
          <article className="grid grid-cols-[36px_1fr] gap-4 border-b border-[#3ce7ff]/20 pb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#071056] border border-[#3ce7ff]/40 text-[#eaff28]">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-efootball-stencil text-lg text-white font-bold">Play The Assigned Fixture</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#b9c4f0]">
                Use the agreed online lobby and complete your scheduled matchday pairing before submitting a score.
                Match setting: 10 minutes regular match (5 min halves) with normal injuries and 5 substitutions.
              </p>
            </div>
          </article>

          {/* Rule 2 */}
          <article className="grid grid-cols-[36px_1fr] gap-4 border-b border-[#3ce7ff]/20 pb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#071056] border border-[#3ce7ff]/40 text-[#eaff28]">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-efootball-stencil text-lg text-white font-bold">Report Accurately & Provide Proof</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#b9c4f0]">
                Only the verified tournament owner can submit scores into the official dashboard. Both players must
                take an in-game end-match screenshot showing final score, player tags, and statistics, then submit it to the admin desk.
              </p>
            </div>
          </article>

          {/* Rule 3 */}
          <article className="grid grid-cols-[36px_1fr] gap-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#071056] border border-[#3ce7ff]/40 text-[#eaff28]">
              <Handshake className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-efootball-stencil text-lg text-white font-bold">Respect The Challenge & Fair Play</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#b9c4f0]">
                Keep communication sporting at all times. Intentional disconnections, match manipulation, or toxic conduct will result in disqualification. An unexcused forfeit counts as an automatic <strong>3-0 loss</strong>.
              </p>
            </div>
          </article>
        </div>

        {/* Quick summary info pill */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#3ce7ff]/30 bg-[#060a48] p-3 text-xs text-[#b9c4f0]">
          <AlertTriangle className="h-4 w-4 text-[#eaff28] shrink-0" />
          <span>
            Scoring disputes must be escalated to the tournament organiser within 24 hours of match completion.
          </span>
        </div>
      </div>
    </section>
  );
};
