import { useEffect, useState } from "react";
import { useAuth } from "./auth/AuthContext";
import { canEdit, isAdmin } from "./auth/roles";
import { AppHeader, type Page } from "./components/AppHeader";
import { DiagramView } from "./components/DiagramView";
import ViewerDemo from "./ViewerDemo";
import { AuthScreens } from "./pages/AuthScreens";
import { UsersPage } from "./pages/UsersPage";

// #users opens the admin page, so a refresh stays on it.
function pageFromHash(): Page {
  return window.location.hash === "#users"
    ? "users"
    : "diagram";
}

function App() {
  const { session, role } = useAuth();
  const [page, setPage] = useState<Page>(pageFromHash);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () =>
      window.removeEventListener("hashchange", onHash);
  }, []);

  function navigate(next: Page) {
    window.location.hash = next === "users" ? "users" : "";
    setPage(next);
  }

  // Checking the session cookie; avoid flashing the sign-in
  // screen at someone who is already signed in.
  if (session.status === "loading") return null;

  if (!role) return <AuthScreens />;

  return (
    <>
      <AppHeader page={page} onNavigate={navigate} />
      {/* The server refuses admin calls from anyone else; this
          just keeps non-admins from seeing an empty page. */}
      {page === "users" && isAdmin(role) ? (
        <UsersPage />
      ) : /* Keep the demo behind the same sign-in gate as the editor. */
      new URLSearchParams(window.location.search).has(
          "viewerDemo"
        ) ? (
        <ViewerDemo />
      ) : (
        <DiagramView editable={canEdit(role)} />
      )}
    </>
  );
}

export default App;
