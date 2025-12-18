export interface DebugError {
  timestamp: string;
  type: 'api' | 'supabase' | 'client';
  endpoint?: string;
  status?: number;
  code?: string;
  message: string;
  hint?: string;
  stack?: string;
}

export interface DebugFlags {
  rlsBlocked: boolean;
  orgMissing: boolean;
  loadingTimeout: boolean;
}

export interface DebugState {
  errors: DebugError[];
  flags: DebugFlags;
  lastApiCalls: { endpoint: string; status: number; timestamp: string }[];
}

type Listener = (state: DebugState) => void;

const MAX_ERRORS = 50;
const MAX_API_CALLS = 10;

let state: DebugState = {
  errors: [],
  flags: {
    rlsBlocked: false,
    orgMissing: false,
    loadingTimeout: false,
  },
  lastApiCalls: [],
};

const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach(fn => fn({ ...state }));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}

export function getState(): DebugState {
  return { ...state };
}

export function logDebugError(error: Omit<DebugError, 'timestamp'>) {
  const entry: DebugError = {
    ...error,
    timestamp: new Date().toISOString(),
  };
  
  state = {
    ...state,
    errors: [entry, ...state.errors].slice(0, MAX_ERRORS),
  };
  
  if (
    error.type === 'supabase' &&
    (error.message?.toLowerCase().includes('permission denied') ||
      error.message?.toLowerCase().includes('rls') ||
      error.code === 'PGRST301' ||
      error.code === '42501')
  ) {
    state = { ...state, flags: { ...state.flags, rlsBlocked: true } };
  }
  
  notify();
}

export function logApiCall(endpoint: string, status: number) {
  const entry = {
    endpoint,
    status,
    timestamp: new Date().toISOString(),
  };
  
  state = {
    ...state,
    lastApiCalls: [entry, ...state.lastApiCalls].slice(0, MAX_API_CALLS),
  };
  
  notify();
}

export function setFlag(flag: keyof DebugFlags, value: boolean) {
  state = {
    ...state,
    flags: { ...state.flags, [flag]: value },
  };
  notify();
}

export function clearErrors() {
  state = { ...state, errors: [] };
  notify();
}

export function resetFlags() {
  state = {
    ...state,
    flags: { rlsBlocked: false, orgMissing: false, loadingTimeout: false },
  };
  notify();
}

if (typeof window !== 'undefined') {
  (window as unknown as { __debugStore: typeof getState }).__debugStore = getState;
}
