import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Grid3X3, Calendar, Bell, FileCheck } from "lucide-react";

export function FeatureShowcase() {
  return (
    <section id="solutions" className="py-16 md:py-20 lg:py-24 bg-muted/30" data-testid="section-feature-showcase">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-20 lg:mb-28">
          <div className="order-2 lg:order-1">
            <Card className="p-6 shadow-xl" data-testid="card-competency-matrix">
              <div className="flex items-center justify-between gap-2 mb-6">
                <h4 className="font-semibold">Competency Matrix</h4>
                <Badge variant="secondary" size="sm">Live Preview</Badge>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-2 text-xs text-center">
                  <div className="text-muted-foreground"></div>
                  <div className="text-muted-foreground">Safety</div>
                  <div className="text-muted-foreground">Technical</div>
                  <div className="text-muted-foreground">Ops</div>
                  <div className="text-muted-foreground">Leadership</div>
                </div>
                {["Team Lead A", "Engineer B", "Operator C", "Technician D"].map((name, i) => (
                  <div key={name} className="grid grid-cols-5 gap-2 items-center">
                    <div className="text-sm font-medium truncate">{name}</div>
                    {[4, 3, 5, 2].map((level, j) => {
                      const adjustedLevel = (level + i + j) % 5 + 1;
                      const bgColor = adjustedLevel >= 4 ? "bg-chart-3" : adjustedLevel >= 3 ? "bg-chart-4" : "bg-muted";
                      return (
                        <div
                          key={j}
                          className={`h-8 rounded-md ${bgColor} flex items-center justify-center text-xs font-medium ${adjustedLevel >= 3 ? "text-white" : "text-muted-foreground"}`}
                        >
                          L{adjustedLevel}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>
          </div>
          
          <div className="order-1 lg:order-2 space-y-6">
            <div className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Grid3X3 className="w-5 h-5 text-primary" />
              </div>
              <Badge variant="outline">Competency Management</Badge>
            </div>
            <h3 className="text-3xl md:text-4xl font-semibold" data-testid="text-feature1-title">
              Visualize skills across your entire workforce
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed" data-testid="text-feature1-desc">
              Create comprehensive skill matrices that give you instant visibility into team capabilities. 
              Identify skill gaps, plan training programs, and ensure the right people are assigned to the right projects.
            </p>
            <ul className="space-y-3">
              {["Interactive skill mapping", "Real-time gap analysis", "Team comparison views"].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-chart-3/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-chart-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Button className="gap-2" data-testid="button-feature1-learn">
              Learn More <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-chart-4" />
              </div>
              <Badge variant="outline">Certification Tracking</Badge>
            </div>
            <h3 className="text-3xl md:text-4xl font-semibold" data-testid="text-feature2-title">
              Never miss a certification deadline
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed" data-testid="text-feature2-desc">
              Automated tracking and notifications ensure your team stays compliant. 
              Get proactive alerts before certifications expire and streamline the renewal process.
            </p>
            <ul className="space-y-3">
              {["Automated expiry alerts", "Renewal workflow automation", "Compliance reporting"].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-chart-3/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-chart-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Button className="gap-2" data-testid="button-feature2-learn">
              Learn More <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          
          <div>
            <Card className="p-6 shadow-xl" data-testid="card-certification-timeline">
              <div className="flex items-center justify-between gap-2 mb-6">
                <h4 className="font-semibold">Certification Timeline</h4>
                <Badge variant="secondary" size="sm">This Month</Badge>
              </div>
              <div className="space-y-4">
                {[
                  { name: "OSHA Safety Training", date: "Dec 15", status: "expiring", icon: Bell },
                  { name: "ISO 9001 Auditor", date: "Dec 20", status: "valid", icon: FileCheck },
                  { name: "Forklift Operator License", date: "Dec 28", status: "valid", icon: FileCheck },
                  { name: "First Aid Certification", date: "Jan 5", status: "upcoming", icon: Calendar },
                ].map((cert, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      cert.status === "expiring" ? "bg-chart-5/20" : 
                      cert.status === "valid" ? "bg-chart-3/20" : "bg-muted"
                    }`}>
                      <cert.icon className={`w-5 h-5 ${
                        cert.status === "expiring" ? "text-chart-5" : 
                        cert.status === "valid" ? "text-chart-3" : "text-muted-foreground"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cert.name}</p>
                      <p className="text-xs text-muted-foreground">{cert.date}</p>
                    </div>
                    <Badge 
                      variant={cert.status === "expiring" ? "destructive" : "secondary"}
                      size="sm"
                    >
                      {cert.status === "expiring" ? "Action Required" : 
                       cert.status === "valid" ? "Valid" : "Upcoming"}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
