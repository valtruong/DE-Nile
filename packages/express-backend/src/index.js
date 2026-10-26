import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const usersFile =
  process.env.USERS_FILE ??
  path.join(here, "..", "data", "users.json");

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

const app = createApp({
  usersFile,
  sessionSecret,
  allowedDomains
});

app.listen(port, () => {
  console.log(`DE-Nile backend on http://localhost:${port}`);
});
