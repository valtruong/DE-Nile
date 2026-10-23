import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { forgotPassword } from "../auth/authApi";
import { PasswordInput } from "../components/PasswordInput";
import "./SignInPage.css";

type ForgotPasswordPageProps = {
  initialEmail: string;
  onBack: () => void;
};

// Step 1: enter your email, we send a code.
// Step 2: enter the code and a new password; you're signed in.
export function ForgotPasswordPage({
  initialEmail,
  onBack
}: ForgotPasswordPageProps) {
  const { resetPassword } = useAuth();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setStep("reset");
      setNotice(
        `If ${email.trim()} has a DE-Nile account, a code is on its way.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't send a code. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      // On success the app switches to the diagram.
      await resetPassword(
        email.trim().toLowerCase(),
        code,
        password
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't reset your password."
      );
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="signin">
      <section
        className="signin-card"
        aria-labelledby="forgot-title">
        <button
          type="button"
          className="signin-link signin-back"
          onClick={onBack}>
          ← Back to sign in
        </button>
        <h1 id="forgot-title" className="signin-title">
          Reset password
        </h1>

        {step === "email" ? (
          <>
            <p className="signin-subtitle">
              Enter your email and we'll send you a code to set
              a new password.
            </p>
            <form onSubmit={sendCode} noValidate>
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
                autoFocus
              />
              {error && (
                <p className="signin-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="signin-primary"
                disabled={busy || !email.trim()}>
                {busy ? "Sending…" : "Send reset code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="signin-subtitle">
              Enter the 6-digit code we emailed to{" "}
              <strong>{email.trim()}</strong> and choose a new
              password.
            </p>
            <form onSubmit={handleReset} noValidate>
              <label className="signin-label" htmlFor="code">
                Reset code
              </label>
              <input
                id="code"
                className="signin-input signin-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, ""))
                }
                autoFocus
              />

              <label
                className="signin-label"
                htmlFor="new-password">
                New password
              </label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="signin-hint">
                At least 8 characters.
              </p>

              <label
                className="signin-label"
                htmlFor="confirm-password">
                Confirm new password
              </label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />

              {notice && (
                <p className="signin-success" role="status">
                  {notice}
                </p>
              )}
              {error && (
                <p className="signin-error" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="signin-primary"
                disabled={
                  busy ||
                  code.length !== 6 ||
                  !password ||
                  !confirm
                }>
                {busy
                  ? "Saving…"
                  : "Set new password and sign in"}
              </button>
            </form>

            <p className="signin-switch">
              Didn't get it? Check spam, or{" "}
              <button
                type="button"
                className="signin-link"
                disabled={busy}
                onClick={() => void sendCode()}>
                send a new code
              </button>
            </p>
          </>
        )}

        <p className="signin-note">
          Resetting your password signs you out on every other
          device.
        </p>
      </section>
    </main>
  );
}
