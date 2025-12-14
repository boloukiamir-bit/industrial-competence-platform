import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative min-h-[600px] lg:min-h-[700px] flex items-center overflow-hidden">
      <Image
        src="/industrial_training__7882ac0d.jpg"
        alt="Industrial training"
        fill
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/70" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
      
      <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-3 space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium" data-testid="badge-hero-new">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                New: AI-powered skills gap analysis
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight" data-testid="text-hero-headline">
                Elevate Your{" "}
                <span className="text-primary">Workforce</span>{" "}
                Competency
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed" data-testid="text-hero-subheadline">
                Streamline competency management, track certifications, and ensure compliance 
                across your industrial organization with our enterprise-grade platform.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg" className="gap-2" data-testid="button-hero-start">
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="lg" className="gap-2" data-testid="button-hero-demo">
                <Play className="w-4 h-4" />
                Watch Demo
              </Button>
            </div>

            <div className="flex items-center gap-6 pt-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium text-muted-foreground"
                    data-testid={`avatar-user-${i}`}
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <div className="text-sm" data-testid="text-hero-social-proof">
                <span className="font-semibold text-foreground">2,500+</span>{" "}
                <span className="text-muted-foreground">companies trust us</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 relative">
            <div className="relative bg-card rounded-lg border border-border shadow-xl overflow-hidden" data-testid="card-hero-preview">
              <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-chart-4/60" />
                  <div className="w-3 h-3 rounded-full bg-chart-3/60" />
                </div>
                <span className="text-xs text-muted-foreground ml-2">Dashboard Preview</span>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Team Competency Score</p>
                    <p className="text-2xl font-bold">87.5%</p>
                  </div>
                  <div className="w-16 h-16 rounded-full border-4 border-primary flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">A+</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Safety Certifications</span>
                      <span className="font-medium">94%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-chart-3 rounded-full" style={{ width: "94%" }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Technical Skills</span>
                      <span className="font-medium">82%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: "82%" }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Compliance Training</span>
                      <span className="font-medium">88%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-chart-2 rounded-full" style={{ width: "88%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="absolute -bottom-4 -left-4 bg-card rounded-lg border border-border shadow-lg p-4 hidden lg:block" data-testid="card-hero-notification">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-chart-3/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-chart-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">Certification Complete</p>
                  <p className="text-xs text-muted-foreground">Safety Training - Level 3</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
