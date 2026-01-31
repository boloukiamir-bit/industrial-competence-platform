export function withDevBearer(
  headers: Record<string, string> = {}
): Record<string, string> {
  if (process.env.NODE_ENV !== "development") {
    return headers;
  }
  const token = process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN;
  if (!token) {
    return headers;
  }
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}
