// Keep in sync with packages/express-backend/src/auth/roles.js
export type Role = "viewer" | "editor" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

const RANK: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2
};

// Only editors and admins may move, delete or reconnect
// anything on the diagram.
export function canEdit(role: Role): boolean {
  return RANK[role] >= RANK.editor;
}

export const ROLE_BADGE: Record<Role, string> = {
  viewer: "View only",
  editor: "Editor",
  admin: "Admin"
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function isAdmin(role: Role | null): boolean {
  return role === "admin";
}

// What each role can do, shown on the Users & roles page.
// The storyboard calls the read-only role "Operator"; the
// stored value stays "viewer".
export const ROLE_INFO: Record<
  Role,
  { label: string; summary: string }
> = {
  viewer: {
    label: "Operator",
    summary: "Watch live diagrams. Can't edit anything."
  },
  editor: {
    label: "Editor",
    summary: "Build, import, export and save diagrams."
  },
  admin: {
    label: "Admin",
    summary:
      "Everything editors can do, plus manage people and roles."
  }
};

export const ROLES: Role[] = ["viewer", "editor", "admin"];
