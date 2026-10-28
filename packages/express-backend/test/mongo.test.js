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
  function laptop() {
    return createMongoUserStore(db).then((userStore) =>
      createApp({
        userStore,
        sessionSecret: "test",
        allowedDomains: ["calpoly.edu"],
        mailer: { send: async (mail) => sent.push(mail) }
      })
    );
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
