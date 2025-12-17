"use client";

import { useEffect, useState } from "react";
import { validatePublicEnv } from "@/lib/env";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";

interface HealthStatus {
  envPresent: boolean;
  missingEnvVars: string[];
  supabaseReachable: boolean | null;
  supabaseError: string | null;
  authStatus: boolean | null;
  userEmail: string | null;
  userRole: string | null;
  loading: boolean;
}

function StatusIcon({ status }: { status: boolean | null }) {
  if (status === null) {
    return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  }
  return status ? (
    <CheckCircle className="w-5 h-5 text-green-600" data-testid="icon-check" />
  ) : (
    <XCircle className="w-5 h-5 text-red-600" data-testid="icon-x" />
  );
}

function StatusRow({ 
  label, 
  status, 
  error,
  testId 
}: { 
  label: string; 
  status: boolean | null; 
  error?: string | null;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0" data-testid={testId}>
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-600 max-w-xs truncate">{error}</span>}
        <StatusIcon status={status} />
      </div>
    </div>
  );
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthStatus>({
    envPresent: false,
    missingEnvVars: [],
    supabaseReachable: null,
    supabaseError: null,
    authStatus: null,
    userEmail: null,
    userRole: null,
    loading: true,
  });

  async function checkHealth() {
    setHealth(prev => ({ ...prev, loading: true }));

    // Check env vars
    const envValidation = validatePublicEnv();
    
    let supabaseReachable = false;
    let supabaseError: string | null = null;
    let authStatus = false;
    let userEmail: string | null = null;
    let userRole: string | null = null;

    if (envValidation.valid) {
      // Test Supabase connection with a simple query
      try {
        const { error } = await supabase.from("profiles").select("id").limit(1);
        if (error) {
          // If table doesn't exist, that's still a successful connection
          if (error.code === "PGRST116" || error.message.includes("does not exist")) {
            supabaseReachable = true;
            supabaseError = "profiles table not found (run bootstrap)";
          } else {
            supabaseError = error.message;
          }
        } else {
          supabaseReachable = true;
        }
      } catch (err) {
        supabaseError = err instanceof Error ? err.message : "Connection failed";
      }

      // Check auth status
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          authStatus = true;
          userEmail = session.user.email || null;
          
          // Get user role from profiles
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
          
          userRole = profile?.role || "not set";
        }
      } catch (err) {
        // Auth check failed
      }
    }

    setHealth({
      envPresent: envValidation.valid,
      missingEnvVars: envValidation.missing,
      supabaseReachable,
      supabaseError,
      authStatus,
      userEmail,
      userRole,
      loading: false,
    });
  }

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold">System Health</h1>
            <button
              onClick={checkHealth}
              disabled={health.loading}
              className="p-2 rounded-md hover:bg-accent transition-colors"
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${health.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {!health.envPresent && health.missingEnvVars.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md" data-testid="alert-missing-env">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                Missing Environment Variables
              </p>
              <ul className="text-xs text-red-700 dark:text-red-300">
                {health.missingEnvVars.map((v) => (
                  <li key={v} className="font-mono">{v}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-0">
            <StatusRow
              label="Supabase env present"
              status={health.envPresent}
              testId="status-env"
            />
            <StatusRow
              label="Supabase reachable"
              status={health.supabaseReachable}
              error={health.supabaseError}
              testId="status-supabase"
            />
            <StatusRow
              label="Auth session exists"
              status={health.authStatus}
              testId="status-auth"
            />
          </div>

          {health.userEmail && (
            <div className="mt-4 pt-4 border-t border-border" data-testid="user-info">
              <p className="text-sm text-muted-foreground mb-1">Signed in as</p>
              <p className="text-sm font-medium" data-testid="text-user-email">{health.userEmail}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Role: <span className="font-mono" data-testid="text-user-role">{health.userRole}</span>
              </p>
            </div>
          )}

          {!health.loading && health.envPresent && health.supabaseReachable && !health.authStatus && (
            <div className="mt-4 pt-4 border-t border-border">
              <a
                href="/login"
                className="block w-full text-center py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                data-testid="link-login"
              >
                Sign in
              </a>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Industrial Competence Platform
        </p>
      </div>
    </div>
  );
}
