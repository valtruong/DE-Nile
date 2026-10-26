import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const OLD = "old-password-1";
const NEW = "new-password-2";
const EMAIL = "editor@calpoly.edu";
let app;
let usersFile;
let sent;

function lastCode() {
  return sent.at(-1).text.match(/\b(\d{6})\b/)[1];
}

function readUser() {
  return JSON.parse(fs.readFileSync(usersFile, "utf8"))[0];
}

function writeUser(changes) {
  fs.writeFileSync(
    usersFile,
    JSON.stringify([{ ...readUser(), ...changes }])
  );
}

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "denile-"));
  usersFile = path.join(dir, "users.json");
  fs.writeFileSync(
    usersFile,
    JSON.stringify([
      {
        id: "u1",
        name: "Emilia Vu",
        email: EMAIL,
        role: "editor",
        passwordHash: bcrypt.hashSync(OLD, 4)
      }
    ])
  );
  sent = [];
  app = createApp({
    usersFile,
    sessionSecret: "test",
    mailer: { send: async (mail) => sent.push(mail) }
  });
});

describe("forgot password", () => {
  it("emails a reset code", async () => {
    await request(app)
      .post("/api/auth/forgot")
      .send({ email: EMAIL })
      .expect(204);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toMatch(/password reset/);
    expect(JSON.stringify(readUser())).not.toContain(
      lastCode()
    );
  });

  it("answers the same for unknown emails", async () => {
    await request(app)
      .post("/api/auth/forgot")
      .send({ email: "nobody@calpoly.edu" })
      .expect(204);
    expect(sent).toHaveLength(0);
  });

  it("sends at most one code a minute", async () => {
    await request(app)
      .post("/api/auth/forgot")
      .send({ email: EMAIL });
    await request(app)
      .post("/api/auth/forgot")
      .send({ email: EMAIL })
      .expect(204);
    expect(sent).toHaveLength(1);
  });
});

describe("reset password", () => {
  it("sets the new password and signs you in", async () => {
    await request(app)
      .post("/api/auth/forgot")
      .send({ email: EMAIL });

    const agent = request.agent(app);
    const res = await agent
      .post("/api/auth/reset")
      .send({ email: EMAIL, code: lastCode(), password: NEW });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("editor");
    await agent.get("/api/auth/me").expect(200);

    // Old password stops working, new one works.
    await request(app)
      .post("/api/auth/login")
      .send({ email: EMAIL, password: OLD })
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ email: EMAIL, password: NEW })
      .expect(200);

    // The code can't be used twice.
    await request(app)
      .post("/api/auth/reset")
      .send({
        email: EMAIL,
        code: lastCode(),
        password: "x".repeat(9)
      })
      .expect(400);
  });

  it("signs out other browsers", async () => {
    const laptop = request.agent(app);
    await laptop
      .post("/api/auth/login")
      .send({ email: EMAIL, password: OLD })
      .expect(200);
    await laptop.get("/api/auth/me").expect(200);

    await request(app)
      .post("/api/auth/forgot")
      .send({ email: EMAIL });
    await request(app)
      .post("/api/auth/reset")
      .send({ email: EMAIL, code: lastCode(), password: NEW })
      .expect(200);

    await laptop.get("/api/auth/me").expect(401);
  });

  it("rejects wrong and expired codes", async () => {
    await request(app)
      .post("/api/auth/forgot")
      .send({ email: EMAIL });
    const bad = lastCode() === "111111" ? "222222" : "111111";

    const wrong = await request(app)
      .post("/api/auth/reset")
      .send({ email: EMAIL, code: bad, password: NEW });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toMatch(/4 tries left/);

    writeUser({
      passwordReset: {
        ...readUser().passwordReset,
        expiresAt: Date.now() - 1
      }
    });
    const expired = await request(app)
      .post("/api/auth/reset")
      .send({ email: EMAIL, code: lastCode(), password: NEW });
    expect(expired.body.error).toMatch(/expired/);

    // Password unchanged.
    await request(app)
      .post("/api/auth/login")
      .send({ email: EMAIL, password: OLD })
      .expect(200);
  });

  it("needs an 8+ character password", async () => {
    await request(app)
      .post("/api/auth/forgot")
      .send({ email: EMAIL });
    await request(app)
      .post("/api/auth/reset")
      .send({
        email: EMAIL,
        code: lastCode(),
        password: "short"
      })
      .expect(400);
  });

  it("also verifies an unverified email", async () => {
    writeUser({ emailVerified: false });
    await request(app)
      .post("/api/auth/forgot")
      .send({ email: EMAIL });
    await request(app)
      .post("/api/auth/reset")
      .send({ email: EMAIL, code: lastCode(), password: NEW })
      .expect(200);
    expect(readUser().emailVerified).toBe(true);
  });
});
