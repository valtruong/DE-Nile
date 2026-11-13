import crypto from "node:crypto";
import express from "express";
import { requireRole } from "../auth/requireRole.js";
import { hasAtLeast } from "../auth/roles.js";
import { sessionUser } from "../auth/session.js";
import {
  diagramProblem,
  nameProblem
} from "./validateDiagram.js";

// What the library list shows. The full diagram is only sent
// when someone opens it.
function toSummary(record) {
  return {
    id: record.id,
    name: record.name,
    version: record.version,
    active: Boolean(record.active),
    componentCount: record.diagram.equipment.length,
    updatedAt: record.updatedAt,
    updatedByName: record.updatedBy?.name ?? null
  };
}

function toFull(record) {
  return { ...toSummary(record), diagram: record.diagram };
}

const who = (user) => ({ id: user.id, name: user.name });

// The stored diagram always carries its record's ID and name,
// so an exported file says which diagram it came from.
function stamp(diagram, id, name) {
  return { ...diagram, id, name };
}

// /api/diagrams
//
// Reading:  anyone, including "Continue as viewer" guests, can
//           list diagrams and open the active one. Opening any
//           other diagram needs editor.
// Writing:  editor or admin (requireRole on every write route).
export function createDiagramRouter({
  diagramStore,
  userStore
}) {
  const router = express.Router();
  const editorOnly = requireRole("editor", userStore);

  async function isEditor(req) {
    const user = await sessionUser(req, userStore);
    return Boolean(user && hasAtLeast(user.role, "editor"));
  }

  // GET /api/diagrams -> { diagrams: [summary] }, newest first
  router.get("/", async (req, res, next) => {
    try {
      const all = await diagramStore.list();
      res.json({ diagrams: all.map(toSummary) });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/diagrams/:id -> { diagram: full record }
  router.get("/:id", async (req, res, next) => {
    try {
      const record = await diagramStore.get(req.params.id);
      if (!record) {
        return res
          .status(404)
          .json({ error: "That diagram doesn't exist." });
      }
      if (!record.active && !(await isEditor(req))) {
        return res.status(403).json({
          error:
            "Only the active diagram can be opened live. Ask an editor to mark it active.",
          code: "NOT_ACTIVE"
        });
      }
      res.json({ diagram: toFull(record) });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/diagrams  { name, diagram, active? } -> 201
  router.post("/", editorOnly, async (req, res, next) => {
    try {
      const { name, diagram, active } = req.body ?? {};
      const problem =
        nameProblem(name) ?? diagramProblem(diagram);
      if (problem)
        return res.status(400).json({ error: problem });

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const cleanName = name.trim();
      let record = await diagramStore.create({
        id,
        name: cleanName,
        diagram: stamp(diagram, id, cleanName),
        version: 1,
        active: false,
        createdAt: now,
        createdBy: who(req.user),
        updatedAt: now,
        updatedBy: who(req.user)
      });
      if (active === true)
        record = await diagramStore.setActive(id);
      res.status(201).json({ diagram: toFull(record) });
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/diagrams/:id  { name, diagram, version, active? }
  // `version` is the one you opened. If someone saved since,
  // answers 409 VERSION_CONFLICT instead of overwriting.
  router.put("/:id", editorOnly, async (req, res, next) => {
    try {
      const { name, diagram, version, active } = req.body ?? {};
      const problem =
        nameProblem(name) ?? diagramProblem(diagram);
      if (problem)
        return res.status(400).json({ error: problem });
      if (!Number.isInteger(version)) {
        return res
          .status(400)
          .json({ error: "Missing the version you opened." });
      }

      const existing = await diagramStore.get(req.params.id);
      if (!existing) {
        return res
          .status(404)
          .json({ error: "That diagram doesn't exist." });
      }

      const cleanName = name.trim();
      let record = await diagramStore.update(
        existing.id,
        {
          name: cleanName,
          diagram: stamp(diagram, existing.id, cleanName),
          updatedAt: new Date().toISOString(),
          updatedBy: who(req.user)
        },
        version
      );
      if (!record) {
        const latest = await diagramStore.get(existing.id);
        return res.status(409).json({
          error: `${latest?.updatedBy?.name ?? "Someone"} saved a newer version (v${latest?.version}) while you were editing.`,
          code: "VERSION_CONFLICT"
        });
      }
      if (active === true) {
        record = await diagramStore.setActive(record.id);
      }
      res.json({ diagram: toFull(record) });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/diagrams/:id/activate -> the diagram operators see
  router.post(
    "/:id/activate",
    editorOnly,
    async (req, res, next) => {
      try {
        const record = await diagramStore.setActive(
          req.params.id
        );
        if (!record) {
          return res
            .status(404)
            .json({ error: "That diagram doesn't exist." });
        }
        res.json({ diagram: toSummary(record) });
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /api/diagrams/:id -> 204. The active diagram can't be
  // deleted, so operators never lose their live view.
  router.delete("/:id", editorOnly, async (req, res, next) => {
    try {
      const record = await diagramStore.get(req.params.id);
      if (!record) {
        return res
          .status(404)
          .json({ error: "That diagram doesn't exist." });
      }
      if (record.active) {
        return res.status(409).json({
          error:
            "This is the active diagram. Make another one active before deleting it.",
          code: "DIAGRAM_ACTIVE"
        });
      }
      await diagramStore.remove(record.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
