"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, FileCheck } from "lucide-react";

type StationStatus = "go" | "warning" | "no-go";

const STATIONS = [
  { id: "assembly", label: "Assembly Line A" },
  { id: "warehouse", label: "Warehouse / Forklift" },
  { id: "quality", label: "Quality Check" },
] as const;

const CYCLE_MS = 2800;

type CycleState = "all-go" | "warning" | "no-go";

function getStatuses(state: CycleState): StationStatus[] {
  switch (state) {
    case "all-go":
      return ["go", "go", "go"];
    case "warning":
      return ["go", "warning", "go"];
    case "no-go":
      return ["go", "no-go", "go"];
    default:
      return ["go", "go", "go"];
  }
}

const stateOrder: CycleState[] = ["all-go", "warning", "no-go"];

export function HeroCommandPreview() {
  const [stateIndex, setStateIndex] = useState(0);
  const state: CycleState = stateOrder[stateIndex];
  const statuses = getStatuses(state);
  const showDrawer = state === "no-go";

  useEffect(() => {
    const t = setInterval(() => {
      setStateIndex((i) => (i + 1) % stateOrder.length);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, []);

  const StatusIcon = useCallback(({ status }: { status: StationStatus }) => {
    switch (status) {
      case "go":
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />;
      case "no-go":
        return <XCircle className="h-5 w-5 text-red-600" aria-hidden />;
    }
  }, []);

  const statusLabel = (status: StationStatus) =>
    status === "go" ? "GO" : status === "warning" ? "WARNING" : "NO-GO";

  return (
    <div className="relative w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Command preview
        </p>
        <div className="mt-1 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Tomorrow&apos;s Shift Readiness
          </h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            06:00 – 14:00
          </span>
        </div>
      </div>

      {/* Stations */}
      <ul className="divide-y divide-slate-100" aria-label="Station readiness">
        {STATIONS.map((station, i) => (
          <li
            key={station.id}
            className={`flex items-center justify-between px-5 py-3.5 ${
              statuses[i] === "no-go" ? "bg-red-50/60" : ""
            }`}
          >
            <span className="text-sm font-medium text-slate-800">{station.label}</span>
            <div className="flex items-center gap-2">
              <StatusIcon status={statuses[i]} />
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${
                  statuses[i] === "go"
                    ? "text-emerald-600"
                    : statuses[i] === "warning"
                      ? "text-amber-600"
                      : "text-red-600"
                }`}
              >
                {statusLabel(statuses[i])}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* NO-GO drawer (slides in from right) */}
      <AnimatePresence>
        {showDrawer && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            className="absolute top-0 right-0 bottom-0 border-l border-slate-200 bg-white shadow-xl overflow-hidden"
            style={{ minWidth: "240px" }}
            aria-live="polite"
            aria-label="No-go detail"
          >
            <div className="w-[240px] h-full flex flex-col p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Root cause
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                Forklift license expired
              </p>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Recommended actions
              </p>
              <ul className="mt-2 space-y-1.5">
                {["Swap operator", "Call-in", "Escalate"].map((action) => (
                  <li key={action}>
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full text-left text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {action}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                <FileCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Decision saved. Audit log updated.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
