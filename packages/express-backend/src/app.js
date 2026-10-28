import express from "express";
import session from "express-session";
import { createAuthRouter } from "./auth/authRoutes.js";
import { createMailer } from "./auth/mailer.js";
import { createJsonUserStore } from "./auth/userStore.js";

// Pass `userStore` (see src/db.js), or `usersFile` for a
// local JSON store (handy in tests).
export function createApp({
  userStore: givenStore,
  usersFile,
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
    createAuthRouter({ userStore, mailer, allowedDomains })
  );

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  // Exposed so diagram routes can use requireRole later.
  app.locals.userStore = userStore;
  return app;
}
