// Runs against a real MongoDB when TEST_MONGODB_URI is set,
// e.g. TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test
// Skipped otherwise, so `npm test` works without a database.
import crypto from "node:crypto";
import { MongoClient } from "mongodb";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it
} from "vitest";
import { createApp } from "../src/app.js";
import { createMongoInviteStore } from "../src/auth/inviteStore.js";
import { createMongoDiagramStore } from "../src/diagrams/diagramStore.js";
import {
  DuplicateEmailError,
  createMongoUserStore
} from "../src/auth/userStore.js";

const URI = process.env.TEST_MONGODB_URI;
const PASSWORD = "shared-db-pass1";

describe.skipIf(!URI)("shared MongoDB accounts", () => {
  let client;
  let db;
  let sent;

  // Two separate backends (say, Stella's and Valerie's
  // laptops) pointed at the same database.
  async function laptop() {
    return createApp({
      userStore: await createMongoUserStore(db),
      inviteStore: await createMongoInviteStore(db),
      diagramStore: await createMongoDiagramStore(db),
      sessionSecret: "test",
      allowedDomains: ["calpoly.edu"],
      mailer: { send: async (mail) => sent.push(mail) }
    });
  }

  function lastCode() {
    return sent.at(-1).text.match(/\b(\d{6})\b/)[1];
  }

  beforeAll(async () => {
    client = await MongoClient.connect(URI);
    db = client.db(
      `denile_test_${crypto.randomUUID().slice(0, 8)}`
    );
    sent = [];
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it("stores, finds, updates and removes fields", async () => {
    const store = await createMongoUserStore(db);
    const created = await store.create({
      id: "u-store",
      name: "Store Test",
      email: "  Store@CalPoly.edu ",
      role: "viewer",
      passwordHash: "x",
      verification: { attempts: 0 }
    });
    expect(created.email).toBe("store@calpoly.edu");
    expect(
      (await store.findByEmail("STORE@calpoly.edu")).id
    ).toBe("u-store");
    expect((await store.findById("u-store")).name).toBe(
      "Store Test"
    );

    const updated = await store.update("u-store", {
      role: "editor",
      verification: undefined
    });
    expect(updated.role).toBe("editor");
    expect(updated).not.toHaveProperty("verification");
    expect(updated).not.toHaveProperty("_id");

    await expect(
      store.create({ id: "u-dupe", email: "store@calpoly.edu" })
    ).rejects.toBeInstanceOf(DuplicateEmailError);
    expect(await store.findById("nope")).toBeNull();
  });

  it("an account made on one laptop works on another", async () => {
    const stella = await laptop();
    const valerie = await laptop();

    // Valerie signs up on her laptop...
    await request(valerie)
      .post("/api/auth/signup")
      .send({
        name: "Valerie Truong",
        email: "vtruong@calpoly.edu",
        password: PASSWORD
      })
      .expect(201);

    // ...enters the emailed code on Stella's laptop...
    const verified = await request
      .agent(stella)
      .post("/api/auth/verify")
      .send({ email: "vtruong@calpoly.edu", code: lastCode() });
    expect(verified.status).toBe(200);
    expect(verified.body.user.role).toBe("viewer");

    // ...and can sign in from either one.
    for (const app of [stella, valerie]) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "vtruong@calpoly.edu",
          password: PASSWORD
        });
      expect(res.status).toBe(200);
    }

    // Signing up again from the other laptop is refused.
    await request(stella)
      .post("/api/auth/signup")
      .send({
        name: "Someone Else",
        email: "vtruong@calpoly.edu",
        password: PASSWORD
      })
      .expect(409);
  });

  it("role changes show up everywhere", async () => {
    const stella = await laptop();
    const emilia = await laptop();

    await request(emilia)
      .post("/api/auth/signup")
      .send({
        name: "Emilia Vu",
        email: "evu@calpoly.edu",
        password: PASSWORD
      })
      .expect(201);
    const agent = request.agent(emilia);
    await agent
      .post("/api/auth/verify")
      .send({ email: "evu@calpoly.edu", code: lastCode() })
      .expect(200);

    // An admin promotes her (what `npm run set-role` does).
    const store = await createMongoUserStore(db);
    const user = await store.findByEmail("evu@calpoly.edu");
    await store.update(user.id, { role: "editor" });

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.user.role).toBe("editor");
    await request(stella)
      .post("/api/auth/login")
      .send({ email: "evu@calpoly.edu", password: PASSWORD })
      .expect(200)
      .then((res) => expect(res.body.user.role).toBe("editor"));
  });

  it("an invite sent from one laptop applies on another", async () => {
    const userStore = await createMongoUserStore(db);
    await userStore.create({
      id: "u-mongo-admin",
      name: "Stella Daoud",
      email: "sdaoud-admin@calpoly.edu",
      role: "admin",
      passwordHash: await import("bcryptjs").then((b) =>
        b.default.hash(PASSWORD, 4)
      )
    });
    const stella = await laptop();
    const valerie = await laptop();

    const admin = request.agent(stella);
    await admin
      .post("/api/auth/login")
      .send({
        email: "sdaoud-admin@calpoly.edu",
        password: PASSWORD
      })
      .expect(200);
    await admin
      .post("/api/admin/invites")
      .send({ email: "invitee@calpoly.edu", role: "editor" })
      .expect(201);

    await request(valerie)
      .post("/api/auth/signup")
      .send({
        name: "Invitee",
        email: "invitee@calpoly.edu",
        password: PASSWORD
      })
      .expect(201);
    const res = await request(valerie)
      .post("/api/auth/verify")
      .send({ email: "invitee@calpoly.edu", code: lastCode() })
      .expect(200);
    expect(res.body.user.role).toBe("editor");
    const left = await admin
      .get("/api/admin/invites")
      .expect(200);
    expect(left.body.invites).toEqual([]);
  });

  it("diagrams saved on one laptop open on another", async () => {
    const store = await createMongoDiagramStore(db);
    const base = {
      id: "d-mongo",
      name: "Config B",
      diagram: {
        schemaVersion: 1,
        equipment: [],
        connections: []
      },
      version: 1,
      active: false,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z"
    };
    await store.create(base);
    await store.create({
      ...base,
      id: "d-other",
      name: "Config A",
      active: true
    });

    // Saving against the right version bumps it...
    const saved = await store.update(
      "d-mongo",
      { name: "Config B2" },
      1
    );
    expect(saved).toMatchObject({
      name: "Config B2",
      version: 2
    });
    // ...and a stale version is refused.
    expect(
      await store.update("d-mongo", { name: "x" }, 1)
    ).toBe(null);

    // Only one diagram stays active.
    await store.setActive("d-mongo");
    const all = await store.list();
    expect(
      all.filter((d) => d.active).map((d) => d.id)
    ).toEqual(["d-mongo"]);

    const off = await store.setInactive("d-mongo");
    expect(off.active).toBe(false);
    expect((await store.list()).some((d) => d.active)).toBe(
      false
    );
    await store.setActive("d-mongo");

    expect(await store.remove("d-other")).toBe(true);
    expect(await store.get("d-other")).toBe(null);
  });

  it("password reset works across laptops", async () => {
    const stella = await laptop();
    const valerie = await laptop();
    await request(stella)
      .post("/api/auth/forgot")
      .send({ email: "vtruong@calpoly.edu" })
      .expect(204);
    await request(valerie)
      .post("/api/auth/reset")
      .send({
        email: "vtruong@calpoly.edu",
        code: lastCode(),
        password: "brand-new-pass2"
      })
      .expect(200);
    await request(stella)
      .post("/api/auth/login")
      .send({
        email: "vtruong@calpoly.edu",
        password: "brand-new-pass2"
      })
      .expect(200);
  });
});
