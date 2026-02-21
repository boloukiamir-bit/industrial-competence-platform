import { withDevBearer } from "@/lib/devBearer";

export type FetchJsonError = {
  ok: false;
  status: number;
  error: string;
};

export type FetchJsonSuccess<T> = {
  ok: true;
  status: number;
  data: T;
};

export type FetchJsonResult<T> = FetchJsonSuccess<T> | FetchJsonError;

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  const h = new Headers(headers || {});
  h.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Same-origin JSON fetch. Uses credentials: "include" by default for cookie auth.
 * Call with relative URLs only (e.g. /api/line-overview/lines) — no hardcoded host or 127.0.0.1.
 */
export async function fetchJson<T>(
  url: string,
  options: RequestInit = {}
): Promise<FetchJsonResult<T>> {
  const isBrowser = typeof window !== "undefined";
  const defaultHeaders: Record<string, string> = { accept: "application/json" };
  const headers = withDevBearer({
    ...defaultHeaders,
    ...normalizeHeaders(options.headers),
  });
  const response = await fetch(url, {
    ...options,
    credentials: isBrowser ? "include" : options.credentials,
    cache: isBrowser ? "no-store" : options.cache,
    headers,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error =
      (body as { error?: string; message?: string })?.error ||
      (body as { error?: string; message?: string })?.message ||
      response.statusText ||
      "Request failed";
    return { ok: false, status: response.status, error };
  }

  return { ok: true, status: response.status, data: body as T };
}

export type FetchJsonThrowError = { status: number; message: string };

/**
 * Same as fetchJson but throws on !res.ok with { status, message } so callers can show status (e.g. 401).
 * Use in client components when you need to display HTTP status in the UI.
 */
export async function fetchJsonOrThrow<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const isBrowser = typeof window !== "undefined";
  const defaultHeaders: Record<string, string> = { accept: "application/json" };
  const headers = withDevBearer({
    ...defaultHeaders,
    ...normalizeHeaders(options.headers),
  });
  const response = await fetch(url, {
    ...options,
    credentials: isBrowser ? "include" : options.credentials,
    cache: isBrowser ? "no-store" : options.cache,
    headers,
  });

  const text = await response.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // non-JSON body, use text as message
  }

  if (!response.ok) {
    const message =
      (body as { error?: string; message?: string })?.error ||
      (body as { error?: string; message?: string })?.message ||
      response.statusText ||
      text ||
      "Request failed";
    throw { status: response.status, message } as FetchJsonThrowError;
  }

  return (body as T);
}
