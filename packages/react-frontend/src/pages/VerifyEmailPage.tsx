import {
  useEffect,
  useRef,
  useState,
  type FormEvent
} from "react";
import { useAuth } from "../auth/AuthContext";
import { AuthError, resendCode } from "../auth/authApi";
import "./SignInPage.css";

type VerifyEmailPageProps = {
  email: string;
  onBack: () => void;
  // True when we arrive from sign-in (no fresh code was sent
  // yet), so we send one right away.
  sendOnOpen?: boolean;
};

export function VerifyEmailPage({
  email,
  onBack,
  sendOnOpen = false
}: VerifyEmailPageProps) {
  const { verifyEmail } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const sentOnOpen = useRef(false);

  async function handleResend(automatic = false) {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      await resendCode(email);
      setNotice(`New code sent to ${email}.`);
    } catch (err) {
      if (
        automatic &&
        err instanceof AuthError &&
        err.code === "RESEND_TOO_SOON"
      ) {
        // A code went out moments ago; just use that one.
        setNotice(`We recently sent a code to ${email}.`);
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't send a code."
      );
    } finally {
      setResending(false);
    }
  }

  useEffect(() => {
    // Guard so StrictMode's double effect doesn't send twice.
    if (sendOnOpen && !sentOnOpen.current) {
      sentOnOpen.current = true;
      void handleResend(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendOnOpen]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      // On success the app switches to the diagram.
      await verifyEmail(email, code);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "That code isn't right."
      );
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="signin">
      <section
        className="signin-card"
        aria-labelledby="verify-title">
        <button
          type="button"
          className="signin-link signin-back"
          onClick={onBack}>
          ← Back to sign in
        </button>
        <h1 id="verify-title" className="signin-title">
          Check your email
        </h1>
        <p className="signin-subtitle">
          Enter the 6-digit code we sent to{" "}
          <strong>{email}</strong>. It expires in 15 minutes.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label className="signin-label" htmlFor="code">
            Verification code
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
            disabled={submitting || code.length !== 6}>
            {submitting ? "Checking…" : "Verify and sign in"}
          </button>
        </form>

        <p className="signin-switch">
          Didn't get it? Check spam, or{" "}
          <button
            type="button"
            className="signin-link"
            disabled={resending}
            onClick={() => void handleResend()}>
            send a new code
          </button>
        </p>
      </section>
    </main>
  );
}
