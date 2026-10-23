import { useState } from "react";
import { SignInPage } from "./SignInPage";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { SignUpPage } from "./SignUpPage";
import { VerifyEmailPage } from "./VerifyEmailPage";

type Screen =
  | { name: "signIn" }
  | { name: "signUp" }
  | { name: "forgot"; email: string }
  | { name: "verify"; email: string; sendOnOpen: boolean };

// Everything shown before someone is signed in:
// sign in ↔ create account → check your email,
// and sign in → forgot password → reset.
export function AuthScreens() {
  const [screen, setScreen] = useState<Screen>({
    name: "signIn"
  });
  const backToSignIn = () => setScreen({ name: "signIn" });

  if (screen.name === "signUp") {
    return (
      <SignUpPage
        onBack={backToSignIn}
        onCodeSent={(email) =>
          setScreen({
            name: "verify",
            email,
            sendOnOpen: false
          })
        }
      />
    );
  }

  if (screen.name === "forgot") {
    return (
      <ForgotPasswordPage
        initialEmail={screen.email}
        onBack={backToSignIn}
      />
    );
  }

  if (screen.name === "verify") {
    return (
      <VerifyEmailPage
        email={screen.email}
        sendOnOpen={screen.sendOnOpen}
        onBack={backToSignIn}
      />
    );
  }

  return (
    <SignInPage
      onCreateAccount={() => setScreen({ name: "signUp" })}
      onForgotPassword={(email) =>
        setScreen({ name: "forgot", email })
      }
      onNeedsVerification={(email) =>
        setScreen({ name: "verify", email, sendOnOpen: true })
      }
    />
  );
}
