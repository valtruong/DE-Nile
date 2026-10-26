import { useAuth } from "./auth/AuthContext";
import { canEdit } from "./auth/roles";
import { AppHeader } from "./components/AppHeader";
import { DiagramView } from "./components/DiagramView";
import ViewerDemo from "./ViewerDemo";
import { AuthScreens } from "./pages/AuthScreens";

function App() {
  const { session, role } = useAuth();

  // Checking the session cookie; avoid flashing the sign-in
  // screen at someone who is already signed in.
  if (session.status === "loading") return null;

  if (!role) return <AuthScreens />;

  return (
    <>
      <AppHeader />
      {/* Keep the demo behind the same sign-in gate as the editor. */}
      {new URLSearchParams(window.location.search).has(
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
