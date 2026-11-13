import { AuthError } from "./authApi";

// fetch() wrapper for the backend's JSON API. Sends the session
// cookie, and turns error responses into an AuthError with the
// server's message and code (e.g. "VERSION_CONFLICT").

const OFFLINE = "Couldn't reach the DE-Nile server. Try again.";

export async function apiCall<T>(
  method: string,
  path: string,
  data?: unknown
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers:
        data === undefined
          ? undefined
          : { "Content-Type": "application/json" },
      body:
        data === undefined ? undefined : JSON.stringify(data)
    });
  } catch {
    throw new AuthError(OFFLINE);
  }
  if (res.status === 204) return null as T;
  let body: { error?: string; code?: string } & T;
  try {
    body = await res.json();
  } catch {
    throw new AuthError(OFFLINE);
  }
  if (!res.ok) {
    throw new AuthError(body.error ?? OFFLINE, body.code);
  }
  return body;
}
