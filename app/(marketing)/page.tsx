import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { ProofBar } from "@/components/marketing/ProofBar";
import { ProblemSolution } from "@/components/marketing/ProblemSolution";
import { CoreModules } from "@/components/marketing/CoreModules";
import { UseCases } from "@/components/marketing/UseCases";
import { SecurityTrust } from "@/components/marketing/SecurityTrust";
import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function MarketingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <MarketingNav />
      <div className="flex-1">
        <HeroSection />
        <ProofBar />
        <ProblemSolution />
        <CoreModules />
        <UseCases />
        <SecurityTrust />
        <PricingTeaser />
        <FinalCTA />
      </div>
      <MarketingFooter />
    </main>
  );
}
