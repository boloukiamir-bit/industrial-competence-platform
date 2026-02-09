"use client";

import { OrgGuard } from "@/components/OrgGuard";
import CompetenceAdminPage from "@/app/admin/competence/page";

export default function AppAdminCompetencePage() {
  return (
    <OrgGuard requireAdminOrHr>
      <CompetenceAdminPage />
    </OrgGuard>
  );
}
