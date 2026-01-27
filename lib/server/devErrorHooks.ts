/**
 * Dev-only error hooks for diagnosing unhandled promise rejections and uncaught exceptions.
 * Only registers in non-production environments.
 */

let hooksRegistered = false;

export function registerDevErrorHooks(): void {
  // Only register in non-production
  if (process.env.NODE_ENV === "production") {
    return;
  }

  // Ensure hooks register only once
  if (hooksRegistered) {
    return;
  }

  hooksRegistered = true;

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
    console.error("[DEV ERROR HOOK] Unhandled Promise Rejection:", {
      reason,
      promise,
      stack: reason instanceof Error ? reason.stack : undefined,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    console.error("[DEV ERROR HOOK] Uncaught Exception:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
    });
    // Note: In production, uncaught exceptions typically cause process exit
    // In dev, we log and continue for debugging
  });
}
