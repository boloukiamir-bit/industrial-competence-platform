"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function RequestErrorCard({
  message,
  toastMessage,
}: {
  message: string;
  toastMessage: string;
}) {
  const { toast } = useToast();

  useEffect(() => {
    toast({
      title: toastMessage,
      variant: "destructive",
    });
  }, [toast, toastMessage]);

  return (
    <Card>
      <CardContent className="py-8 text-center">
        <AlertTriangle className="h-10 w-10 mx-auto text-destructive mb-3" />
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </CardContent>
    </Card>
  );
}
