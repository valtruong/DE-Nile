// Loads packages/express-backend/.env (shared team settings:
// database, email, secrets). It is git-ignored; copy
// .env.example to start.
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.join(here, "..", ".env"),
  quiet: true
});

const { createApp } = await import("./app.js");
const { createMailer } = await import("./auth/mailer.js");
const { openUserStore } = await import("./db.js");

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Set SESSION_SECRET before starting.");
  }
  sessionSecret = "dev-only-secret-change-me";
  console.warn(
    "SESSION_SECRET not set; using a dev-only secret."
  );
}

const port = Number(process.env.PORT ?? 8000);
// Who may create an account. Comma-separated; set it to an
// empty string to allow any email.
const allowedDomains = (
  process.env.ALLOWED_EMAIL_DOMAINS ?? "calpoly.edu"
)
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

let store;
try {
  store = await openUserStore();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const mailer = createMailer();
const app = createApp({
  userStore: store.userStore,
  sessionSecret,
  mailer,
  allowedDomains
});

app.listen(port, () => {
  console.log(`DE-Nile backend on http://localhost:${port}`);
  console.log(`Accounts: ${store.where}`);
  console.log(
    mailer.kind === "smtp"
      ? `Email: sending through ${process.env.SMTP_HOST}`
      : "Email: printed here (set SMTP_* in .env to send real email)"
  );
});
