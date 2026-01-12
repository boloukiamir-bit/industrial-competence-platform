"use client";

import { useState, useCallback } from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToastState {
  toasts: Toast[];
}

let toastCount = 0;

function genId() {
  toastCount = (toastCount + 1) % Number.MAX_VALUE;
  return toastCount.toString();
}

export function useToast() {
  const [state, setState] = useState<ToastState>({ toasts: [] });

  const toast = useCallback(({ title, description, variant }: Omit<Toast, "id">) => {
    const id = genId();
    setState((prev) => ({
      toasts: [...prev.toasts, { id, title, description, variant }],
    }));

    setTimeout(() => {
      setState((prev) => ({
        toasts: prev.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);

    return { id };
  }, []);

  const dismiss = useCallback((id?: string) => {
    setState((prev) => ({
      toasts: id ? prev.toasts.filter((t) => t.id !== id) : [],
    }));
  }, []);

  return {
    toast,
    dismiss,
    toasts: state.toasts,
  };
}
