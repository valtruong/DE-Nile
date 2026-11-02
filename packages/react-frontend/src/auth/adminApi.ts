import { AuthError } from "./authApi";
import type { Role, User } from "./roles";

// Wrappers around the backend's admin-only /api/admin routes.
// The server checks the role on every call; these just save
// typing.

export type AdminUser = User & { emailVerified: boolean };

export type Invite = {
  email: string;
  role: Role;
  invitedByName: string;
  createdAt: number;
};

const OFFLINE = "Couldn't reach the DE-Nile server. Try again.";

async function call<T>(
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

export async function listUsers(): Promise<AdminUser[]> {
  const body = await call<{ users: AdminUser[] }>(
    "GET",
    "/api/admin/users"
  );
  return body.users;
}

export async function changeRole(
  id: string,
  role: Role
): Promise<AdminUser> {
  const body = await call<{ user: AdminUser }>(
    "PATCH",
    `/api/admin/users/${encodeURIComponent(id)}`,
    { role }
  );
  return body.user;
}

// Deletes the account. Admins can't remove themselves.
export async function removeUser(id: string): Promise<void> {
  await call<null>(
    "DELETE",
    `/api/admin/users/${encodeURIComponent(id)}`
  );
}

export async function listInvites(): Promise<Invite[]> {
  const body = await call<{ invites: Invite[] }>(
    "GET",
    "/api/admin/invites"
  );
  return body.invites;
}

export async function invite(
  email: string,
  role: Role
): Promise<Invite> {
  const body = await call<{ invite: Invite }>(
    "POST",
    "/api/admin/invites",
    { email, role }
  );
  return body.invite;
}

export async function revokeInvite(
  email: string
): Promise<void> {
  await call<null>(
    "DELETE",
    `/api/admin/invites/${encodeURIComponent(email)}`
  );
}
