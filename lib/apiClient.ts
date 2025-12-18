import { logDebugError, logApiCall } from './debugStore';
import { supabase } from './supabaseClient';

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export async function apiGet<T = unknown>(url: string): Promise<T> {
  const headers = await getAuthHeaders();
  
  const res = await fetch(url, { headers });
  logApiCall(url, res.status);
  
  if (!res.ok) {
    let errorData: { error?: string; message?: string; code?: string; hint?: string } = {};
    try {
      errorData = await res.json();
    } catch {
      errorData = { message: res.statusText };
    }
    
    logDebugError({
      type: 'api',
      endpoint: url,
      status: res.status,
      code: errorData.code,
      message: errorData.message || errorData.error || `HTTP ${res.status}`,
      hint: errorData.hint,
    });
    
    throw new Error(errorData.message || errorData.error || `Request failed: ${res.status}`);
  }
  
  return res.json();
}

export async function apiPost<T = unknown>(url: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  logApiCall(url, res.status);
  
  if (!res.ok) {
    let errorData: { error?: string; message?: string; code?: string; hint?: string } = {};
    try {
      errorData = await res.json();
    } catch {
      errorData = { message: res.statusText };
    }
    
    logDebugError({
      type: 'api',
      endpoint: url,
      status: res.status,
      code: errorData.code,
      message: errorData.message || errorData.error || `HTTP ${res.status}`,
      hint: errorData.hint,
    });
    
    throw new Error(errorData.message || errorData.error || `Request failed: ${res.status}`);
  }
  
  return res.json();
}
