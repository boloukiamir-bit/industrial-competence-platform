"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * HR Templates detail: redirect to workflow template detail where user can view tasks and create instance for employee.
 */
export default function HrTemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/app/workflows/templates/${id}`);
    }
  }, [id, router]);

  return (
    <div className="p-6 flex items-center justify-center min-h-[300px]">
      <p className="text-muted-foreground">Redirecting to template…</p>
    </div>
  );
}
