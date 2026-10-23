import { createContext, useContext } from "react";
import type { Role, User } from "./roles";

export type Session =
  | { status: "loading" }
  | { status: "signedOut" }
  // "Continue as viewer": no account, read-only.
  | { status: "guest" }
  | { status: "signedIn"; user: User };

export type AuthValue = {
  session: Session;
  // Effective role, or null while loading / signed out.
  role: Role | null;
  signIn: (email: string, password: string) => Promise<void>;
  // Enter the emailed code; signs the new user in.
  verifyEmail: (email: string, code: string) => Promise<void>;
  // Enter the emailed reset code + new password; signs in.
  resetPassword: (
    email: string,
    code: string,
    password: string
  ) => Promise<void>;
  continueAsViewer: () => void;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(
  null
);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
