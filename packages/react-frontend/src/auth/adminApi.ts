import { apiCall as call } from "./apiCall";
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
