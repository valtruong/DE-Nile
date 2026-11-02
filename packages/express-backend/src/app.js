import path from "node:path";
import express from "express";
import session from "express-session";
import { createAdminRouter } from "./auth/adminRoutes.js";
import { createAuthRouter } from "./auth/authRoutes.js";
import { createJsonInviteStore } from "./auth/inviteStore.js";
import { createMailer } from "./auth/mailer.js";
import { createJsonUserStore } from "./auth/userStore.js";

// Pass `userStore` and `inviteStore` (see src/db.js), or
// `usersFile` for local JSON stores (handy in tests).
export function createApp({
  userStore: givenStore,
  inviteStore: givenInvites,
  usersFile,
  appUrl = "http://localhost:5173",
  sessionSecret,
  mailer = createMailer(),
  allowedDomains = []
}) {
  if (!sessionSecret) {
    throw new Error("createApp needs a sessionSecret");
  }

  const app = express();
  const userStore =
    givenStore ?? createJsonUserStore(usersFile);
  if (!givenInvites && !usersFile) {
    throw new Error("createApp needs inviteStore or usersFile");
  }
  const inviteStore =
    givenInvites ??
    createJsonInviteStore(
      path.join(path.dirname(usersFile), "invites.json")
    );

  app.use(express.json());
  app.use(
    session({
      name: "denile.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 8 * 60 * 60 * 1000 // one test day
      }
    })
  );

  app.use(
    "/api/auth",
    createAuthRouter({
      userStore,
      inviteStore,
      mailer,
      allowedDomains
    })
  );
  app.use(
    "/api/admin",
    createAdminRouter({
      userStore,
      inviteStore,
      mailer,
      allowedDomains,
      appUrl
    })
  );

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  // Exposed so diagram routes can use requireRole later.
  app.locals.userStore = userStore;
  app.locals.inviteStore = inviteStore;
  return app;
}
