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
vi.mock("../src/ViewerDemo", () => ({
  default: () => <div>Telemetry demo</div>
}));

function setSession(
  session: AuthValue["session"],
  role: AuthValue["role"],
  search = ""
) {
  vi.stubGlobal("window", { location: { search } });
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
it("preserves the team's guest view-only diagram", () => {
  setSession({ status: "guest" }, "viewer");
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain("Read-only diagram");
  expect(html).toContain("Account header");
});
it("preserves editor permissions on the default diagram", () => {
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
    "Editable diagram"
  );
});
it("lets an existing viewer use the read-only telemetry demo", () => {
  setSession({ status: "guest" }, "viewer", "?viewerDemo=1");
  expect(renderToStaticMarkup(<App />)).toContain(
    "Telemetry demo"
  );
});
