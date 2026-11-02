import { useAuth } from "../auth/AuthContext";
import { ROLE_BADGE, initials, isAdmin } from "../auth/roles";
import "./AppHeader.css";

export type Page = "diagram" | "users";

export function AppHeader({
  page,
  onNavigate
}: {
  page: Page;
  onNavigate: (page: Page) => void;
}) {
  const { session, role, signOut } = useAuth();
  if (!role) return null;

  const name =
    session.status === "signedIn"
      ? session.user.name
      : "Operator";

  return (
    <header className="app-header">
      <div className="app-header-title">
        <span className="app-header-brand">RiverDash</span>
        <span className="app-header-sep">/</span>
        <span className="app-header-window">
          P&amp;ID window · DE-Nile
        </span>
        {isAdmin(role) && (
          <nav className="app-header-nav" aria-label="Pages">
            <button
              type="button"
              aria-current={
                page === "diagram" ? "page" : undefined
              }
              onClick={() => onNavigate("diagram")}>
              Diagram
            </button>
            <button
              type="button"
              aria-current={
                page === "users" ? "page" : undefined
              }
              onClick={() => onNavigate("users")}>
              Users &amp; Roles
            </button>
          </nav>
        )}
      </div>
      <div className="app-header-right">
        <span
          className={`role-badge role-badge-${role}`}
          data-testid="role-badge">
          {ROLE_BADGE[role]}
        </span>
        <span className="avatar" title={name}>
          {session.status === "signedIn"
            ? initials(name)
            : "OP"}
        </span>
        <button
          type="button"
          className="app-header-signout"
          onClick={() => void signOut()}>
          {session.status === "signedIn"
            ? "Sign out"
            : "Sign in"}
        </button>
      </div>
    </header>
  );
}
