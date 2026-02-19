/**
 * Phase A – Execution token binding. Short-lived token tied to readiness state.
 * HMAC SHA256 with EXECUTION_TOKEN_SECRET. TTL default 5 minutes.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export type ExecutionTokenPayload = {
  org_id: string;
  site_id: string | null;
  shift_code?: string | null;
  shift_date?: string | null;
  readiness_status: string;
  policy_fingerprint: string | null;
  calculated_at: string | null;
  issued_at: number;
  /** Optional: actions this token is allowed to perform (e.g. COCKPIT_DECISION_CREATE). Signed. */
  allowed_actions?: string[];
  /** Optional: unique token id for one-time use (anti-replay). Signed. */
  jti?: string;
};

/** Deterministic JSON stringify (sorted keys) for signing. */
function stableStringify(obj: unknown, seen = new WeakSet<object>()): string {
  if (obj === null) return "null";
  if (obj === undefined) return "null";
  if (typeof obj === "string") return JSON.stringify(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (seen.has(obj as object)) return JSON.stringify(String(obj));
  if (Array.isArray(obj)) {
    seen.add(obj as object);
    const parts = obj.map((v) => stableStringify(v, seen));
    seen.delete(obj as object);
    return "[" + parts.join(",") + "]";
  }
  seen.add(obj as object);
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const parts = keys.map((k) =>
    JSON.stringify(k) + ":" + stableStringify((obj as Record<string, unknown>)[k], seen)
  );
  seen.delete(obj as object);
  return "{" + parts.join(",") + "}";
}

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Buffer | null {
  try {
    let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

function getSecret(): string {
  const secret = process.env.EXECUTION_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("EXECUTION_TOKEN_SECRET must be set and at least 16 characters");
  }
  return secret;
}

export function createExecutionToken(payload: ExecutionTokenPayload): string {
  const secret = getSecret();
  const payloadWithJti: ExecutionTokenPayload = {
    ...payload,
    jti: payload.jti ?? randomUUID(),
  };
  const { issued_at: _issued, ...rest } = payloadWithJti;
  const basePayloadString = stableStringify(rest);
  const signature = createHmac("sha256", secret)
    .update(basePayloadString, "utf8")
    .digest();
  const envelope = { ...payloadWithJti, sig: base64urlEncode(signature) };
  const json = JSON.stringify(envelope);
  return base64urlEncode(Buffer.from(json, "utf8"));
}

export function verifyExecutionToken(
  token: string,
  opts?: { nowMs?: number; ttlMs?: number }
): {
  valid: boolean;
  payload?: ExecutionTokenPayload;
  error?: { code: "TOKEN_EXPIRED" | "TOKEN_INVALID" };
} {
  const invalid = (): { valid: false; error: { code: "TOKEN_INVALID" } } => ({
    valid: false,
    error: { code: "TOKEN_INVALID" },
  });
  const expired = (): { valid: false; error: { code: "TOKEN_EXPIRED" } } => ({
    valid: false,
    error: { code: "TOKEN_EXPIRED" },
  });
  try {
    const secret = process.env.EXECUTION_TOKEN_SECRET;
    if (!secret || secret.length < 16) {
      return invalid();
    }
    const decoded = base64urlDecode(token);
    if (!decoded) return invalid();
    const envelope = JSON.parse(decoded.toString("utf8")) as Record<string, unknown>;
    const sig = envelope.sig;
    if (typeof sig !== "string") return invalid();
    const { sig: _sig, ...payload } = envelope;
    const payloadObj = payload as ExecutionTokenPayload;
    if (
      typeof payloadObj.org_id !== "string" ||
      typeof payloadObj.readiness_status !== "string"
    ) {
      return invalid();
    }
    const basePayloadString = stableStringify(payload);
    const expectedSig = createHmac("sha256", secret)
      .update(basePayloadString, "utf8")
      .digest();
    let sigB64 = (sig as string).replace(/-/g, "+").replace(/_/g, "/");
    if (sigB64.length % 4) sigB64 += "=".repeat(4 - (sigB64.length % 4));
    const receivedSig = Buffer.from(sigB64, "base64");
    if (expectedSig.length !== receivedSig.length || !timingSafeEqual(expectedSig, receivedSig)) {
      return invalid();
    }
    const issuedAt = payloadObj.issued_at;
    if (typeof issuedAt !== "number" || !Number.isFinite(issuedAt)) {
      return invalid();
    }
    const now = opts?.nowMs ?? Date.now();
    const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS;
    if (now - issuedAt > ttl) {
      return expired();
    }
    const allowed_actions = Array.isArray(payloadObj.allowed_actions)
      ? payloadObj.allowed_actions
      : undefined;
    const jti =
      typeof payloadObj.jti === "string" && payloadObj.jti.length > 0
        ? payloadObj.jti
        : undefined;
    return {
      valid: true,
      payload: {
        org_id: payloadObj.org_id,
        site_id: payloadObj.site_id ?? null,
        shift_code: payloadObj.shift_code ?? null,
        shift_date: payloadObj.shift_date ?? null,
        readiness_status: payloadObj.readiness_status,
        policy_fingerprint: payloadObj.policy_fingerprint ?? null,
        calculated_at: payloadObj.calculated_at ?? null,
        issued_at: issuedAt,
        ...(allowed_actions != null && { allowed_actions }),
        ...(jti != null && { jti }),
      },
    };
  } catch {
    return invalid();
  }
}
