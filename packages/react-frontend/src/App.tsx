import { useEffect, useState } from "react";
import { useAuth } from "./auth/AuthContext";
import { isAdmin } from "./auth/roles";
import { AppHeader, type Page } from "./components/AppHeader";
import ViewerDemo from "./ViewerDemo";
import { AuthScreens } from "./pages/AuthScreens";
import { DiagramPage } from "./pages/DiagramPage";
import { ImportPage } from "./pages/ImportPage";
import { LibraryPage } from "./pages/LibraryPage";
import { UsersPage } from "./pages/UsersPage";

// Pages live in the URL hash so refresh and the back button work:
//   #diagrams (or nothing)  diagram library
//   #diagram/<id>           one saved diagram ("new" = starter)
//   #import                 import a P&ID file (editors)
//   #users                  Users & Roles (admins)
type Route =
  | { page: "diagrams" }
  | { page: "import" }
  | { page: "diagram"; id: string }
  | { page: "users" };

function routeFromHash(): Route {
  const hash = (window.location.hash ?? "").slice(1);
  if (hash === "users") return { page: "users" };
  if (hash === "import") return { page: "import" };
  if (hash.startsWith("diagram/")) {
    const id = decodeURIComponent(
      hash.slice("diagram/".length)
    );
    if (id) return { page: "diagram", id };
  }
  return { page: "diagrams" };
}

function go(hash: string) {
  window.location.hash = hash;
}

function App() {
  const { session, role } = useAuth();
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () =>
      window.removeEventListener("hashchange", onHash);
  }, []);

  // Checking the session cookie; avoid flashing the sign-in
  // screen at someone who is already signed in.
  if (session.status === "loading") return null;

  if (!role) return <AuthScreens />;

  // Keep the demo behind the same sign-in gate as the editor.
  if (
    new URLSearchParams(window.location.search).has(
      "viewerDemo"
    )
  ) {
    return (
      <>
        <AppHeader page="diagrams" onNavigate={() => {}} />
        <ViewerDemo />
      </>
    );
  }

  const headerPage: Page =
    route.page === "users" ? "users" : "diagrams";

  return (
    <>
      <AppHeader
        page={headerPage}
        onNavigate={(next) =>
          go(next === "users" ? "users" : "diagrams")
        }
      />
      {/* The server refuses admin calls from anyone else; this
          just keeps non-admins from seeing an empty page. */}
      {route.page === "users" && isAdmin(role) ? (
        <UsersPage />
      ) : route.page === "import" ? (
        <ImportPage
          onCancel={() => go("diagrams")}
          onImported={(id) =>
            go(`diagram/${encodeURIComponent(id)}`)
          }
        />
      ) : route.page === "diagram" ? (
        <DiagramPage
          key={route.id}
          diagramId={route.id}
          onBack={() => go("diagrams")}
        />
      ) : (
        <LibraryPage
          onOpen={(id) =>
            go(`diagram/${encodeURIComponent(id)}`)
          }
          onNew={() => go("diagram/new")}
          onImport={() => go("import")}
        />
      )}
    </>
  );
}

export default App;
