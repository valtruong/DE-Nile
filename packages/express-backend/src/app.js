import path from "node:path";
import express from "express";
import session from "express-session";
import { createAdminRouter } from "./auth/adminRoutes.js";
import { createAuthRouter } from "./auth/authRoutes.js";
import { createJsonInviteStore } from "./auth/inviteStore.js";
import { createMailer } from "./auth/mailer.js";
import { createJsonUserStore } from "./auth/userStore.js";
import { createDiagramRouter } from "./diagrams/diagramRoutes.js";
import { createJsonDiagramStore } from "./diagrams/diagramStore.js";

// Pass `userStore`, `inviteStore` and `diagramStore` (see
// src/db.js), or `usersFile` for local JSON stores next to it
// (handy in tests).
export function createApp({
  userStore: givenStore,
  inviteStore: givenInvites,
  diagramStore: givenDiagrams,
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
  if ((!givenInvites || !givenDiagrams) && !usersFile) {
    throw new Error(
      "createApp needs inviteStore and diagramStore, or usersFile"
    );
  }
  const inviteStore =
    givenInvites ??
    createJsonInviteStore(
      path.join(path.dirname(usersFile), "invites.json")
    );

  const diagramStore =
    givenDiagrams ??
    createJsonDiagramStore(
      path.join(path.dirname(usersFile), "diagrams.json")
    );

  // Big diagrams can be a few hundred KB of JSON.
  app.use(express.json({ limit: "1mb" }));
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

  app.use(
    "/api/diagrams",
    createDiagramRouter({ diagramStore, userStore })
  );

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  app.locals.userStore = userStore;
  app.locals.inviteStore = inviteStore;
  app.locals.diagramStore = diagramStore;
  return app;
}
