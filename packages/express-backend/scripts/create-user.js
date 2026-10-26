// Create or update a DE-Nile account.
//
//   npm run create-user -- --email you@calpoly.edu \
//     --name "Your Name" --role editor
//
// You'll be asked for the password, so it never ends up in
// your shell history. Roles: viewer, editor, admin.
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { ROLES, isValidRole } from "../src/auth/roles.js";
import {
  normalizeEmail,
  readUsers,
  writeUsers
} from "../src/auth/userStore.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const usersFile =
  process.env.USERS_FILE ??
  path.join(here, "..", "data", "users.json");

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "editor" }
  }
});

const email = normalizeEmail(values.email);
if (!email || !values.name) {
  console.error(
    'Usage: npm run create-user -- --email a@b.edu --name "A B" --role editor'
  );
  process.exit(1);
}
if (!isValidRole(values.role)) {
  console.error(`Role must be one of: ${ROLES.join(", ")}`);
  process.exit(1);
}

// One readline for both prompts; typed characters are hidden.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdin.isTTY
});
let muted = false;
rl._writeToOutput = (text) => {
  if (!muted) process.stdout.write(text);
};
// The iterator buffers lines, so piped input works too.
const lines = rl[Symbol.asyncIterator]();

async function askHidden(question) {
  process.stdout.write(question);
  muted = true;
  const { value } = await lines.next();
  muted = false;
  process.stdout.write("\n");
  return value ?? "";
}

const password = await askHidden("Password (8+ characters): ");
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}
const confirm = await askHidden("Confirm password: ");
rl.close();
if (password !== confirm) {
  console.error("Passwords didn't match.");
  process.exit(1);
}

const users = readUsers(usersFile);
const passwordHash = await bcrypt.hash(password, 10);
const existing = users.find(
  (user) => normalizeEmail(user.email) === email
);

if (existing) {
  existing.name = values.name;
  existing.role = values.role;
  existing.passwordHash = passwordHash;
  existing.emailVerified = true;
  console.log(`Updated ${email} (${values.role}).`);
} else {
  users.push({
    id: crypto.randomUUID(),
    name: values.name,
    email,
    role: values.role,
    passwordHash,
    emailVerified: true
  });
  console.log(`Created ${email} (${values.role}).`);
}

writeUsers(usersFile, users);
