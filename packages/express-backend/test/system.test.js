import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

// TE7 Part III: system tests.
//
// Each test drives one feature end to end through the real
// Express app: HTTP route → session/role check (requireRole) →
// validation → store (the same code that talks to MongoDB, here
// backed by a temporary JSON file) → HTTP response. Besides the
// response, each test checks what actually ended up in storage.
//
// Run just these:  npm run test:system  (in packages/express-backend)

const PASSWORD = "static-fire-test";

let app;
let dataDir;
let emails;

// A small but complete P&ID: a tank piped to a pressure
// transducer that's bound to a telemetry topic.
function tankWithSensor() {
  return {
    schemaVersion: 1,
    id: "draft",
    name: "Draft",
    equipment: [
      {
        id: "TK101",
        kind: "tank",
        label: "TK101 Fuel tank",
        position: { x: 0, y: 0 }
      },
      {
        id: "PT101",
        kind: "pressure-transducer",
        label: "PT101",
        position: { x: 160, y: 0 },
        binding: {
          topic: "demo.pressure.pt101",
          valueType: "number",
          unit: "kPa"
        }
      }
    ],
    connections: [
      {
        id: "line1",
        source: "TK101",
        target: "PT101",
        color: "#667085",
        routing: "orthogonal"
      }
    ]
  };
}

// What's really in storage, read straight from the store.
const stored = () => app.locals.diagramStore.list();

async function signIn(email) {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return agent;
}

beforeEach(() => {
  dataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "denile-sys-")
  );
  const usersFile = path.join(dataDir, "users.json");
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
        id: "u-operator",
        name: "Valerie Truong",
        email: "operator@calpoly.edu",
        role: "viewer",
        passwordHash
      }
    ])
  );
  emails = [];
  app = createApp({
    usersFile,
    sessionSecret: "test",
    allowedDomains: ["calpoly.edu"],
    mailer: { send: async (mail) => emails.push(mail) }
  });
});

describe("System: an editor saves a diagram and gets it back", () => {
  it("creates the diagram, stores it, and returns it through the API", async () => {
    const editor = await signIn("editor@calpoly.edu");

    // Create
    const created = await editor
      .post("/api/diagrams")
      .send({
        name: "Cold-flow test",
        diagram: tankWithSensor()
      });
    expect(created.status).toBe(201);
    const id = created.body.diagram.id;
    expect(created.body.diagram).toMatchObject({
      name: "Cold-flow test",
      version: 1,
      active: false
    });

    // Stored, with who saved it
    const records = await stored();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id,
      name: "Cold-flow test",
      createdBy: { id: "u-editor", name: "Emilia Vu" }
    });

    // Listed in the library
    const list = await editor.get("/api/diagrams").expect(200);
    expect(list.body.diagrams).toEqual([
      expect.objectContaining({
        id,
        name: "Cold-flow test",
        componentCount: 2,
        updatedByName: "Emilia Vu"
      })
    ]);

    // Opened again: layout, pipe and telemetry binding intact
    const opened = await editor
      .get(`/api/diagrams/${id}`)
      .expect(200);
    expect(opened.body.diagram.diagram.equipment).toEqual(
      tankWithSensor().equipment
    );
    expect(opened.body.diagram.diagram.connections).toEqual(
      tankWithSensor().connections
    );
  });

  it("saves a new version without overwriting someone else's newer save", async () => {
    const editor = await signIn("editor@calpoly.edu");
    const { id } = (
      await editor
        .post("/api/diagrams")
        .send({ name: "Config B", diagram: tankWithSensor() })
    ).body.diagram;

    const moved = tankWithSensor();
    moved.equipment[0].position = { x: 40, y: 80 };
    const v2 = await editor
      .put(`/api/diagrams/${id}`)
      .send({ name: "Config B", diagram: moved, version: 1 });
    expect(v2.status).toBe(200);
    expect(v2.body.diagram.version).toBe(2);

    // A save based on the old version 1 is refused...
    const stale = await editor
      .put(`/api/diagrams/${id}`)
      .send({
        name: "Config B",
        diagram: tankWithSensor(),
        version: 1
      });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("VERSION_CONFLICT");

    // ...and storage still holds version 2 with the move.
    const [record] = await stored();
    expect(record.version).toBe(2);
    expect(record.diagram.equipment[0].position).toEqual({
      x: 40,
      y: 80
    });
  });
});

describe("System: users without permission can't make changes", () => {
  it("refuses an operator's save and stores nothing", async () => {
    const operator = await signIn("operator@calpoly.edu");

    const res = await operator
      .post("/api/diagrams")
      .send({ name: "Sneaky", diagram: tankWithSensor() });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(
      "This needs editor permissions."
    );
    expect(await stored()).toEqual([]);
  });

  it("refuses requests from someone who isn't signed in", async () => {
    const res = await request(app)
      .post("/api/diagrams")
      .send({ name: "Anonymous", diagram: tankWithSensor() });

    expect(res.status).toBe(401);
    expect(await stored()).toEqual([]);
  });

  it("lets operators open only the active diagram", async () => {
    const editor = await signIn("editor@calpoly.edu");
    const draft = (
      await editor
        .post("/api/diagrams")
        .send({ name: "Draft", diagram: tankWithSensor() })
    ).body.diagram;
    const live = (
      await editor
        .post("/api/diagrams")
        .send({
          name: "Live",
          diagram: tankWithSensor(),
          active: true
        })
    ).body.diagram;

    const operator = await signIn("operator@calpoly.edu");
    await operator.get(`/api/diagrams/${live.id}`).expect(200);
    const blocked = await operator.get(
      `/api/diagrams/${draft.id}`
    );
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("NOT_ACTIVE");
  });
});

describe("System: invalid requests get a clear error", () => {
  it("rejects a pipe to a missing component with 400 and a message", async () => {
    const editor = await signIn("editor@calpoly.edu");
    const broken = tankWithSensor();
    broken.connections[0].target = "PT999";

    const res = await editor
      .post("/api/diagrams")
      .send({ name: "Broken", diagram: broken });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      "Pipe line1 connects to a missing component."
    );
    expect(await stored()).toEqual([]);
  });

  it("rejects a diagram without a name", async () => {
    const editor = await signIn("editor@calpoly.edu");
    const res = await editor
      .post("/api/diagrams")
      .send({ name: "  ", diagram: tankWithSensor() });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Give the diagram a name.");
    expect(await stored()).toEqual([]);
  });
});

describe("System: a new teammate signs up, verifies and signs in", () => {
  it("creates an unverified account, emails a code, and signs in after verifying", async () => {
    const agent = request.agent(app);

    // Sign up: account stored with a hashed password, not usable yet
    await agent
      .post("/api/auth/signup")
      .send({
        name: "Rafael Ortiz",
        email: "rortiz@calpoly.edu",
        password: PASSWORD
      })
      .expect(201);
    const user = await app.locals.userStore.findByEmail(
      "rortiz@calpoly.edu"
    );
    expect(user).toMatchObject({
      role: "viewer",
      emailVerified: false
    });
    expect(user.passwordHash).not.toContain(PASSWORD);

    // Signing in before verifying is refused
    const early = await request(app)
      .post("/api/auth/login")
      .send({
        email: "rortiz@calpoly.edu",
        password: PASSWORD
      });
    expect(early.status).toBe(403);
    expect(early.body.code).toBe("EMAIL_NOT_VERIFIED");

    // The emailed code verifies the account and signs them in
    const code = emails.at(-1).text.match(/\b(\d{6})\b/)[1];
    await agent
      .post("/api/auth/verify")
      .send({ email: "rortiz@calpoly.edu", code })
      .expect(200);
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.user).toMatchObject({
      name: "Rafael Ortiz",
      role: "viewer"
    });
    expect(
      (
        await app.locals.userStore.findByEmail(
          "rortiz@calpoly.edu"
        )
      ).emailVerified
    ).toBe(true);
  });
});
