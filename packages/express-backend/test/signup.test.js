import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { requireRole } from "../src/auth/requireRole.js";

const PASSWORD = "launch-pad-39a";
let app;
let usersFile;
let sent; // emails the fake mailer "sent"

function lastCode() {
  const match = sent.at(-1).text.match(/\b(\d{6})\b/);
  return match[1];
}

function signUp(agent, overrides = {}) {
  return agent.post("/api/auth/signup").send({
    name: "Rafael Ortiz",
    email: "rortiz@calpoly.edu",
    password: PASSWORD,
    ...overrides
  });
}

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "denile-"));
  usersFile = path.join(dir, "users.json");
  sent = [];
  app = createApp({
    usersFile,
    sessionSecret: "test",
    allowedDomains: ["calpoly.edu"],
    mailer: { send: async (mail) => sent.push(mail) }
  });
  app.put(
    "/api/test/editor-only",
    requireRole("editor", app.locals.userStore),
    (req, res) => res.json({ ok: true })
  );
});

describe("sign up + verify email", () => {
  it("creates an unverified viewer and emails a code", async () => {
    const res = await signUp(request(app));
    expect(res.status).toBe(201);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("rortiz@calpoly.edu");

    const [user] = JSON.parse(
      fs.readFileSync(usersFile, "utf8")
    );
    expect(user.role).toBe("viewer");
    expect(user.emailVerified).toBe(false);
    // Only a hash of the code is stored.
    expect(JSON.stringify(user)).not.toContain(lastCode());
  });

  it("blocks sign-in until the email is verified", async () => {
    await signUp(request(app));
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "rortiz@calpoly.edu",
        password: PASSWORD
      });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("signs the user in once the right code is entered", async () => {
    const agent = request.agent(app);
    await signUp(agent);

    const wrong = await agent
      .post("/api/auth/verify")
      .send({ email: "rortiz@calpoly.edu", code: "000000" });
    // (1-in-a-million chance the real code is 000000)
    if (lastCode() !== "000000") {
      expect(wrong.status).toBe(400);
      expect(wrong.body.error).toMatch(/4 tries left/);
    }

    const ok = await agent
      .post("/api/auth/verify")
      .send({ email: "rortiz@calpoly.edu", code: lastCode() });
    expect(ok.status).toBe(200);
    expect(ok.body.user.role).toBe("viewer");

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.user.email).toBe("rortiz@calpoly.edu");

    // Signed-up viewers still can't edit.
    await agent.put("/api/test/editor-only").expect(403);

    // And normal sign-in works from now on.
    await request(app)
      .post("/api/auth/login")
      .send({ email: "rortiz@calpoly.edu", password: PASSWORD })
      .expect(200);
  });

  it("locks the code after 5 wrong tries", async () => {
    await signUp(request(app));
    const bad = lastCode() === "111111" ? "222222" : "111111";
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/auth/verify")
        .send({ email: "rortiz@calpoly.edu", code: bad });
    }
    const res = await request(app)
      .post("/api/auth/verify")
      .send({ email: "rortiz@calpoly.edu", code: lastCode() });
    expect(res.status).toBe(429);
  });

  it("rejects expired codes", async () => {
    await signUp(request(app));
    const users = JSON.parse(
      fs.readFileSync(usersFile, "utf8")
    );
    users[0].verification.expiresAt = Date.now() - 1;
    fs.writeFileSync(usersFile, JSON.stringify(users));

    const res = await request(app)
      .post("/api/auth/verify")
      .send({ email: "rortiz@calpoly.edu", code: lastCode() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/);
  });

  it("makes you wait a minute between codes", async () => {
    await signUp(request(app));
    const res = await request(app)
      .post("/api/auth/resend")
      .send({ email: "rortiz@calpoly.edu" });
    expect(res.status).toBe(429);
    expect(sent).toHaveLength(1);

    const users = JSON.parse(
      fs.readFileSync(usersFile, "utf8")
    );
    users[0].verification.sentAt = Date.now() - 61_000;
    fs.writeFileSync(usersFile, JSON.stringify(users));

    await request(app)
      .post("/api/auth/resend")
      .send({ email: "rortiz@calpoly.edu" })
      .expect(204);
    expect(sent).toHaveLength(2);
  });

  it("doesn't reveal unknown emails on resend", async () => {
    await request(app)
      .post("/api/auth/resend")
      .send({ email: "nobody@calpoly.edu" })
      .expect(204);
    expect(sent).toHaveLength(0);
  });
});

describe("sign-up rules", () => {
  it("only allows @calpoly.edu emails", async () => {
    const res = await signUp(request(app), {
      email: "someone@gmail.com"
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/@calpoly\.edu/);
  });

  it("needs a name and an 8+ character password", async () => {
    await signUp(request(app), { name: " " }).expect(400);
    await signUp(request(app), { password: "short" }).expect(
      400
    );
    expect(sent).toHaveLength(0);
  });

  it("refuses a second account for a verified email", async () => {
    const agent = request.agent(app);
    await signUp(agent);
    await agent
      .post("/api/auth/verify")
      .send({ email: "rortiz@calpoly.edu", code: lastCode() })
      .expect(200);

    const res = await signUp(request(app));
    expect(res.status).toBe(409);
  });

  it("can't sign up as an editor", async () => {
    await signUp(request(app), { role: "admin" });
    const [user] = JSON.parse(
      fs.readFileSync(usersFile, "utf8")
    );
    expect(user.role).toBe("viewer");
  });
});
