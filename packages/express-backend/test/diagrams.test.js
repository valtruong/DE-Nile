import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const PASSWORD = "static-fire-test";
let app;

function sampleDiagram(overrides = {}) {
  return {
    schemaVersion: 1,
    id: "draft",
    name: "Draft",
    equipment: [
      {
        id: "tank1",
        kind: "tank",
        label: "TK101 Fuel Tank",
        position: { x: 0, y: 0 }
      },
      {
        id: "pt1",
        kind: "pressure-transducer",
        label: "PT101",
        position: { x: 100, y: 0 },
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
        source: "tank1",
        target: "pt1",
        sourceHandle: "top-source",
        targetHandle: "bottom-target",
        color: "#667085",
        routing: "orthogonal"
      }
    ],
    ...overrides
  };
}

async function signedIn(email) {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return agent;
}

async function saveAs(agent, name, extra = {}) {
  const res = await agent
    .post("/api/diagrams")
    .send({ name, diagram: sampleDiagram(), ...extra });
  expect(res.status).toBe(201);
  return res.body.diagram;
}

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "denile-"));
  const usersFile = path.join(dir, "users.json");
  const passwordHash = bcrypt.hashSync(PASSWORD, 4);
  fs.writeFileSync(
    usersFile,
    JSON.stringify(
      [
        [
          "u-admin",
          "Stella Daoud",
          "admin@calpoly.edu",
          "admin"
        ],
        [
          "u-editor",
          "Emilia Vu",
          "editor@calpoly.edu",
          "editor"
        ],
        [
          "u-viewer",
          "Valerie Ng",
          "viewer@calpoly.edu",
          "viewer"
        ]
      ].map(([id, name, email, role]) => ({
        id,
        name,
        email,
        role,
        passwordHash
      }))
    )
  );
  app = createApp({
    usersFile,
    sessionSecret: "test",
    mailer: { send: async () => {} }
  });
});

describe("library", () => {
  it("starts empty", async () => {
    const res = await request(app).get("/api/diagrams");
    expect(res.status).toBe(200);
    expect(res.body.diagrams).toEqual([]);
  });

  it("lists saved diagrams newest first, without the full diagram", async () => {
    const editor = await signedIn("editor@calpoly.edu");
    await saveAs(editor, "Config A");
    await sleep(5);
    await saveAs(editor, "Config B");

    const res = await request(app).get("/api/diagrams");
    expect(res.body.diagrams.map((d) => d.name)).toEqual([
      "Config B",
      "Config A"
    ]);
    expect(res.body.diagrams[0]).toMatchObject({
      version: 1,
      active: false,
      componentCount: 2,
      updatedByName: "Emilia Vu"
    });
    expect(res.body.diagrams[0].diagram).toBeUndefined();
  });
});

describe("saving (editors only)", () => {
  it("refuses guests and operators", async () => {
    const body = { name: "X", diagram: sampleDiagram() };
    expect(
      (await request(app).post("/api/diagrams").send(body))
        .status
    ).toBe(401);
    const viewer = await signedIn("viewer@calpoly.edu");
    expect(
      (await viewer.post("/api/diagrams").send(body)).status
    ).toBe(403);
  });

  it("stores layout, connections and bindings exactly", async () => {
    const editor = await signedIn("editor@calpoly.edu");
    const saved = await saveAs(editor, "  Bipropellant  ");
    expect(saved.name).toBe("Bipropellant");

    const res = await editor.get(`/api/diagrams/${saved.id}`);
    expect(res.status).toBe(200);
    expect(res.body.diagram.diagram).toEqual({
      ...sampleDiagram(),
      id: saved.id,
      name: "Bipropellant"
    });
  });

  it("rejects broken diagrams", async () => {
    const editor = await signedIn("editor@calpoly.edu");
    const bad = [
      { name: "", diagram: sampleDiagram() },
      {
        name: "X",
        diagram: sampleDiagram({ schemaVersion: 2 })
      },
      { name: "X", diagram: sampleDiagram({ equipment: [] }) },
      {
        name: "X",
        diagram: sampleDiagram({
          connections: [
            { id: "l", source: "tank1", target: "nope" }
          ]
        })
      },
      {
        name: "X",
        diagram: sampleDiagram({
          connections: [
            { id: "loop", source: "tank1", target: "tank1" }
          ]
        })
      },
      {
        name: "X",
        diagram: sampleDiagram({
          equipment: [
            ...sampleDiagram().equipment,
            {
              id: "tank1",
              kind: "tank",
              label: "dup",
              position: { x: 1, y: 1 }
            }
          ]
        })
      }
    ];
    for (const body of bad) {
      const res = await editor.post("/api/diagrams").send(body);
      expect(res.status).toBe(400);
    }
  });

  it("bumps the version on each save", async () => {
    const editor = await signedIn("editor@calpoly.edu");
    const saved = await saveAs(editor, "Config B");
    const moved = sampleDiagram();
    moved.equipment[0].position = { x: 40, y: 80 };

    const res = await editor
      .put(`/api/diagrams/${saved.id}`)
      .send({ name: "Config B", diagram: moved, version: 1 });
    expect(res.status).toBe(200);
    expect(res.body.diagram.version).toBe(2);
    expect(
      res.body.diagram.diagram.equipment[0].position
    ).toEqual({ x: 40, y: 80 });
  });

  it("won't overwrite someone else's newer save", async () => {
    const emilia = await signedIn("editor@calpoly.edu");
    const stella = await signedIn("admin@calpoly.edu");
    const saved = await saveAs(emilia, "Config B");

    await stella
      .put(`/api/diagrams/${saved.id}`)
      .send({
        name: "Config B",
        diagram: sampleDiagram(),
        version: 1
      })
      .expect(200);
    const late = await emilia
      .put(`/api/diagrams/${saved.id}`)
      .send({
        name: "Config B",
        diagram: sampleDiagram(),
        version: 1
      });
    expect(late.status).toBe(409);
    expect(late.body.code).toBe("VERSION_CONFLICT");
    expect(late.body.error).toContain("Stella Daoud");
  });
});

describe("active diagram and viewing permissions", () => {
  it("operators and guests can only open the active diagram", async () => {
    const editor = await signedIn("editor@calpoly.edu");
    const a = await saveAs(editor, "Config A");
    const b = await saveAs(editor, "Config B", {
      active: true
    });

    const viewer = await signedIn("viewer@calpoly.edu");
    for (const client of [viewer, request(app)]) {
      expect(
        (await client.get(`/api/diagrams/${b.id}`)).status
      ).toBe(200);
      const blocked = await client.get(`/api/diagrams/${a.id}`);
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe("NOT_ACTIVE");
    }
    expect(
      (await editor.get(`/api/diagrams/${a.id}`)).status
    ).toBe(200);
  });

  it("keeps exactly one diagram active", async () => {
    const editor = await signedIn("editor@calpoly.edu");
    const a = await saveAs(editor, "Config A", {
      active: true
    });
    const b = await saveAs(editor, "Config B");
    await editor
      .post(`/api/diagrams/${b.id}/activate`)
      .expect(200);

    const list = (await request(app).get("/api/diagrams")).body
      .diagrams;
    expect(list.find((d) => d.id === a.id).active).toBe(false);
    expect(list.find((d) => d.id === b.id).active).toBe(true);

    const viewer = await signedIn("viewer@calpoly.edu");
    expect(
      (await viewer.post(`/api/diagrams/${a.id}/activate`))
        .status
    ).toBe(403);
  });

  it("can stop showing a diagram live, then delete it", async () => {
    const editor = await signedIn("editor@calpoly.edu");
    const a = await saveAs(editor, "Config A", {
      active: true
    });

    const viewer = await signedIn("viewer@calpoly.edu");
    expect(
      (await viewer.post(`/api/diagrams/${a.id}/deactivate`))
        .status
    ).toBe(403);
    expect(
      (
        await request(app).post(
          `/api/diagrams/${a.id}/deactivate`
        )
      ).status
    ).toBe(401);

    const res = await editor.post(
      `/api/diagrams/${a.id}/deactivate`
    );
    expect(res.status).toBe(200);
    expect(res.body.diagram.active).toBe(false);

    // Nobody but editors can open it now...
    expect(
      (await viewer.get(`/api/diagrams/${a.id}`)).body.code
    ).toBe("NOT_ACTIVE");
    // ...and it can be deleted.
    await editor.delete(`/api/diagrams/${a.id}`).expect(204);
    expect(
      (await editor.post(`/api/diagrams/${a.id}/deactivate`))
        .status
    ).toBe(404);
  });

  it("won't delete the active diagram", async () => {
    const editor = await signedIn("editor@calpoly.edu");
    const a = await saveAs(editor, "Config A", {
      active: true
    });
    const b = await saveAs(editor, "Config B");

    const res = await editor.delete(`/api/diagrams/${a.id}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DIAGRAM_ACTIVE");
    await editor.delete(`/api/diagrams/${b.id}`).expect(204);
    expect(
      (await editor.get(`/api/diagrams/${b.id}`)).status
    ).toBe(404);
  });
});
