import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const PASSWORD = "static-fire-test";
let app;
let usersFile;
let sent;

function seed(users) {
  const passwordHash = bcrypt.hashSync(PASSWORD, 4);
  fs.writeFileSync(
    usersFile,
    JSON.stringify(users.map((u) => ({ passwordHash, ...u })))
  );
}

async function signedIn(email) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

function lastCode() {
  return sent.at(-1).text.match(/\b(\d{6})\b/)[1];
}

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "denile-"));
  usersFile = path.join(dir, "users.json");
  sent = [];
  seed([
    {
      id: "u-admin",
      name: "Stella Daoud",
      email: "admin@calpoly.edu",
      role: "admin"
    },
    {
      id: "u-editor",
      name: "Emilia Vu",
      email: "editor@calpoly.edu",
      role: "editor"
    },
    {
      id: "u-viewer",
      name: "Valerie Ng",
      email: "viewer@calpoly.edu",
      role: "viewer"
    }
  ]);
  app = createApp({
    usersFile,
    sessionSecret: "test",
    allowedDomains: ["calpoly.edu"],
    appUrl: "http://denile.test",
    mailer: { send: async (mail) => sent.push(mail) }
  });
});

describe("admin routes are admin-only", () => {
  it("answers 401 when signed out", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
  });

  it("answers 403 for editors and viewers", async () => {
    for (const email of [
      "editor@calpoly.edu",
      "viewer@calpoly.edu"
    ]) {
      const agent = await signedIn(email);
      expect((await agent.get("/api/admin/users")).status).toBe(
        403
      );
      expect(
        (
          await agent
            .patch("/api/admin/users/u-viewer")
            .send({ role: "admin" })
        ).status
      ).toBe(403);
      expect(
        (
          await agent
            .post("/api/admin/invites")
            .send({ email: "x@calpoly.edu", role: "admin" })
        ).status
      ).toBe(403);
    }
  });
});

describe("GET /api/admin/users", () => {
  it("lists everyone without password hashes", async () => {
    const agent = await signedIn("admin@calpoly.edu");
    const res = await agent.get("/api/admin/users");
    expect(res.status).toBe(200);
    expect(res.body.users.map((u) => u.name)).toEqual([
      "Emilia Vu",
      "Stella Daoud",
      "Valerie Ng"
    ]);
    expect(res.body.users[0]).toEqual({
      id: "u-editor",
      name: "Emilia Vu",
      email: "editor@calpoly.edu",
      role: "editor",
      emailVerified: true
    });
    expect(JSON.stringify(res.body)).not.toContain(
      "passwordHash"
    );
  });
});

describe("PATCH /api/admin/users/:id", () => {
  it("changes a role, effective on their next request", async () => {
    const viewer = await signedIn("viewer@calpoly.edu");
    const admin = await signedIn("admin@calpoly.edu");

    const res = await admin
      .patch("/api/admin/users/u-viewer")
      .send({ role: "editor" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("editor");

    const me = await viewer.get("/api/auth/me");
    expect(me.body.user.role).toBe("editor");
  });

  it("rejects unknown roles and accounts", async () => {
    const admin = await signedIn("admin@calpoly.edu");
    expect(
      (
        await admin
          .patch("/api/admin/users/u-viewer")
          .send({ role: "owner" })
      ).status
    ).toBe(400);
    expect(
      (
        await admin
          .patch("/api/admin/users/nope")
          .send({ role: "editor" })
      ).status
    ).toBe(404);
  });

  it("won't demote the only admin", async () => {
    const admin = await signedIn("admin@calpoly.edu");
    const res = await admin
      .patch("/api/admin/users/u-admin")
      .send({ role: "editor" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("LAST_ADMIN");
  });

  it("lets an admin step down once there's another", async () => {
    const admin = await signedIn("admin@calpoly.edu");
    await admin
      .patch("/api/admin/users/u-editor")
      .send({ role: "admin" });
    const res = await admin
      .patch("/api/admin/users/u-admin")
      .send({ role: "editor" });
    expect(res.status).toBe(200);
    // Their own admin access ends right away.
    expect((await admin.get("/api/admin/users")).status).toBe(
      403
    );
  });
});

describe("invites", () => {
  it("emails an invite and applies the role on verify", async () => {
    const admin = await signedIn("admin@calpoly.edu");
    const res = await admin.post("/api/admin/invites").send({
      email: "  NewPerson@CalPoly.edu ",
      role: "editor"
    });
    expect(res.status).toBe(201);
    expect(res.body.invite).toMatchObject({
      email: "newperson@calpoly.edu",
      role: "editor",
      invitedByName: "Stella Daoud"
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("newperson@calpoly.edu");
    expect(sent[0].subject).toContain("Stella Daoud");
    expect(sent[0].text).toContain("http://denile.test");

    const list = await admin.get("/api/admin/invites");
    expect(list.body.invites).toHaveLength(1);

    // They sign up as usual...
    const newcomer = request.agent(app);
    await newcomer.post("/api/auth/signup").send({
      name: "New Person",
      email: "newperson@calpoly.edu",
      password: PASSWORD
    });
    // ...and come out of verification an editor.
    const verified = await newcomer
      .post("/api/auth/verify")
      .send({
        email: "newperson@calpoly.edu",
        code: lastCode()
      });
    expect(verified.status).toBe(200);
    expect(verified.body.user.role).toBe("editor");

    // The invite is used up.
    const after = await admin.get("/api/admin/invites");
    expect(after.body.invites).toEqual([]);
  });

  it("applies the role when they verify via password reset", async () => {
    const admin = await signedIn("admin@calpoly.edu");
    await request(app).post("/api/auth/signup").send({
      name: "Late Verifier",
      email: "late@calpoly.edu",
      password: PASSWORD
    });
    await admin
      .post("/api/admin/invites")
      .send({ email: "late@calpoly.edu", role: "admin" });

    await request(app)
      .post("/api/auth/forgot")
      .send({ email: "late@calpoly.edu" });
    const res = await request(app)
      .post("/api/auth/reset")
      .send({
        email: "late@calpoly.edu",
        code: lastCode(),
        password: "a-brand-new-password"
      });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("admin");
  });

  it("re-inviting updates the role instead of duplicating", async () => {
    const admin = await signedIn("admin@calpoly.edu");
    await admin
      .post("/api/admin/invites")
      .send({ email: "a@calpoly.edu", role: "viewer" });
    await admin
      .post("/api/admin/invites")
      .send({ email: "a@calpoly.edu", role: "admin" });
    const list = await admin.get("/api/admin/invites");
    expect(list.body.invites).toHaveLength(1);
    expect(list.body.invites[0].role).toBe("admin");
  });

  it("refuses existing members, other domains and bad input", async () => {
    const admin = await signedIn("admin@calpoly.edu");
    const member = await admin
      .post("/api/admin/invites")
      .send({ email: "editor@calpoly.edu", role: "admin" });
    expect(member.status).toBe(409);
    expect(member.body.code).toBe("ALREADY_MEMBER");

    for (const body of [
      { email: "someone@gmail.com", role: "editor" },
      { email: "not-an-email", role: "editor" },
      { email: "ok@calpoly.edu", role: "owner" }
    ]) {
      const res = await admin
        .post("/api/admin/invites")
        .send(body);
      expect(res.status).toBe(400);
    }
    expect(sent).toHaveLength(0);
  });

  it("revokes an invite so sign-up stays a viewer", async () => {
    const admin = await signedIn("admin@calpoly.edu");
    await admin
      .post("/api/admin/invites")
      .send({ email: "gone@calpoly.edu", role: "admin" });
    const del = await admin.delete(
      "/api/admin/invites/gone@calpoly.edu"
    );
    expect(del.status).toBe(204);
    expect(
      (
        await admin.delete(
          "/api/admin/invites/gone@calpoly.edu"
        )
      ).status
    ).toBe(404);

    const newcomer = request.agent(app);
    await newcomer.post("/api/auth/signup").send({
      name: "Gone",
      email: "gone@calpoly.edu",
      password: PASSWORD
    });
    const res = await newcomer
      .post("/api/auth/verify")
      .send({ email: "gone@calpoly.edu", code: lastCode() });
    expect(res.body.user.role).toBe("viewer");
  });

  it("keeps the invite if the email fails to send", async () => {
    app = createApp({
      usersFile,
      sessionSecret: "test",
      allowedDomains: ["calpoly.edu"],
      mailer: {
        send: async () => {
          throw new Error("smtp down");
        }
      }
    });
    const admin = await signedIn("admin@calpoly.edu");
    const res = await admin
      .post("/api/admin/invites")
      .send({ email: "b@calpoly.edu", role: "editor" });
    expect(res.status).toBe(502);
    const list = await admin.get("/api/admin/invites");
    expect(list.body.invites).toHaveLength(1);
  });
});
