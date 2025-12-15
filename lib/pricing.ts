export type PlanId = "business" | "enterprise";

export const pricingConfig = {
  business: {
    baseYearlySEK: 15000,
    perEmployeeMonthlySEK: 49,
    maxIncludedEmployees: 25,
    features: [
      "Competence matrix",
      "Gap analysis",
      "Employee import",
      "Basic reporting",
      "Up to 50 employees",
    ],
  },
  enterprise: {
    baseYearlySEK: 30000,
    perEmployeeMonthlySEK: 89,
    maxIncludedEmployees: 25,
    features: [
      "Everything in Business",
      "Manager risk dashboard",
      "Equipment tracking",
      "On/offboarding automation",
      "Medical check tracking",
      "Contract expiry alerts",
      "Unlimited employees",
      "Priority support",
    ],
  },
};

export function calculateYearlyCost(planId: PlanId, employeeCount: number): number {
  const plan = pricingConfig[planId];
  const additionalEmployees = Math.max(0, employeeCount - plan.maxIncludedEmployees);
  const monthlyCost = additionalEmployees * plan.perEmployeeMonthlySEK;
  return plan.baseYearlySEK + monthlyCost * 12;
}
