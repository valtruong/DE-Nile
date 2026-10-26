import type { User } from "./roles";

// Thin wrappers around the backend's /api/auth routes.
// The session lives in an httpOnly cookie, so the browser
// sends it automatically; we never touch it in JavaScript.

const OFFLINE = "Couldn't reach the DE-Nile server. Try again.";

export class AuthError extends Error {
  // e.g. "EMAIL_NOT_VERIFIED"
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function toError(res: Response): Promise<AuthError> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") {
      return new AuthError(body.error, body.code);
    }
  } catch {
    // Not JSON; fall through.
  }
  return new AuthError(OFFLINE);
}

async function post(path: string, data: unknown) {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  } catch {
    throw new AuthError(OFFLINE);
  }
  if (!res.ok) throw await toError(res);
  return res.status === 204 ? null : res.json();
}

export async function fetchCurrentUser(): Promise<User | null> {
  const res = await fetch("/api/auth/me", {
    credentials: "same-origin"
  });
  if (res.status === 401) return null;
  if (!res.ok) throw await toError(res);
  const body = await res.json();
  return body.user as User;
}

export async function signIn(
  email: string,
  password: string
): Promise<User> {
  const body = await post("/api/auth/login", {
    email,
    password
  });
  return body.user as User;
}

// Creates a viewer account and emails a 6-digit code.
export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<void> {
  await post("/api/auth/signup", { name, email, password });
}

// Checks the code; on success the user is signed in.
export async function verifyEmail(
  email: string,
  code: string
): Promise<User> {
  const body = await post("/api/auth/verify", { email, code });
  return body.user as User;
}

export async function resendCode(email: string): Promise<void> {
  await post("/api/auth/resend", { email });
}

// Emails a reset code if the account exists (the server
// answers the same either way).
export async function forgotPassword(
  email: string
): Promise<void> {
  await post("/api/auth/forgot", { email });
}

// Sets the new password; on success the user is signed in.
export async function resetPassword(
  email: string,
  code: string,
  password: string
): Promise<User> {
  const body = await post("/api/auth/reset", {
    email,
    code,
    password
  });
  return body.user as User;
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin"
  });
}
