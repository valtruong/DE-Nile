import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import { useAuth } from "../auth/AuthContext";
import * as admin from "../auth/adminApi";
import type { AdminUser, Invite } from "../auth/adminApi";
import { AuthError } from "../auth/authApi";
import {
  ROLES,
  ROLE_INFO,
  initials,
  type Role
} from "../auth/roles";
import "./UsersPage.css";

// Storyboard: admin "Users & roles" screen. Admins see every
// account, change roles and invite people. The server checks
// the admin role on every request; this page is just the UI.

type Dialog =
  | { kind: "none" }
  | { kind: "changeRole"; user: AdminUser }
  | { kind: "onlyAdmin" }
  | { kind: "invite" };

// "an operator", "an editor", "an admin"
function aRole(role: Role): string {
  const word = ROLE_INFO[role].label.toLowerCase();
  return `${/^[aeiou]/.test(word) ? "an" : "a"} ${word}`;
}

function errorText(err: unknown): string {
  return err instanceof Error
    ? err.message
    : "Something went wrong. Try again.";
}

export function UsersPage() {
  const { session, refreshUser } = useAuth();
  const me =
    session.status === "signedIn" ? session.user : null;

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadError, setLoadError] = useState<string | null>(
    null
  );
  const [dialog, setDialog] = useState<Dialog>({
    kind: "none"
  });
  const [notice, setNotice] = useState<string | null>(null);

  // Retry button: fetch again and show the result.
  const load = useCallback(
    () =>
      Promise.all([
        admin.listUsers(),
        admin.listInvites()
      ]).then(
        ([u, i]) => {
          setUsers(u);
          setInvites(i);
          setLoadError(null);
        },
        (err) => setLoadError(errorText(err))
      ),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const adminCount =
    users?.filter((u) => u.role === "admin").length ?? 0;

  function openChangeRole(user: AdminUser) {
    setNotice(null);
    if (
      user.id === me?.id &&
      user.role === "admin" &&
      adminCount === 1
    ) {
      setDialog({ kind: "onlyAdmin" });
    } else {
      setDialog({ kind: "changeRole", user });
    }
  }

  async function handleRoleChanged(updated: AdminUser) {
    setDialog({ kind: "none" });
    setUsers(
      (list) =>
        list?.map((u) => (u.id === updated.id ? updated : u)) ??
        null
    );
    setNotice(`${updated.name} is now ${aRole(updated.role)}.`);
    // Changing your own role changes what you can see.
    if (updated.id === me?.id) await refreshUser();
  }

  async function handleRevoke(email: string) {
    setNotice(null);
    try {
      await admin.revokeInvite(email);
      setInvites((list) =>
        list.filter((i) => i.email !== email)
      );
      setNotice(`Invite for ${email} revoked.`);
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  return (
    <main className="users">
      <div className="users-head">
        <div>
          <h1 className="users-title">Users &amp; roles</h1>
          <p className="users-subtitle">
            Who can watch, edit and manage DE-Nile.
          </p>
        </div>
        <button
          type="button"
          className="users-primary"
          onClick={() => {
            setNotice(null);
            setDialog({ kind: "invite" });
          }}>
          + Invite member
        </button>
      </div>

      {notice && (
        <p className="users-notice" role="status">
          {notice}
        </p>
      )}

      <div className="users-layout">
        <section className="users-card" aria-label="Members">
          {loadError ? (
            <div className="users-empty">
              <p>{loadError}</p>
              <button
                type="button"
                className="users-secondary"
                onClick={() => void load()}>
                Try again
              </button>
            </div>
          ) : !users ? (
            <p className="users-empty">Loading members…</p>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="users-person">
                        <span
                          className="users-avatar"
                          aria-hidden>
                          {initials(user.name)}
                        </span>
                        <div>
                          <div className="users-name">
                            {user.name}
                            {user.id === me?.id && (
                              <span className="users-you">
                                {" "}
                                (you)
                              </span>
                            )}
                          </div>
                          <div className="users-email">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`users-role users-role-${user.role}`}>
                        {ROLE_INFO[user.role].label}
                      </span>
                    </td>
                    <td>
                      {user.emailVerified ? (
                        <span className="users-status">
                          Active
                        </span>
                      ) : (
                        <span className="users-status users-status-pending">
                          Email not verified
                        </span>
                      )}
                    </td>
                    <td className="users-actions">
                      <button
                        type="button"
                        className="users-link"
                        aria-label={`Change role for ${user.name}`}
                        onClick={() => openChangeRole(user)}>
                        Change role
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {invites.length > 0 && (
            <div className="users-invites">
              <h2 className="users-h2">Pending invites</h2>
              <ul>
                {invites.map((inv) => (
                  <li key={inv.email}>
                    <div>
                      <div className="users-name">
                        {inv.email}
                      </div>
                      <div className="users-email">
                        Invited as{" "}
                        {ROLE_INFO[
                          inv.role
                        ].label.toLowerCase()}{" "}
                        by {inv.invitedByName}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="users-link users-link-danger"
                      aria-label={`Revoke invite for ${inv.email}`}
                      onClick={() =>
                        void handleRevoke(inv.email)
                      }>
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="users-card users-aside">
          <h2 className="users-h2">What each role can do</h2>
          <dl>
            {ROLES.map((role) => (
              <div key={role} className="users-aside-row">
                <dt>
                  <span
                    className={`users-role users-role-${role}`}>
                    {ROLE_INFO[role].label}
                  </span>
                </dt>
                <dd>{ROLE_INFO[role].summary}</dd>
              </div>
            ))}
          </dl>
          <p className="users-aside-note">
            New accounts start as operators unless you invite
            them with another role.
          </p>
        </aside>
      </div>

      {dialog.kind === "changeRole" && (
        <ChangeRoleDialog
          user={dialog.user}
          isMe={dialog.user.id === me?.id}
          onClose={() => setDialog({ kind: "none" })}
          onChanged={handleRoleChanged}
          onOnlyAdmin={() => setDialog({ kind: "onlyAdmin" })}
        />
      )}
      {dialog.kind === "onlyAdmin" && (
        <OnlyAdminDialog
          onClose={() => setDialog({ kind: "none" })}
          onPromote={() => {
            setDialog({ kind: "none" });
            setNotice(
              "Choose “Change role” next to someone and make them an admin. Then you can change your own role."
            );
          }}
        />
      )}
      {dialog.kind === "invite" && (
        <InviteDialog
          onClose={() => setDialog({ kind: "none" })}
          onInvited={(inv, warning) => {
            setDialog({ kind: "none" });
            setInvites((list) => [
              inv,
              ...list.filter((i) => i.email !== inv.email)
            ]);
            setNotice(
              warning ??
                `Invite sent to ${inv.email}. They'll be ${aRole(inv.role)} once they verify their email.`
            );
          }}
        />
      )}
    </main>
  );
}

// ---------- Dialogs ----------

function Modal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Parents pass a new function each render; keep the latest
  // without re-running the focus effect below.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Focus the first control on open, Escape closes, and focus
  // goes back to the button that opened it.
  useEffect(() => {
    const previous =
      document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>(
        "input:checked, input, button.users-primary, button"
      )
      ?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}>
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title">
        <h2 id="modal-title" className="modal-title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function ChangeRoleDialog({
  user,
  isMe,
  onClose,
  onChanged,
  onOnlyAdmin
}: {
  user: AdminUser;
  isMe: boolean;
  onClose: () => void;
  onChanged: (user: AdminUser) => void;
  onOnlyAdmin: () => void;
}) {
  const [role, setRole] = useState<Role>(user.role);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (role === user.role) return onClose();
    setError(null);
    setSaving(true);
    try {
      onChanged(await admin.changeRole(user.id, role));
    } catch (err) {
      if (
        err instanceof AuthError &&
        err.code === "LAST_ADMIN"
      ) {
        onOnlyAdmin();
        return;
      }
      setError(errorText(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Change role for ${isMe ? "yourself" : user.name}`}
      onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <fieldset className="modal-roles">
          <legend className="visually-hidden">Role</legend>
          {ROLES.map((r) => (
            <label
              key={r}
              className={`modal-role ${
                role === r ? "modal-role-selected" : ""
              }`}>
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
              />
              <span>
                <span className="modal-role-name">
                  {ROLE_INFO[r].label}
                  {user.role === r && (
                    <span className="modal-current">
                      current
                    </span>
                  )}
                </span>
                <span className="modal-role-summary">
                  {ROLE_INFO[r].summary}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="modal-note">
          {isMe
            ? "This changes what you can do right away."
            : `Takes effect next time ${
                user.name.split(" ")[0]
              } loads a page.`}
        </p>
        {error && (
          <p className="modal-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-buttons">
          <button
            type="button"
            className="users-secondary"
            onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="users-primary"
            disabled={saving || role === user.role}>
            {saving
              ? "Saving…"
              : role === user.role
                ? "No change"
                : `Make ${ROLE_INFO[role].label.toLowerCase()}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function OnlyAdminDialog({
  onClose,
  onPromote
}: {
  onClose: () => void;
  onPromote: () => void;
}) {
  return (
    <Modal title="You're the only admin" onClose={onClose}>
      <p className="modal-text">
        If you stop being an admin, nobody will be able to
        manage people or roles. Make someone else an admin
        first.
      </p>
      <div className="modal-buttons">
        <button
          type="button"
          className="users-secondary"
          onClick={onClose}>
          Keep my role
        </button>
        <button
          type="button"
          className="users-primary"
          onClick={onPromote}>
          Promote someone
        </button>
      </div>
    </Modal>
  );
}

function InviteDialog({
  onClose,
  onInvited
}: {
  onClose: () => void;
  onInvited: (invite: Invite, warning?: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);
    try {
      onInvited(await admin.invite(email, role));
    } catch (err) {
      // Saved, but the email bounced: still list it.
      if (
        err instanceof AuthError &&
        err.code === "EMAIL_FAILED"
      ) {
        onInvited(
          {
            email: email.trim().toLowerCase(),
            role,
            invitedByName: "you",
            createdAt: Date.now()
          },
          err.message
        );
        return;
      }
      setSending(false);
      setError(errorText(err));
    }
  }

  return (
    <Modal title="Invite a member" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className="modal-label" htmlFor="invite-email">
          Cal Poly email
        </label>
        <input
          id="invite-email"
          className="modal-input"
          type="email"
          autoComplete="off"
          placeholder="name@calpoly.edu"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="modal-label" htmlFor="invite-role">
          Role
        </label>
        <select
          id="invite-role"
          className="modal-input"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_INFO[r].label}
            </option>
          ))}
        </select>
        <p className="modal-note">
          We'll email them a link. When they create an account
          with this address and verify it, they get this role.
        </p>
        {error && (
          <p className="modal-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-buttons">
          <button
            type="button"
            className="users-secondary"
            onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="users-primary"
            disabled={sending}>
            {sending ? "Sending…" : "Send invite"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
