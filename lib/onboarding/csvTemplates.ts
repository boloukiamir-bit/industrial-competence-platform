/**
 * Onboarding CSV template definitions. Used by GET /api/onboarding/templates/[type].
 * Column names match API validation (normalized: lowercase, underscores).
 */

export const ONBOARDING_TEMPLATE_TYPES = [
  "areas",
  "stations",
  "employees",
  "shift-patterns",
] as const;

export type OnboardingTemplateType = (typeof ONBOARDING_TEMPLATE_TYPES)[number];

/** Header row only; one example data row for clarity in the file. */
const TEMPLATES: Record<OnboardingTemplateType, string> = {
  areas: [
    "site_name,area_name,area_code",
    "Main Site,Bearbetning,BEA",
    "Main Site,Ommantling,OMM",
  ].join("\n"),
  stations: [
    "site_name,area_name,station_name,station_code,area_code",
    "Main Site,Bearbetning,Station 1,S1,BEA",
    "Main Site,Ommantling,Station 2,S2,OMM",
  ].join("\n"),
  employees: [
    "employee_no,first_name,last_name,team,primary_station_code",
    "10001,Anna,Andersson,Team A,S1",
    "10002,Erik,Eriksson,Team B,",
  ].join("\n"),
  "shift-patterns": [
    "site_name,shift_code,start_time,end_time,break_minutes",
    "Main Site,S1,06:00,14:00,30",
    "Main Site,S2,14:00,22:00,30",
  ].join("\n"),
};

export function getOnboardingTemplateCsv(
  type: OnboardingTemplateType
): string {
  const csv = TEMPLATES[type];
  if (!csv) return "";
  return csv;
}

export function isOnboardingTemplateType(
  type: string
): type is OnboardingTemplateType {
  return ONBOARDING_TEMPLATE_TYPES.includes(type as OnboardingTemplateType);
}
