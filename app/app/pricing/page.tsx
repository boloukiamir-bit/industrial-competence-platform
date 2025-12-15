"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star } from "lucide-react";
import { pricingConfig, calculateYearlyCost } from "@/lib/pricing";

export default function PricingPage() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: "SEK",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Industrial Competence Platform</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Purpose-built for industrial organizations. Lower cost than generic HR tools, 
          with specialized features for competence management, compliance, and people risk.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Card className="relative">
          <CardHeader>
            <CardTitle className="text-xl">Business</CardTitle>
            <div className="mt-4">
              <span className="text-3xl font-bold">
                {formatCurrency(pricingConfig.business.baseYearlySEK)}
              </span>
              <span className="text-muted-foreground">/year</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              + {formatCurrency(pricingConfig.business.perEmployeeMonthlySEK)}/employee/month 
              after {pricingConfig.business.maxIncludedEmployees} employees
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {pricingConfig.business.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button className="w-full mt-6" variant="outline" data-testid="button-select-business">
              Get Started
            </Button>
          </CardContent>
        </Card>

        <Card className="relative border-primary">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              Most Popular
            </Badge>
          </div>
          <CardHeader>
            <CardTitle className="text-xl">Enterprise</CardTitle>
            <div className="mt-4">
              <span className="text-3xl font-bold">
                {formatCurrency(pricingConfig.enterprise.baseYearlySEK)}
              </span>
              <span className="text-muted-foreground">/year</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              + {formatCurrency(pricingConfig.enterprise.perEmployeeMonthlySEK)}/employee/month 
              after {pricingConfig.enterprise.maxIncludedEmployees} employees
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {pricingConfig.enterprise.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button className="w-full mt-6" data-testid="button-select-enterprise">
              Get Started
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4">Why Choose Us Over Generic HR Tools?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Industrial Focus</h3>
              <p className="text-sm text-muted-foreground">
                Built for manufacturing, logistics, and industrial operations. 
                Not another generic HR SaaS.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Competence Risk Engine</h3>
              <p className="text-sm text-muted-foreground">
                See skill gaps per line and team. Know exactly what training 
                is needed before tomorrow&apos;s shift.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Lower Cost</h3>
              <p className="text-sm text-muted-foreground">
                Up to 25% lower than competitors like Huma. 
                No hidden fees, predictable pricing.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-12 p-6 bg-muted rounded-lg text-center">
        <h3 className="font-semibold mb-2">Example: 100 Employees</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto text-sm">
          <div>
            <p className="text-muted-foreground">Business Plan</p>
            <p className="text-lg font-semibold">{formatCurrency(calculateYearlyCost("business", 100))}/year</p>
          </div>
          <div>
            <p className="text-muted-foreground">Enterprise Plan</p>
            <p className="text-lg font-semibold">{formatCurrency(calculateYearlyCost("enterprise", 100))}/year</p>
          </div>
        </div>
      </div>
    </div>
  );
}
