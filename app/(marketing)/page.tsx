import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { ProofStrip } from "@/components/marketing/ProofStrip";
import { Chapter01Gap } from "@/components/marketing/chapters/Chapter01Gap";
import { Chapter02Model } from "@/components/marketing/chapters/Chapter02Model";
import { Chapter03Proof } from "@/components/marketing/chapters/Chapter03Proof";
import { RequestBrief } from "@/components/marketing/RequestBrief";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { AuthRedirectToCockpit } from "@/components/marketing/AuthRedirectToCockpit";

export default function MarketingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <AuthRedirectToCockpit />
      <MarketingNav />
      <div className="flex-1">
        <HeroSection />
        <ProofStrip />
        <Chapter01Gap />
        <Chapter02Model />
        <Chapter03Proof />
        <RequestBrief />
      </div>
      <MarketingFooter />
    </main>
  );
}
