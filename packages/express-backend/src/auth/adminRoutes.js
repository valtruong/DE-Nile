import express from "express";
import { requireRole } from "./requireRole.js";
import { isValidRole } from "./roles.js";
import {
  isEmailVerified,
  normalizeEmail,
  toPublicUser
} from "./userStore.js";
import { inviteEmail } from "./mailer.js";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// What the admin page needs to know about each account.
function toAdminUser(user) {
  return {
    ...toPublicUser(user),
    emailVerified: isEmailVerified(user)
  };
}

// Admin-only routes behind /api/admin: see and change who can
// do what. Every route checks the role on the server, so hiding
// the page in the browser isn't what protects it.
export function createAdminRouter({
  userStore,
  inviteStore,
  mailer,
  allowedDomains = [],
  appUrl
}) {
  const router = express.Router();
  router.use(requireRole("admin", userStore));

  async function adminCount() {
    return (await userStore.list()).filter(
      (u) => u.role === "admin"
    ).length;
  }

  // GET /api/admin/users -> { users: [...] }, sorted by name
  router.get("/users", async (req, res, next) => {
    try {
      const users = (await userStore.list())
        .map(toAdminUser)
        .sort((a, b) => a.name.localeCompare(b.name));
      res.json({ users });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/admin/users/:id  { role }
  // Takes effect on that person's next request.
  router.patch("/users/:id", async (req, res, next) => {
    try {
      const { role } = req.body ?? {};
      if (!isValidRole(role)) {
        return res.status(400).json({
          error: "Role must be viewer, editor or admin."
        });
      }
      const target = await userStore.findById(req.params.id);
      if (!target) {
        return res
          .status(404)
          .json({ error: "No such account." });
      }
      if (
        target.role === "admin" &&
        role !== "admin" &&
        (await adminCount()) === 1
      ) {
        return res.status(409).json({
          error:
            "This is the only admin. Make someone else an admin first.",
          code: "LAST_ADMIN"
        });
      }
      const updated = await userStore.update(target.id, {
        role
      });
      res.json({ user: toAdminUser(updated) });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/admin/invites -> { invites: [...] }
  router.get("/invites", async (req, res, next) => {
    try {
      res.json({ invites: await inviteStore.list() });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/admin/invites  { email, role }
  // Emails the person; their role is applied when they sign up
  // and verify. Inviting the same email again updates the role.
  router.post("/invites", async (req, res, next) => {
    try {
      const { role } = req.body ?? {};
      const email = normalizeEmail(req.body?.email);
      if (!EMAIL_SHAPE.test(email)) {
        return res
          .status(400)
          .json({ error: "Enter a valid email address." });
      }
      if (
        allowedDomains.length > 0 &&
        !allowedDomains.includes(email.split("@")[1])
      ) {
        return res.status(400).json({
          error: `Only ${allowedDomains
            .map((d) => "@" + d)
            .join(" or ")} emails can sign up.`
        });
      }
      if (!isValidRole(role)) {
        return res.status(400).json({
          error: "Role must be viewer, editor or admin."
        });
      }

      const existing = await userStore.findByEmail(email);
      if (existing && isEmailVerified(existing)) {
        return res.status(409).json({
          error: `${existing.name} already has an account. Change their role in the list instead.`,
          code: "ALREADY_MEMBER"
        });
      }

      const invite = await inviteStore.upsert({
        email,
        role,
        invitedBy: req.user.id,
        invitedByName: req.user.name,
        createdAt: Date.now()
      });

      try {
        await mailer.send({
          to: email,
          ...inviteEmail(req.user.name, role, appUrl)
        });
      } catch (err) {
        console.error("Couldn't send invite email:", err);
        return res.status(502).json({
          error:
            "The invite was saved, but the email didn't send. They can still sign up with that address.",
          code: "EMAIL_FAILED",
          invite
        });
      }
      res.status(201).json({ invite });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/admin/invites/:email
  router.delete("/invites/:email", async (req, res, next) => {
    try {
      const removed = await inviteStore.remove(
        req.params.email
      );
      if (!removed) {
        return res
          .status(404)
          .json({ error: "No such invite." });
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
