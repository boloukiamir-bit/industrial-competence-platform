import { Card } from '@/components/ui/card';
import { Users, Award, TrendingUp } from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Competency Management',
    description: 'Track and manage employee skills across your entire organization with comprehensive competency matrices and skill gap analysis.',
  },
  {
    icon: Award,
    title: 'Certification Tracking',
    description: 'Automate certification renewals, track expiration dates, and ensure 100% compliance with industry regulations.',
  },
  {
    icon: TrendingUp,
    title: 'Performance Analytics',
    description: 'Gain actionable insights with real-time dashboards, trend analysis, and predictive workforce planning tools.',
  },
];

export function ValueProposition() {
  return (
    <section id="features" className="py-16 md:py-20 lg:py-24" data-testid="section-value-proposition">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4" data-testid="text-value-heading">
            Everything you need to manage workforce competency
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-value-subheading">
            A complete platform designed for industrial organizations to track, develop, 
            and optimize their workforce capabilities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <Card key={feature.title} className="p-6 md:p-8 hover-elevate" data-testid={`card-feature-${index}`}>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl md:text-2xl font-medium mb-3" data-testid={`text-feature-title-${index}`}>
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed" data-testid={`text-feature-desc-${index}`}>
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
