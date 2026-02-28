"use client";

import { useScrollProgress, useActiveChapter, ScrollChapters } from "@/components/marketing2030/ScrollChapters";
import { HeroNav } from "@/components/marketing2030/HeroNav";
import { HeroInstrument } from "@/components/marketing2030/HeroInstrument";
import { GlobalGap } from "@/components/marketing2030/GlobalGap";
import { GovernanceStack } from "@/components/marketing2030/GovernanceStack";
import { CommandLayerPreview } from "@/components/marketing2030/CommandLayerPreview";
import { CategoryMicDrop } from "@/components/marketing2030/CategoryMicDrop";
import { FooterMinimal } from "@/components/marketing2030/FooterMinimal";

export default function Page2030() {
  const progress = useScrollProgress();
  const activeChapter = useActiveChapter();

  return (
    <>
      <HeroNav />
      <ScrollChapters progress={progress} activeChapter={activeChapter} />
      <main>
        <HeroInstrument />
        <GlobalGap />
        <GovernanceStack />
        <CommandLayerPreview />
        <CategoryMicDrop />
        <FooterMinimal />
      </main>
    </>
  );
}
