import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/landing/HeroSection';
import { TrustIndicators } from '@/components/landing/TrustIndicators';
import { ValueProposition } from '@/components/landing/ValueProposition';
import { FeatureShowcase } from '@/components/landing/FeatureShowcase';
import { Statistics } from '@/components/landing/Statistics';
import { CTASection } from '@/components/landing/CTASection';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-landing">
      <Header />
      <main className="pt-16">
        <HeroSection />
        <TrustIndicators />
        <ValueProposition />
        <FeatureShowcase />
        <Statistics />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
