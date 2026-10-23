import { useState, type FormEvent } from "react";
import { signUp } from "../auth/authApi";
import { PasswordInput } from "../components/PasswordInput";
import "./SignInPage.css";

type SignUpPageProps = {
  onBack: () => void;
  // Account created; go enter the emailed code.
  onCodeSent: (email: string) => void;
};

export function SignUpPage({
  onBack,
  onCodeSent
}: SignUpPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      await signUp(name.trim(), cleanEmail, password);
      onCodeSent(cleanEmail);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't create the account. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="signin">
      <section
        className="signin-card"
        aria-labelledby="signup-title">
        <button
          type="button"
          className="signin-link signin-back"
          onClick={onBack}>
          ← Back to sign in
        </button>
        <h1 id="signup-title" className="signin-title">
          Create an account
        </h1>
        <p className="signin-subtitle">
          We'll email you a code to confirm it's you.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label className="signin-label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            className="signin-input"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label className="signin-label" htmlFor="email">
            Cal Poly email
          </label>
          <input
            id="email"
            className="signin-input"
            type="email"
            autoComplete="email"
            placeholder="you@calpoly.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="signin-label" htmlFor="password">
            Password
          </label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="signin-hint">At least 8 characters.</p>

          <label className="signin-label" htmlFor="confirm">
            Confirm password
          </label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
            disabled={
              submitting ||
              !name.trim() ||
              !email ||
              !password ||
              !confirm
            }>
            {submitting
              ? "Creating account…"
              : "Create account"}
          </button>
        </form>

        <p className="signin-note">
          New accounts can watch live diagrams. An admin gives
          editor access to people who build diagrams.
        </p>
      </section>
    </main>
  );
}
