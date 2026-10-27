import React from 'react';
import { CalendarSearch, ShieldCheck, Send, TrendingUp } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      no: '01',
      icon: CalendarSearch,
      title: 'Find Fixture',
      desc: 'Check your assigned rival each matchday.',
    },
    {
      no: '02',
      icon: ShieldCheck,
      title: 'Play & Record',
      desc: 'Official eFootball lobby rules. Screenshot score.',
    },
    {
      no: '03',
      icon: Send,
      title: 'Submit Score',
      desc: 'Send proof to admin for instant verification.',
    },
    {
      no: '04',
      icon: TrendingUp,
      title: 'Climb Table',
      desc: 'Win: 3 pts · Draw: 1 pt. Tiebreaker by GD.',
    },
  ];

  return (
    <section className="py-3 sm:py-5 border-b border-[#3ce7ff]/20">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#eaff28] block">
            Competition Format
          </span>
          <h2 className="font-efootball-stencil text-lg sm:text-2xl text-white font-bold leading-tight">
            How The Challenge Works
          </h2>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <article
              key={s.no}
              className="relative overflow-hidden rounded-xl border border-[#3ce7ff]/25 bg-gradient-to-br from-[#11166d]/80 to-[#050842]/95 p-2.5 sm:p-3 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="font-sports text-sm sm:text-base font-black text-[#eaff28] tracking-tight">
                  {s.no}
                </span>
                <div className="rounded-lg border border-[#3ce7ff]/40 bg-[#071056] p-1 text-[#3ce7ff]">
                  <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>
              </div>

              <div className="mt-1.5">
                <h3 className="font-sports text-xs sm:text-sm text-white font-bold leading-tight">
                  {s.title}
                </h3>
                <p className="mt-0.5 text-[10px] sm:text-xs text-[#b9c4f0] leading-snug">
                  {s.desc}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
