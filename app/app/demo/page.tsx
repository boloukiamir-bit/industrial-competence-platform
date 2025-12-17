"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  LogIn, 
  Building2, 
  Table2, 
  TrendingUp, 
  Download, 
  CheckCircle,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

const demoSteps = [
  {
    step: 1,
    title: "Login",
    description: "Sign in with your demo credentials or create a new account.",
    icon: LogIn,
    link: "/login",
    linkText: "Go to Login",
  },
  {
    step: 2,
    title: "Select Organization",
    description: "Choose your organization or create a new one to get started.",
    icon: Building2,
    link: "/app/org/select",
    linkText: "Select Org",
  },
  {
    step: 3,
    title: "Open Competence Matrix",
    description: "View the skill matrix showing all employees and their competency levels with color-coded status badges.",
    icon: Table2,
    link: "/app/competence-matrix?demo=true",
    linkText: "View Matrix",
  },
  {
    step: 4,
    title: "Generate Tomorrow's Gaps",
    description: "Click 'Generate Gaps' to analyze skill shortages for tomorrow's shift. See the summary card with top missing skills and recommendations.",
    icon: TrendingUp,
    link: "/app/gaps?demo=true",
    linkText: "Open Gaps",
  },
  {
    step: 5,
    title: "Export Action Plan",
    description: "Download the gaps table as CSV to share with your team or import into your planning system.",
    icon: Download,
    link: "/app/gaps?demo=true",
    linkText: "Export CSV",
  },
];

export default function DemoScriptPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <Badge className="mb-4">Demo Script</Badge>
        <h1 className="text-2xl font-bold mb-2" data-testid="heading-demo-script">
          Nadiplan Product Demo
        </h1>
        <p className="text-muted-foreground">
          Follow these 5 steps to demonstrate the key features of the Industrial Competence Platform.
        </p>
      </div>

      <div className="space-y-4">
        {demoSteps.map((item, index) => (
          <Card key={item.step} className="relative" data-testid={`card-step-${item.step}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Step {item.step}
                    </Badge>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="ml-14">
                <p className="text-sm text-muted-foreground mb-3">
                  {item.description}
                </p>
                <Link
                  href={item.link}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  data-testid={`link-step-${item.step}`}
                >
                  {item.linkText}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
            {index < demoSteps.length - 1 && (
              <div className="absolute left-9 top-[72px] w-0.5 h-[calc(100%-48px)] bg-border" />
            )}
          </Card>
        ))}
      </div>

      <Card className="mt-8 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200 mb-1">
                Demo Complete
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                After completing these steps, your customer has seen the core value proposition:
                visualize competence gaps and take action before they impact operations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Need to reset demo data or start fresh?
        </p>
        <Link
          href="/app/dashboard"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          data-testid="link-back-dashboard"
        >
          Back to Dashboard
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
