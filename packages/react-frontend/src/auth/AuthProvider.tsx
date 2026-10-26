import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import * as api from "./authApi";
import {
  AuthContext,
  type AuthValue,
  type Session
} from "./AuthContext";

export function AuthProvider({
  children
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session>({
    status: "loading"
  });

  // On load, ask the server whether a session cookie is
  // still valid so a refresh doesn't sign the editor out.
  useEffect(() => {
    let cancelled = false;
    api
      .fetchCurrentUser()
      .then((user) => {
        if (cancelled) return;
        setSession(
          user
            ? { status: "signedIn", user }
            : { status: "signedOut" }
        );
      })
      .catch(() => {
        if (!cancelled) setSession({ status: "signedOut" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const user = await api.signIn(email, password);
      setSession({ status: "signedIn", user });
    },
    []
  );

  const verifyEmail = useCallback(
    async (email: string, code: string) => {
      const user = await api.verifyEmail(email, code);
      setSession({ status: "signedIn", user });
    },
    []
  );

  const resetPassword = useCallback(
    async (email: string, code: string, password: string) => {
      const user = await api.resetPassword(
        email,
        code,
        password
      );
      setSession({ status: "signedIn", user });
    },
    []
  );

  const continueAsViewer = useCallback(() => {
    setSession({ status: "guest" });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } finally {
      setSession({ status: "signedOut" });
    }
  }, []);

  const value = useMemo<AuthValue>(() => {
    let role: AuthValue["role"] = null;
    if (session.status === "guest") role = "viewer";
    if (session.status === "signedIn") role = session.user.role;
    return {
      session,
      role,
      signIn,
      verifyEmail,
      resetPassword,
      continueAsViewer,
      signOut
    };
  }, [
    session,
    signIn,
    verifyEmail,
    resetPassword,
    continueAsViewer,
    signOut
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
