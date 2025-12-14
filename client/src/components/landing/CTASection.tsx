import { Button } from '@/components/ui/button';
import { ArrowRight, Calendar } from 'lucide-react';

export function CTASection() {
  return (
    <section className="py-20 md:py-24" data-testid="section-cta">
      <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-semibold mb-4" data-testid="text-cta-heading">
          Ready to transform your competency management?
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto" data-testid="text-cta-subheading">
          Start your free trial today and see how our platform can help you build a more 
          skilled, compliant, and productive workforce.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="gap-2 w-full sm:w-auto" data-testid="button-cta-start">
            Start Free Trial
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto" data-testid="button-cta-demo">
            <Calendar className="w-4 h-4" />
            Schedule Demo
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-6" data-testid="text-cta-note">
          No credit card required. 14-day free trial with full access.
        </p>
      </div>
    </section>
  );
}
