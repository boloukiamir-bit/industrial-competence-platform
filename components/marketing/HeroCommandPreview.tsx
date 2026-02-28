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
        return <CheckCircle2 className="h-4 w-4 text-slate-500" aria-hidden />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-slate-600" aria-hidden />;
      case "no-go":
        return <XCircle className="h-4 w-4 text-slate-700" aria-hidden />;
    }
  }, []);

  const statusLabel = (status: StationStatus) =>
    status === "go" ? "GO" : status === "warning" ? "WARNING" : "NO-GO";

  return (
    <div className="relative w-full max-w-[400px] rounded-lg border border-slate-200/80 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
          Command preview
        </p>
        <div className="mt-1 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-slate-900">
            Tomorrow&apos;s Shift Readiness
          </h3>
          <span className="text-[11px] font-medium text-slate-500">
            06:00 – 14:00
          </span>
        </div>
      </div>

      {/* Stations */}
      <ul className="divide-y divide-slate-100" aria-label="Station readiness">
        {STATIONS.map((station, i) => (
          <li
            key={station.id}
            className={`flex items-center justify-between px-4 py-3 ${
              statuses[i] === "no-go" ? "bg-slate-50" : ""
            }`}
          >
            <span className="text-[13px] font-medium text-slate-700">{station.label}</span>
            <div className="flex items-center gap-2">
              <StatusIcon status={statuses[i]} />
              <span
                className={`text-[11px] font-medium uppercase tracking-wide ${
                  statuses[i] === "go"
                    ? "text-slate-600"
                    : statuses[i] === "warning"
                      ? "text-slate-700"
                      : "text-slate-800"
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
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className="absolute top-0 right-0 bottom-0 border-l border-slate-200/80 bg-white overflow-hidden"
            style={{ minWidth: "220px" }}
            aria-live="polite"
            aria-label="No-go detail"
          >
            <div className="w-[220px] h-full flex flex-col p-3.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
                Root cause
              </p>
              <p className="mt-1 text-[13px] font-medium text-slate-800">
                Forklift license expired
              </p>
              <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
                Recommended actions
              </p>
              <ul className="mt-1.5 space-y-1">
                {["Swap operator", "Call-in", "Escalate"].map((action) => (
                  <li key={action}>
                    <span className="flex items-center gap-2 text-[13px] text-slate-600">
                      <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                      {action}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
                <FileCheck className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>Decision saved. Audit log updated.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
