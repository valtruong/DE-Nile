import { useAuth } from "./auth/AuthContext";
import { canEdit } from "./auth/roles";
import { AppHeader } from "./components/AppHeader";
import { DiagramView } from "./components/DiagramView";
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
      <DiagramView editable={canEdit(role)} />
    </>
  );
}

export default App;
