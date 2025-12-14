const stats = [
  { value: '98%', label: 'Customer Satisfaction', sublabel: 'Based on 500+ reviews' },
  { value: '45%', label: 'Time Saved', sublabel: 'On compliance management' },
  { value: '3.2M', label: 'Certifications Tracked', sublabel: 'Across all clients' },
  { value: '24/7', label: 'Support Available', sublabel: 'Enterprise-grade SLA' },
];

export function Statistics() {
  return (
    <section className="py-16 md:py-20 lg:py-24 bg-primary text-primary-foreground" data-testid="section-statistics">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4" data-testid="text-stats-heading">
            Trusted by industry leaders
          </h2>
          <p className="text-lg opacity-80 max-w-2xl mx-auto" data-testid="text-stats-subheading">
            Join hundreds of organizations that have transformed their competency management
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((stat, index) => (
            <div key={stat.label} className="text-center" data-testid={`stat-${index}`}>
              <div className="text-4xl md:text-5xl font-bold mb-2" data-testid={`text-stat-value-${index}`}>
                {stat.value}
              </div>
              <div className="text-base font-medium mb-1" data-testid={`text-stat-label-${index}`}>
                {stat.label}
              </div>
              <div className="text-sm opacity-70" data-testid={`text-stat-sublabel-${index}`}>
                {stat.sublabel}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
