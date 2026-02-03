export function isPilotMode(): boolean {
  return process.env.PILOT_MODE === "true" || process.env.NEXT_PUBLIC_PILOT_MODE === "true";
}
