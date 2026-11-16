import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  useAuth,
  type AuthValue
} from "../src/auth/AuthContext";
import App from "../src/App";

vi.mock("../src/auth/AuthContext", () => ({
  useAuth: vi.fn()
}));
vi.mock("../src/pages/AuthScreens", () => ({
  AuthScreens: () => <div>Sign-in screen</div>
}));
vi.mock("../src/components/AppHeader", () => ({
  AppHeader: () => <header>Account header</header>
}));
vi.mock("../src/components/DiagramView", () => ({
  DiagramView: ({ editable }: { editable: boolean }) => (
    <div>
      {editable ? "Editable diagram" : "Read-only diagram"}
    </div>
  )
}));
vi.mock("../src/pages/LibraryPage", () => ({
  LibraryPage: () => <div>Diagram library</div>
}));
vi.mock("../src/pages/DiagramPage", () => ({
  DiagramPage: ({ diagramId }: { diagramId: string }) => (
    <div>Diagram {diagramId}</div>
  )
}));
vi.mock("../src/pages/UsersPage", () => ({
  UsersPage: () => <div>Users page</div>
}));
vi.mock("../src/ViewerDemo", () => ({
  default: () => <div>Telemetry demo</div>
}));

function setSession(
  session: AuthValue["session"],
  role: AuthValue["role"],
  search = "",
  hash = ""
) {
  vi.stubGlobal("window", { location: { search, hash } });
  vi.mocked(useAuth).mockReturnValue({
    session,
    role,
    signIn: vi.fn(),
    verifyEmail: vi.fn(),
    resetPassword: vi.fn(),
    continueAsViewer: vi.fn(),
    signOut: vi.fn()
  });
}
afterEach(() => vi.unstubAllGlobals());

it("keeps the sign-in screen when a signed-out user requests the demo", () => {
  setSession({ status: "signedOut" }, null, "?viewerDemo=1");
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain("Sign-in screen");
  expect(html).not.toContain("Telemetry demo");
});
it("waits for the session check before rendering the demo", () => {
  setSession({ status: "loading" }, null, "?viewerDemo=1");
  expect(renderToStaticMarkup(<App />)).toBe("");
});
it("opens on the diagram library for guests", () => {
  setSession({ status: "guest" }, "viewer");
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain("Diagram library");
  expect(html).toContain("Account header");
});
it("opens a saved diagram from its address", () => {
  setSession(
    { status: "guest" },
    "viewer",
    "",
    "#diagram/abc-123"
  );
  expect(renderToStaticMarkup(<App />)).toContain(
    "Diagram abc-123"
  );
});
it("only shows Users & Roles to admins", () => {
  setSession({ status: "guest" }, "viewer", "", "#users");
  const html = renderToStaticMarkup(<App />);
  expect(html).not.toContain("Users page");
  expect(html).toContain("Diagram library");
});
it("routes editors to the library too", () => {
  setSession(
    {
      status: "signedIn",
      user: {
        id: "test",
        name: "Test",
        email: "test@example.com",
        role: "editor"
      }
    },
    "editor"
  );
  expect(renderToStaticMarkup(<App />)).toContain(
    "Diagram library"
  );
});
it("lets an existing viewer use the read-only telemetry demo", () => {
  setSession({ status: "guest" }, "viewer", "?viewerDemo=1");
  expect(renderToStaticMarkup(<App />)).toContain(
    "Telemetry demo"
  );
});
