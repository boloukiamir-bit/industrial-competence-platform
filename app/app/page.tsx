"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/cockpit");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="animate-pulse text-muted-foreground">
        Loading...
      </div>
    </div>
  );
}
