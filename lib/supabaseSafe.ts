import { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js';
import { logDebugError, setFlag } from './debugStore';

interface SupabaseError {
  message: string;
  code?: string;
  hint?: string;
  details?: string;
}

interface SupabaseResponseWithError {
  data: unknown;
  error: SupabaseError | null;
  count?: number | null;
}

function isRlsError(error: SupabaseError): boolean {
  const msg = error.message?.toLowerCase() || '';
  const code = error.code || '';
  
  return (
    msg.includes('permission denied') ||
    msg.includes('rls') ||
    msg.includes('row-level security') ||
    msg.includes('policy') ||
    code === 'PGRST301' ||
    code === '42501' ||
    code === '42P01'
  );
}

export function assertOk<T extends SupabaseResponseWithError>(
  response: T,
  context: string
): T {
  if (response.error) {
    const err = response.error;
    
    logDebugError({
      type: 'supabase',
      endpoint: context,
      code: err.code ?? undefined,
      message: err.message ?? JSON.stringify(err),
      hint: (err as { hint?: string }).hint ?? undefined,
    });
    
    if (isRlsError(err)) {
      setFlag('rlsBlocked', true);
    }
    
    throw new Error(`${context}: ${err.message}`);
  }
  
  return response;
}

export function handleSupabaseResponse<T>(
  response: PostgrestResponse<T> | PostgrestSingleResponse<T>,
  context: string
): T | T[] | null {
  if (response.error) {
    const err = response.error;
    
    logDebugError({
      type: 'supabase',
      endpoint: context,
      code: err.code,
      message: err.message,
      hint: err.hint,
    });
    
    if (isRlsError(err)) {
      setFlag('rlsBlocked', true);
    }
    
    throw new Error(err.message);
  }
  
  return response.data;
}

export async function safeQuery<T>(
  queryFn: () => Promise<PostgrestResponse<T> | PostgrestSingleResponse<T>>,
  context: string
): Promise<T | T[] | null> {
  try {
    const response = await queryFn();
    return handleSupabaseResponse(response, context);
  } catch (error) {
    if (error instanceof Error && !error.message.includes('logged')) {
      logDebugError({
        type: 'supabase',
        endpoint: context,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function safeCount(
  queryFn: () => Promise<PostgrestResponse<unknown>>,
  context: string
): Promise<number | 'denied' | null> {
  try {
    const response = await queryFn();
    
    if (response.error) {
      logDebugError({
        type: 'supabase',
        endpoint: context,
        code: response.error.code,
        message: response.error.message,
        hint: response.error.hint,
      });
      
      if (isRlsError(response.error)) {
        setFlag('rlsBlocked', true);
        return 'denied';
      }
      
      return null;
    }
    
    return response.count ?? null;
  } catch (error) {
    logDebugError({
      type: 'supabase',
      endpoint: context,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
