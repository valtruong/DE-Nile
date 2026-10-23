import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { requireRole } from "../src/auth/requireRole.js";
import { canEdit, hasAtLeast } from "../src/auth/roles.js";

const PASSWORD = "correct-horse-battery";
let app;

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "denile-"));
  const usersFile = path.join(dir, "users.json");
  const passwordHash = bcrypt.hashSync(PASSWORD, 4);
  fs.writeFileSync(
    usersFile,
    JSON.stringify([
      {
        id: "u-editor",
        name: "Emilia Vu",
        email: "editor@calpoly.edu",
        role: "editor",
        passwordHash
      },
      {
        id: "u-viewer",
        name: "Club Member",
        email: "viewer@calpoly.edu",
        role: "viewer",
        passwordHash
      }
    ])
  );

  app = createApp({ usersFile, sessionSecret: "test" });

  // Stand-in for a future editor-only route, e.g. saving a
  // diagram.
  app.put(
    "/api/test/editor-only",
    requireRole("editor", app.locals.userStore),
    (req, res) => res.json({ savedBy: req.user.email })
  );
});

describe("roles", () => {
  it("ranks viewer < editor < admin", () => {
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("admin")).toBe(true);
    expect(hasAtLeast("editor", "admin")).toBe(false);
    expect(canEdit("superuser")).toBe(false);
  });
});

describe("POST /api/auth/login", () => {
  it("signs in an editor and returns their role", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: " Editor@CalPoly.edu ",
        password: PASSWORD
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: "u-editor",
      name: "Emilia Vu",
      email: "editor@calpoly.edu",
      role: "editor"
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers["set-cookie"][0]).toMatch(/HttpOnly/);
  });

  it("rejects a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "editor@calpoly.edu", password: "nope" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe(
      "Email or password is incorrect."
    );
  });

  it("gives the same error for an unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "who@calpoly.edu", password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe(
      "Email or password is incorrect."
    );
  });

  it("asks for both fields", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "editor@calpoly.edu" });
    expect(res.status).toBe(400);
  });
});

describe("session", () => {
  it("remembers the user until sign-out", async () => {
    const agent = request.agent(app);
    await agent.get("/api/auth/me").expect(401);

    await agent
      .post("/api/auth/login")
      .send({ email: "editor@calpoly.edu", password: PASSWORD })
      .expect(200);

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.user.role).toBe("editor");

    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/auth/me").expect(401);
  });
});

describe("requireRole('editor')", () => {
  it("blocks people who aren't signed in", async () => {
    await request(app).put("/api/test/editor-only").expect(401);
  });

  it("blocks signed-in viewers", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ email: "viewer@calpoly.edu", password: PASSWORD })
      .expect(200);
    await agent.put("/api/test/editor-only").expect(403);
  });

  it("lets editors through", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ email: "editor@calpoly.edu", password: PASSWORD })
      .expect(200);
    const res = await agent
      .put("/api/test/editor-only")
      .expect(200);
    expect(res.body.savedBy).toBe("editor@calpoly.edu");
  });
});
