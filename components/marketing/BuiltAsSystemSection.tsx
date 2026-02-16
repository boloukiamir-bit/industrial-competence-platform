"use client";

import { WarmSection } from "./WarmSection";
import { SketchWrapper } from "./motion";
import { SketchOrgArchitecture } from "./editorial-sketches/blueprints";
import { SceneManagerReadiness } from "./editorial-sketches/scenes";
import { Reveal } from "./motion";

export function BuiltAsSystemSection() {
  return (
    <WarmSection dotGrid className="border-t border-black/5">
      <div id="system-architecture" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24 relative">
        <div className="absolute top-8 left-4 w-28 h-[72px] opacity-[0.18] text-foreground pointer-events-none hidden md:block" aria-hidden>
          <SceneManagerReadiness className="w-full h-full" />
        </div>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <Reveal>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Architecture
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-2 font-display text-2xl md:text-3xl font-normal tracking-tight text-foreground">
                Built as a system — not a dashboard
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-4 text-muted-foreground max-w-lg">
                BCLEDGE is structured to mirror how factories actually work. Every skill, requirement, and decision is traceable by design.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <ul className="mt-6 space-y-3 text-sm text-foreground" role="list">
                <li className="flex gap-2">
                  <span className="text-[#1e3a5f] shrink-0">—</span>
                  <span>Organizational hierarchy is explicit, not inferred</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#1e3a5f] shrink-0">—</span>
                  <span>Skills and compliance drive readiness automatically</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#1e3a5f] shrink-0">—</span>
                  <span>Every override is logged and auditable</span>
                </li>
              </ul>
            </Reveal>
          </div>
          <div className="flex justify-center lg:justify-end">
            <SketchWrapper
              className="w-full max-w-md text-foreground opacity-90"
              parallax
              once
              amount={0.15}
            >
              <SketchOrgArchitecture className="w-full h-auto" aria-hidden />
            </SketchWrapper>
          </div>
        </div>
      </div>
    </WarmSection>
  );
}
