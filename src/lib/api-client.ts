/**
 * Thin client-side API wrapper for the apiHandler response envelope.
 * Unwraps { status: "success", data } and throws Error with the API's
 * message on failure, so callers get the real server error text (the
 * reason the 409 "Studio sedang digunakan" message became visible to admins).
 */
export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON response (e.g. proxy error page): fall through to generic error
  }
  if (!res.ok || body?.status === "error") {
    const message = body?.message || body?.error || `Permintaan gagal (${res.status})`;
    throw new Error(message);
  }
  // apiHandler wraps in { status, data }; raw passthrough handlers may not
  return (body && typeof body === "object" && "data" in body ? body.data : body) as T;
}

/** POST/PUT/PATCH/DELETE shorthand with JSON body. */
export async function sendJson<T = unknown>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  return fetchJson<T>(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Extract an Error message from a caught unknown, falling back to the given string. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}