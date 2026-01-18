export function getSpaliDevMode(): boolean {
  if (typeof window === "undefined") {
    return process.env.SPALI_DEV_MODE === "true";
  }
  return process.env.NEXT_PUBLIC_SPALI_DEV_MODE === "true";
}

export const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
