// Roles from the DE-Nile storyboard ("Users & roles" screen).
// viewer: watch live diagrams only. Anyone can be a viewer
//         without signing in ("Continue as viewer").
// editor: build, import, export and save diagrams.
// admin:  everything an editor can do, plus manage people
//         and roles.
export const ROLES = ["viewer", "editor", "admin"];

const RANK = { viewer: 0, editor: 1, admin: 2 };

export function isValidRole(role) {
  return ROLES.includes(role);
}

// True when `role` has at least the permissions of `minimum`.
export function hasAtLeast(role, minimum) {
  if (!isValidRole(role) || !isValidRole(minimum)) {
    return false;
  }
  return RANK[role] >= RANK[minimum];
}

export function canEdit(role) {
  return hasAtLeast(role, "editor");
}
