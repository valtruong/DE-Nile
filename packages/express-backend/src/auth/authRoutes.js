import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import {
  isEmailVerified,
  normalizeEmail,
  toPublicUser
} from "./userStore.js";
import {
  passwordResetEmail,
  verificationEmail
} from "./mailer.js";
import { sessionUser } from "./session.js";
import {
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  canResend,
  checkCode,
  newVerification
} from "./verification.js";

// Hash of a throwaway password. Comparing against it when the
// email is unknown keeps the response time the same as for a
// wrong password, so nobody can probe which emails have
// accounts.
const DUMMY_HASH = bcrypt.hashSync("no-such-user", 10);

const SIGN_IN_FAILED = "Email or password is incorrect.";
const MIN_PASSWORD = 8;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isString(value) {
  return typeof value === "string";
}

// Start a fresh session for `user` (new session id prevents
// session fixation).
function signInSession(req, res, next, user) {
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = user.id;
    req.session.signedInAt = Date.now();
    res.json({ user: toPublicUser(user) });
  });
}

export function createAuthRouter({
  userStore,
  mailer,
  allowedDomains = []
}) {
  const router = express.Router();

  function domainAllowed(email) {
    if (allowedDomains.length === 0) return true;
    const domain = email.split("@")[1];
    return allowedDomains.includes(domain);
  }

  async function sendCode(user) {
    const { code, record } = newVerification();
    userStore.update(user.id, { verification: record });
    const message = verificationEmail(user.name, code);
    await mailer.send({ to: user.email, ...message });
  }

  async function sendResetCode(user) {
    const { code, record } = newVerification();
    userStore.update(user.id, { passwordReset: record });
    const message = passwordResetEmail(user.name, code);
    await mailer.send({ to: user.email, ...message });
  }

  // Checks `code` against user[field] ("verification" or
  // "passwordReset"). Sends the error response and returns
  // false when it doesn't match.
  function acceptCode(res, user, field, code) {
    const record = user[field];
    const result = checkCode(record, code);
    if (result === "ok") return true;

    if (result === "locked") {
      res.status(429).json({
        error: "Too many wrong tries. Send a new code."
      });
    } else if (result === "expired") {
      res.status(400).json({
        error: "This code expired. Send a new code."
      });
    } else {
      const attempts = record.attempts + 1;
      userStore.update(user.id, {
        [field]: { ...record, attempts }
      });
      const left = MAX_ATTEMPTS - attempts;
      res.status(400).json({
        error:
          left > 0
            ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`
            : "Too many wrong tries. Send a new code."
      });
    }
    return false;
  }

  // POST /api/auth/signup  { name, email, password }
  // Creates a viewer account and emails a 6-digit code.
  // Editor access is granted later by an admin.
  router.post("/signup", async (req, res, next) => {
    try {
      const {
        name,
        email: rawEmail,
        password
      } = req.body ?? {};
      const email = normalizeEmail(rawEmail);

      if (!isString(name) || !name.trim()) {
        return res
          .status(400)
          .json({ error: "Enter your name." });
      }
      if (!EMAIL_SHAPE.test(email)) {
        return res
          .status(400)
          .json({ error: "Enter a valid email address." });
      }
      if (!domainAllowed(email)) {
        return res.status(400).json({
          error: `Use your ${allowedDomains
            .map((d) => "@" + d)
            .join(" or ")} email.`
        });
      }
      if (
        !isString(password) ||
        password.length < MIN_PASSWORD
      ) {
        return res.status(400).json({
          error: `Password must be at least ${MIN_PASSWORD} characters.`
        });
      }

      const existing = userStore.findByEmail(email);
      if (existing && isEmailVerified(existing)) {
        return res.status(409).json({
          error:
            "An account with this email already exists. Sign in instead."
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      let user;
      if (existing) {
        // Signed up before but never verified: let them start
        // over with new details.
        user = userStore.update(existing.id, {
          name: name.trim(),
          passwordHash
        });
        if (!canResend(existing.verification)) {
          return res.status(201).json({ email });
        }
      } else {
        user = userStore.create({
          id: crypto.randomUUID(),
          name: name.trim(),
          email,
          role: "viewer",
          passwordHash,
          emailVerified: false
        });
      }

      try {
        await sendCode(user);
      } catch (err) {
        console.error("Couldn't send verification email:", err);
        return res.status(502).json({
          error:
            "Your account was created, but the email didn't send. Try 'Send a new code'."
        });
      }
      res.status(201).json({ email });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/verify  { email, code }
  // Marks the email verified and signs the user in.
  router.post("/verify", (req, res, next) => {
    const { email, code } = req.body ?? {};
    const user = isString(email)
      ? userStore.findByEmail(email)
      : null;

    if (!user || !isString(code)) {
      return res
        .status(400)
        .json({ error: "That code isn't right." });
    }
    if (isEmailVerified(user)) {
      return res.status(400).json({
        error:
          "This email is already verified. Sign in instead."
      });
    }

    if (!acceptCode(res, user, "verification", code)) return;

    const verified = userStore.update(user.id, {
      emailVerified: true,
      verification: undefined
    });
    signInSession(req, res, next, verified);
  });

  // POST /api/auth/resend  { email }
  router.post("/resend", async (req, res, next) => {
    try {
      const { email } = req.body ?? {};
      const user = isString(email)
        ? userStore.findByEmail(email)
        : null;

      // Same answer whether or not the account exists.
      if (!user || isEmailVerified(user)) {
        return res.status(204).end();
      }
      if (!canResend(user.verification)) {
        const wait = Math.ceil(
          (user.verification.sentAt +
            RESEND_COOLDOWN_MS -
            Date.now()) /
            1000
        );
        return res.status(429).json({
          error: `Wait ${wait} s before asking for another code.`,
          code: "RESEND_TOO_SOON"
        });
      }
      await sendCode(user);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/forgot  { email }
  // Emails a reset code. Always answers 204 so nobody can
  // use it to check which emails have accounts.
  router.post("/forgot", async (req, res, next) => {
    try {
      const { email } = req.body ?? {};
      const user = isString(email)
        ? userStore.findByEmail(email)
        : null;
      if (user && canResend(user.passwordReset)) {
        await sendResetCode(user);
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/reset  { email, code, password }
  // Sets a new password and signs the user in. Every other
  // session for this account is signed out.
  router.post("/reset", async (req, res, next) => {
    try {
      const { email, code, password } = req.body ?? {};
      if (
        !isString(password) ||
        password.length < MIN_PASSWORD
      ) {
        return res.status(400).json({
          error: `Password must be at least ${MIN_PASSWORD} characters.`
        });
      }
      const user = isString(email)
        ? userStore.findByEmail(email)
        : null;
      if (!user || !user.passwordReset || !isString(code)) {
        return res.status(400).json({
          error: "That code isn't right. Send a new code."
        });
      }
      if (!acceptCode(res, user, "passwordReset", code)) return;

      const updated = userStore.update(user.id, {
        passwordHash: await bcrypt.hash(password, 10),
        passwordChangedAt: Date.now(),
        passwordReset: undefined,
        // They just proved they can read this inbox.
        emailVerified: true,
        verification: undefined
      });
      signInSession(req, res, next, updated);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/login  { email, password }
  router.post("/login", async (req, res, next) => {
    try {
      const { email, password } = req.body ?? {};
      if (
        !isString(email) ||
        !isString(password) ||
        !email.trim() ||
        !password
      ) {
        return res
          .status(400)
          .json({ error: "Enter your email and password." });
      }

      const user = userStore.findByEmail(email);
      const matches = await bcrypt.compare(
        password,
        user?.passwordHash ?? DUMMY_HASH
      );
      if (!user || !matches) {
        return res.status(401).json({ error: SIGN_IN_FAILED });
      }
      // Only revealed after the right password.
      if (!isEmailVerified(user)) {
        return res.status(403).json({
          error: "Verify your email before signing in.",
          code: "EMAIL_NOT_VERIFIED",
          email: user.email
        });
      }

      signInSession(req, res, next, user);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/auth/me -> who is signed in, or 401
  router.get("/me", (req, res) => {
    const user = sessionUser(req, userStore);
    if (!user) {
      return res.status(401).json({ error: "Not signed in." });
    }
    res.json({ user: toPublicUser(user) });
  });

  // POST /api/auth/logout
  router.post("/logout", (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie("denile.sid");
      res.status(204).end();
    });
  });

  return router;
}
