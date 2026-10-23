import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { AuthError } from "../auth/authApi";
import { PasswordInput } from "../components/PasswordInput";
import "./SignInPage.css";

// Storyboard screen 1: editors/admins sign in, operators
// continue as a read-only viewer.
type SignInPageProps = {
  onCreateAccount: () => void;
  onForgotPassword: (email: string) => void;
  // Right password, but the email was never verified.
  onNeedsVerification: (email: string) => void;
};

export function SignInPage({
  onCreateAccount,
  onForgotPassword,
  onNeedsVerification
}: SignInPageProps) {
  const { signIn, continueAsViewer } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      if (
        err instanceof AuthError &&
        err.code === "EMAIL_NOT_VERIFIED"
      ) {
        onNeedsVerification(email.trim().toLowerCase());
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Sign-in failed. Try again."
      );
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="signin">
      <section
        className="signin-card"
        aria-labelledby="signin-title">
        <h1 id="signin-title" className="signin-title">
          DE-Nile
        </h1>
        <p className="signin-subtitle">
          P&amp;ID viewer and editor for NILE test stands
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label className="signin-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="signin-input"
            type="email"
            autoComplete="username"
            placeholder="you@calpoly.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="signin-label-row">
            <label className="signin-label" htmlFor="password">
              Password
            </label>
            <button
              type="button"
              className="signin-link signin-small"
              onClick={() =>
                onForgotPassword(email.trim().toLowerCase())
              }>
              Forgot password?
            </button>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="signin-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="signin-primary"
            disabled={submitting || !email || !password}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="signin-switch">
          New to DE-Nile?{" "}
          <button
            type="button"
            className="signin-link"
            onClick={onCreateAccount}>
            Create an account
          </button>
        </p>

        <div className="signin-divider" aria-hidden="true">
          <span>or</span>
        </div>

        <button
          type="button"
          className="signin-secondary"
          onClick={continueAsViewer}>
          Continue as viewer (read-only)
        </button>

        <p className="signin-note">
          Viewers can watch live data but can't move, delete or
          reconnect anything. DE-Nile never sends commands to
          the test stand.
        </p>
      </section>
    </main>
  );
}
